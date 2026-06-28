from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q

from tenant.models.KnowledgeBase import KBArticle
from tenant.models.TicketModel import Ticket, TicketComment
from tenant.services.ai.kb_search import KBSearchService


def _strip_html(value: str | None) -> str:
    import re

    text = value or ""
    text = re.sub(r"<[^>]+>", " ", text)
    return " ".join(text.split())


@dataclass
class CopilotContext:
    ticket: Ticket
    ticket_summary: str
    thread: list[dict]
    customer_history: list[dict]
    similar_tickets: list[dict]
    kb_suggestions: list[dict]


class ContextAssembler:
    def __init__(self) -> None:
        self.kb_search = KBSearchService()

    def build(
        self,
        *,
        ticket: Ticket,
        query: str,
        top_k: int = 3,
    ) -> CopilotContext:
        return CopilotContext(
            ticket=ticket,
            ticket_summary=self._build_ticket_summary(ticket),
            thread=self._build_thread(ticket),
            customer_history=self._build_customer_history(ticket),
            similar_tickets=self.find_similar_tickets(ticket=ticket, query=query, top_k=top_k),
            kb_suggestions=self.search_kb(ticket.business_id, query or ticket.title or "", top_k=top_k),
        )

    def _build_ticket_summary(self, ticket: Ticket) -> str:
        requester = ticket.creator_name or ticket.creator_email or "Unknown requester"
        category = ticket.category.name if ticket.category else "Uncategorized"
        department = ticket.department.name if ticket.department else "Unassigned"
        linked_tasks_count = ticket.related_tasks.filter(is_archived=False, is_deleted=False).count()
        return (
            f"Ticket #{ticket.ticket_id}: {ticket.title}\n"
            f"Status: {ticket.status}\n"
            f"Priority: {ticket.priority}\n"
            f"Requester: {requester}\n"
            f"Category: {category}\n"
            f"Department: {department}\n"
            f"Linked tasks: {linked_tasks_count}\n"
            f"Description: {_strip_html(ticket.description)[:800]}"
        )

    def _build_thread(self, ticket: Ticket, limit: int = 8) -> list[dict]:
        comments = (
            TicketComment.objects.filter(ticket=ticket)
            .select_related("author")
            .order_by("-created_at")[:limit]
        )
        thread: list[dict] = []
        for comment in reversed(list(comments)):
            author_name = (
                comment.author.full_name().strip()
                if comment.author and hasattr(comment.author, "full_name")
                else (comment.author.email if comment.author else ticket.creator_name or "Customer")
            )
            thread.append(
                {
                    "author": author_name or "Agent",
                    "is_internal": bool(comment.is_internal),
                    "content": _strip_html(comment.content)[:800],
                    "created_at": comment.created_at.isoformat(),
                }
            )
        return thread

    def _build_customer_history(self, ticket: Ticket, limit: int = 5) -> list[dict]:
        query = Ticket.objects.filter(business=ticket.business).exclude(id=ticket.id)
        if ticket.contact_id:
            query = query.filter(contact_id=ticket.contact_id)
        elif ticket.creator_email:
            query = query.filter(creator_email__iexact=ticket.creator_email)
        else:
            return []

        history = query.order_by("-created_at")[:limit]
        return [
            {
                "id": item.id,
                "ticket_id": item.ticket_id,
                "title": item.title,
                "status": item.status,
                "priority": item.priority,
                "created_at": item.created_at.isoformat(),
            }
            for item in history
        ]

    def find_similar_tickets(self, *, ticket: Ticket, query: str, top_k: int = 3) -> list[dict]:
        queryset = (
            Ticket.objects.filter(
                business=ticket.business,
                is_deleted=False,
                is_archived=False,
                status__in=["resolved", "closed"],
            )
            .exclude(id=ticket.id)
            .select_related("category", "department", "assigned_to")
        )
        title_terms = [term for term in (query or ticket.title or "").split() if len(term) > 3][:5]
        ticket_query = Q()
        if ticket.category_id:
            ticket_query |= Q(category_id=ticket.category_id)
        if ticket.creator_email:
            ticket_query |= Q(creator_email__iexact=ticket.creator_email)
        for term in title_terms:
            ticket_query |= Q(title__icontains=term) | Q(description__icontains=term)

        if ticket_query:
            queryset = queryset.filter(ticket_query)

        results = queryset.order_by("-updated_at")[:top_k]
        suggestions: list[dict] = []
        for item in results:
            reasons: list[str] = []
            if item.category_id and item.category_id == ticket.category_id:
                reasons.append("same category")
            if ticket.creator_email and item.creator_email and item.creator_email.lower() == ticket.creator_email.lower():
                reasons.append("same requester")
            if not reasons:
                reasons.append("similar ticket context")
            suggestions.append(
                {
                    "id": item.id,
                    "ticket_id": item.ticket_id,
                    "title": item.title,
                    "status": item.status,
                    "priority": item.priority,
                    "reason": ", ".join(reasons),
                }
            )
        return suggestions

    def search_kb(self, business_id: int | None, query: str, top_k: int = 3) -> list[dict]:
        if not business_id or not query.strip():
            return []

        try:
            results = self.kb_search.search(business_id=business_id, query=query, top_k=top_k)
        except Exception:
            results = []

        if not results:
            fallback = (
                KBArticle.objects.filter(business_id=business_id, is_public=True)
                .filter(Q(title__icontains=query) | Q(content__icontains=query))
                .order_by("-updated_at")[:top_k]
            )
            results = [
                {
                    "article_id": article.id,
                    "title": article.title,
                    "content": article.content,
                    "score": 0.25,
                }
                for article in fallback
            ]

        return [
            {
                "article_id": item["article_id"],
                "title": item["title"],
                "score": float(item.get("score") or 0.0),
                "excerpt": _strip_html(item.get("content"))[:220],
            }
            for item in results
        ]
