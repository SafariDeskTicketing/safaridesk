from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Optional

import numpy as np
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from shared.services.notification_preferences import NotificationSettingsService
from tenant.models import Ticket, TicketEmbedding
from tenant.models.TicketModel import TicketActivity, TicketComment
from users.models import Users

logger = logging.getLogger(__name__)


AUTO_MERGE_THRESHOLD = 0.90
SUGGESTION_THRESHOLD = 0.75
MAX_VECTOR_CANDIDATES = 10


@dataclass
class DuplicateMatch:
    ticket: Ticket
    score: float
    strategy: str


class DuplicateDetectionService:
    """
    Detect likely duplicate tickets for the same requester.
    Persisted pgvector ticket embeddings are preferred; lexical scoring is the fallback.
    """

    def __init__(self) -> None:
        self._embedding_service: Optional[Any] = None
        self._embedding_available = True

    def evaluate_ticket(self, ticket: Ticket) -> Optional[dict[str, Any]]:
        if self._should_skip(ticket):
            return None

        match = self._find_best_duplicate(ticket)
        if not match or match.score < SUGGESTION_THRESHOLD:
            return None

        return self._serialize_match(current=ticket, match=match, status="suggested")

    @transaction.atomic
    def process_new_ticket(self, ticket: Ticket, *, actor: Optional[Users] = None) -> Optional[dict[str, Any]]:
        if self._should_skip(ticket):
            return None

        self._ensure_ticket_embedding(ticket)
        match = self._find_best_duplicate(ticket)
        if not match or match.score < SUGGESTION_THRESHOLD:
            return None

        if match.score >= AUTO_MERGE_THRESHOLD and match.ticket.created_at <= ticket.created_at:
            primary = match.ticket
            duplicate = ticket
            self._auto_merge(
                primary=primary,
                duplicate=duplicate,
                score=match.score,
                strategy=match.strategy,
                actor=actor,
            )
            return self._serialize_match(
                current=ticket,
                match=match,
                status="auto_merged",
            )

        return self._serialize_match(current=ticket, match=match, status="suggested")

    def _should_skip(self, ticket: Ticket) -> bool:
        return (
            not ticket
            or not ticket.business_id
            or ticket.is_deleted
            or ticket.is_archived
            or ticket.is_merged
            or ticket.status == "closed"
        )

    def _find_best_duplicate(self, ticket: Ticket) -> Optional[DuplicateMatch]:
        vector_match = self._find_vector_duplicate(ticket)
        if vector_match:
            return vector_match
        return self._find_lexical_duplicate(ticket)

    def _find_vector_duplicate(self, ticket: Ticket) -> Optional[DuplicateMatch]:
        query_vec = self._ensure_ticket_embedding(ticket)
        if query_vec is None:
            return None

        identity_sql, identity_params = self._identity_sql(ticket)
        if not identity_sql:
            return None

        vector_str = self._vector_to_sql(query_vec)
        try:
            with connection.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT t.id, (1 - (e.embedding_vec <=> %s::vector)) AS score
                    FROM ticket_embeddings e
                    JOIN tickets t ON t.id = e.ticket_id
                    WHERE t.business_id = %s
                      AND t.is_archived = false
                      AND t.is_deleted = false
                      AND t.is_merged = false
                      AND t.status <> 'closed'
                      AND t.id <> %s
                      AND e.embedding_vec IS NOT NULL
                      AND ({identity_sql})
                    ORDER BY e.embedding_vec <=> %s::vector
                    LIMIT %s
                    """,
                    [vector_str, ticket.business_id, ticket.id, *identity_params, vector_str, MAX_VECTOR_CANDIDATES],
                )
                rows = cur.fetchall()
        except Exception as exc:  # noqa: BLE001
            logger.info("Ticket vector duplicate search unavailable, using fallback: %s", exc)
            return None

        if not rows:
            return None

        ticket_ids = [row[0] for row in rows]
        tickets = {
            candidate.id: candidate
            for candidate in self._candidate_queryset(ticket).filter(id__in=ticket_ids)
        }
        best: Optional[DuplicateMatch] = None
        for ticket_id, score in rows:
            candidate = tickets.get(ticket_id)
            if not candidate:
                continue
            candidate_score = round(float(score or 0.0), 4)
            if best is None or candidate_score > best.score:
                best = DuplicateMatch(ticket=candidate, score=candidate_score, strategy="pgvector")
        return best

    def _find_lexical_duplicate(self, ticket: Ticket) -> Optional[DuplicateMatch]:
        candidates = list(self._candidate_queryset(ticket))
        if not candidates:
            return None

        incoming_title = ticket.title or ""
        incoming_description = ticket.description or ""
        best_match: Optional[DuplicateMatch] = None

        for candidate in candidates:
            score = self._lexical_score(
                title_a=incoming_title,
                description_a=incoming_description,
                title_b=candidate.title or "",
                description_b=candidate.description or "",
            )
            if best_match is None or score > best_match.score:
                best_match = DuplicateMatch(ticket=candidate, score=score, strategy="lexical")

        return best_match

    def _candidate_queryset(self, ticket: Ticket):
        identity_filter = Q()
        if ticket.contact_id:
            identity_filter |= Q(contact_id=ticket.contact_id)
        if ticket.creator_email:
            identity_filter |= Q(creator_email__iexact=ticket.creator_email.strip())
        if ticket.creator_phone:
            identity_filter |= Q(creator_phone=ticket.creator_phone.strip())

        if not identity_filter:
            return Ticket.objects.none()

        return (
            Ticket.objects.filter(
                business_id=ticket.business_id,
                is_archived=False,
                is_deleted=False,
                is_merged=False,
            )
            .exclude(status="closed")
            .exclude(id=ticket.id)
            .filter(identity_filter)
            .select_related("assigned_to", "department", "created_by")
            .prefetch_related("watchers__watcher")
        )

    def _identity_sql(self, ticket: Ticket) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if ticket.contact_id:
            clauses.append("t.contact_id = %s")
            params.append(ticket.contact_id)
        if ticket.creator_email:
            clauses.append("LOWER(t.creator_email) = %s")
            params.append(ticket.creator_email.strip().lower())
        if ticket.creator_phone:
            clauses.append("t.creator_phone = %s")
            params.append(ticket.creator_phone.strip())
        return " OR ".join(clauses), params

    def _auto_merge(
        self,
        *,
        primary: Ticket,
        duplicate: Ticket,
        score: float,
        strategy: str,
        actor: Optional[Users],
    ) -> None:
        if primary.id == duplicate.id:
            return

        locked = {
            ticket.id: ticket
            for ticket in Ticket.objects.select_for_update().filter(id__in=[primary.id, duplicate.id])
        }
        primary = locked.get(primary.id, primary)
        duplicate = locked.get(duplicate.id, duplicate)
        if (
            primary.id == duplicate.id
            or primary.business_id != duplicate.business_id
            or primary.is_merged
            or duplicate.is_merged
            or duplicate.status == "closed"
        ):
            return

        resolved_actor = self._resolve_actor(actor, primary.business_id)
        note = (
            f"AI duplicate detection auto-merged #{duplicate.ticket_id} into #{primary.ticket_id} "
            f"(score {score:.2f} via {strategy})."
        )

        if duplicate.description or duplicate.title:
            TicketComment.objects.create(
                ticket=primary,
                author=duplicate.created_by or resolved_actor,
                content=self._build_primary_comment(duplicate, score, strategy),
                is_internal=False,
            )

        old_status = duplicate.status
        duplicate.is_merged = True
        duplicate.merged_into = primary
        duplicate.merged_by = resolved_actor
        duplicate.merged_at = timezone.now()
        duplicate.merge_note = note
        duplicate.status = "closed"
        duplicate.resolved_at = timezone.now()
        duplicate.is_sla_paused = True
        duplicate.save(
            update_fields=[
                "is_merged",
                "merged_into",
                "merged_by",
                "merged_at",
                "merge_note",
                "status",
                "resolved_at",
                "is_sla_paused",
            ]
        )

        if resolved_actor:
            TicketActivity.objects.create(
                ticket=duplicate,
                user=resolved_actor,
                activity_type="status_changed",
                description=f"Ticket auto-merged into {primary.ticket_id}",
                old_value=old_status,
                new_value="closed",
            )
            TicketActivity.objects.create(
                ticket=primary,
                user=resolved_actor,
                activity_type="updated",
                description=note,
                old_value="",
                new_value="merged",
            )

        primary_id = primary.id
        duplicate_id = duplicate.id
        transaction.on_commit(lambda: self._notify_auto_merge_safely(primary_id, duplicate_id, note))

    def _notify_auto_merge_safely(self, primary_id: int, duplicate_id: int, note: str) -> None:
        try:
            primary = (
                Ticket.objects.select_related("assigned_to", "department", "created_by")
                .prefetch_related("watchers__watcher")
                .get(id=primary_id)
            )
            duplicate = (
                Ticket.objects.select_related("assigned_to", "department", "created_by")
                .prefetch_related("watchers__watcher")
                .get(id=duplicate_id)
            )
            self._notify_auto_merge(primary=primary, duplicate=duplicate, note=note)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Duplicate auto-merge notifications failed: %s", exc)

    def _notify_auto_merge(self, *, primary: Ticket, duplicate: Ticket, note: str) -> None:
        recipients = self._dedupe_users(
            [
                *self._collect_ticket_users(primary),
                *self._collect_ticket_users(duplicate),
            ]
        )
        if recipients:
            NotificationSettingsService.notify_many(
                users=recipients,
                ticket=primary,
                message=f"Duplicate ticket #{duplicate.ticket_id} was merged into #{primary.ticket_id}",
                notification_type="ticket_status_changed",
                metadata={
                    "activity_type": "duplicate_auto_merged",
                    "merged_ticket": duplicate.ticket_id,
                    "merged_into": primary.ticket_id,
                    "note": note,
                },
            )

        emails = self._collect_ticket_emails(primary) | self._collect_ticket_emails(duplicate)
        for email in emails:
            try:
                from shared.workers.Ticket import _send_ticket_notification
                _send_ticket_notification(primary.id, "NEW_ACTIVITY_NOTICE", email)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to send duplicate merge email to %s: %s", email, exc)

    def _collect_ticket_users(self, ticket: Ticket) -> list[Users]:
        users: list[Users] = []
        if ticket.assigned_to:
            users.append(ticket.assigned_to)
        if ticket.created_by:
            users.append(ticket.created_by)
        for watcher in ticket.watchers.all():
            if watcher.watcher:
                users.append(watcher.watcher)
        if ticket.department:
            users.extend(list(ticket.department.get_members()))
        return users

    def _collect_ticket_emails(self, ticket: Ticket) -> set[str]:
        emails = set()
        if ticket.creator_email:
            emails.add(ticket.creator_email)
        if ticket.assigned_to and ticket.assigned_to.email:
            emails.add(ticket.assigned_to.email)
        if ticket.department:
            for member in ticket.department.get_members():
                if member.email:
                    emails.add(member.email)
        for watcher in ticket.watchers.all():
            if watcher.watcher and watcher.watcher.email:
                emails.add(watcher.watcher.email)
        return {email for email in emails if email}

    def _dedupe_users(self, users: list[Users]) -> list[Users]:
        unique: list[Users] = []
        seen: set[int] = set()
        for user in users:
            if not user or not user.id or user.id in seen:
                continue
            seen.add(user.id)
            unique.append(user)
        return unique

    def _resolve_actor(self, actor: Optional[Users], business_id: Optional[int]) -> Optional[Users]:
        if actor and getattr(actor, "id", None):
            return actor
        try:
            return Users.objects.filter(email="system@safaridesk.io", business_id=business_id).first()
        except Exception:  # noqa: BLE001
            return None

    def _build_primary_comment(self, duplicate: Ticket, score: float, strategy: str) -> str:
        comment_parts = [
            f"Duplicate ticket auto-detected from #{duplicate.ticket_id} (score {score:.2f} via {strategy}).",
        ]
        if duplicate.title:
            comment_parts.append(f"Subject: {duplicate.title}")
        if duplicate.description:
            comment_parts.append(duplicate.description)
        return "\n\n".join(comment_parts)

    def _serialize_match(self, *, current: Ticket, match: DuplicateMatch, status: str) -> dict[str, Any]:
        if match.ticket.created_at <= current.created_at:
            primary = match.ticket
            duplicate = current
            recommended_action = "merge_current_into_primary"
        else:
            primary = current
            duplicate = match.ticket
            recommended_action = "merge_suggested_into_current"

        return {
            "status": status,
            "score": round(match.score, 4),
            "strategy": match.strategy,
            "recommended_action": recommended_action,
            "primary_ticket": self._ticket_payload(primary),
            "duplicate_ticket": self._ticket_payload(duplicate),
            # Backward compatibility for the first frontend patch.
            "ticket": self._ticket_payload(primary),
            "merged_ticket": self._ticket_payload(duplicate) if status == "auto_merged" else None,
        }

    def _ticket_payload(self, ticket: Ticket) -> dict[str, Any]:
        return {
            "id": ticket.id,
            "ticket_id": ticket.ticket_id,
            "title": ticket.title,
        }

    def _compose_text(self, title: str, description: str) -> str:
        return "\n".join(part.strip() for part in [title, description] if part and part.strip())

    def _normalize_text(self, value: str) -> str:
        lowered = (value or "").lower()
        lowered = re.sub(r"<[^>]+>", " ", lowered)
        lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
        return re.sub(r"\s+", " ", lowered).strip()

    def _lexical_score(self, *, title_a: str, description_a: str, title_b: str, description_b: str) -> float:
        title_a_normalized = self._normalize_text(title_a)
        title_b_normalized = self._normalize_text(title_b)
        combined_a = self._normalize_text(self._compose_text(title_a, description_a))
        combined_b = self._normalize_text(self._compose_text(title_b, description_b))

        title_ratio = SequenceMatcher(None, title_a_normalized, title_b_normalized).ratio()
        combined_ratio = SequenceMatcher(None, combined_a, combined_b).ratio()

        tokens_a = set(combined_a.split())
        tokens_b = set(combined_b.split())
        token_overlap = 0.0
        union = tokens_a | tokens_b
        if union:
            token_overlap = len(tokens_a & tokens_b) / len(union)

        return round((0.45 * title_ratio) + (0.4 * combined_ratio) + (0.15 * token_overlap), 4)

    def _ensure_ticket_embedding(self, ticket: Ticket) -> Optional[np.ndarray]:
        try:
            existing = ticket.embedding
        except TicketEmbedding.DoesNotExist:
            existing = None
        if existing and existing.embedding:
            return np.array(existing.embedding, dtype=float)

        text = self._compose_text(ticket.title or "", ticket.description or "")
        if not text:
            return None

        vector = self._embed_text(text)
        if vector is None:
            return None

        try:
            embedding, _ = TicketEmbedding.objects.update_or_create(
                ticket=ticket,
                defaults={
                    "business": ticket.business,
                    "embedding": vector.tolist(),
                    "embedding_model": self._embedding_service.model if self._embedding_service else "gemini-embedding-001",
                },
            )
            self._persist_vector_column(embedding.id, vector)
        except Exception as exc:  # noqa: BLE001
            logger.info("Could not persist ticket embedding for %s: %s", ticket.id, exc)
        return vector

    def _persist_vector_column(self, embedding_id: int, vector: np.ndarray) -> None:
        vector_str = self._vector_to_sql(vector)
        try:
            with connection.cursor() as cur:
                cur.execute(
                    "UPDATE ticket_embeddings SET embedding_vec = %s::vector WHERE id = %s",
                    [vector_str, embedding_id],
                )
        except Exception as exc:  # noqa: BLE001
            logger.info("Could not persist ticket pgvector column for embedding %s: %s", embedding_id, exc)

    def _embed_text(self, text: str) -> Optional[np.ndarray]:
        if not text or not self._embedding_available:
            return None

        try:
            if self._embedding_service is None:
                from tenant.services.ai.embedding_service import EmbeddingService
                self._embedding_service = EmbeddingService()
            vector = self._embedding_service._embed_text(text)
            return np.array(vector, dtype=float)
        except Exception as exc:  # noqa: BLE001
            self._embedding_available = False
            logger.info("Duplicate detection embedding fallback engaged: %s", exc)
            return None

    def _vector_to_sql(self, vector: np.ndarray) -> str:
        return "[" + ",".join(str(float(value)) for value in vector) + "]"
