import logging
import os
import uuid
from datetime import datetime, timedelta

from django.db.utils import IntegrityError
from django.db import transaction
from django.forms import ValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, DurationField, ExpressionWrapper, F
from RNSafarideskBack import settings
from tenant.models import Ticket, TicketCategories, Department, TicketAttachment, Task
from tenant.models.SlaXModel import SLA
from tenant.models.TicketModel import TicketComment, CommentReply, TicketReopen
from tenant.serializers.LabelSerializer import LabelAssignmentSerializer
from tenant.serializers.TicketSerializer import TicketAddComment, TicketAssign, TicketCategorySerializer, \
    TicketSerializer, TicketUpdateStatus, TicketsList, TicketAddWatchers, TicketAddTags, TicketCategoryUpdateSerializer, \
    TicketMergeRequestSerializer
from tenant.serializers.EmailMessageRecordSerializer import EmailMessageRecordSerializer
from tenant.services.labels import apply_label_filter, parse_label_ids
from users.models import Users
from util.Constants import PRIORITY_DURATION
from shared.services.notification_preferences import NotificationSettingsService
from shared.workers.Ticket import ticket_transfer_notification
from tenant.services.contact_linker import link_or_create_contact
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService
from tenant.services.tickets.naming import (
    generate_ticket_id,
    render_ticket_title,
)

# --- Extracted service modules (see tenant/services/tickets/) ---
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.shared import (
    parse_date_input,
    sanitize_text_for_mysql,
)
from tenant.services.tickets import (
    activity_stream as activity_stream_service,
    assignment as assignment_service,
    attachments as attachments_service,
    bulk_actions as bulk_actions_service,
    call_logs as call_logs_service,
    comment_reactions as comment_reactions_service,
    comments as comments_service,
    config as config_service,
    email_reply as email_reply_service,
    export as export_service,
    field_updates as field_updates_service,
    labels as labels_service,
    merge as merge_service,
    queries as queries_service,
    sla as sla_service,
    status_transitions as status_transitions_service,
    watchers as watchers_service,
)
from tenant.services.tickets.labels import (
    _get_active_business_labels,
    _get_existing_business_labels_by_names,
    _serialize_labels,
    _set_ticket_labels,
)
from tenant.services.tickets.queries import _apply_ticket_ordering
from tenant.services.tickets.attachments import _build_storage_paths
from tenant.services.tickets.email_reply import _parse_ai_email_draft

logger = logging.getLogger(__name__)

TICKET_TITLE_SUMMARY_MAX_LENGTH = 120
TICKET_TITLE_MAX_LENGTH = 200


class TicketPagination(PageNumberPagination):
    page_size = 12  # default items per page
    page_size_query_param = 'page_size'  # allow overriding via ?page_size=XX (optional)
    max_page_size = 100

class TicketCategoryView(viewsets.ModelViewSet):
    serializer_class = TicketCategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination

    def get_queryset(self):
        return TicketCategories.objects.for_business()

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return TicketCategoryUpdateSerializer
        return TicketCategorySerializer

    def create(self, request, *args, **kwargs):
        """Create a new ticket category"""
        name = (request.data.get("name") or "").strip()
        description = (request.data.get("description") or "").strip()
        department_id = request.data.get("department")

        if not name:
            return Response({
                "message": "Category name is required",
            }, status=status.HTTP_400_BAD_REQUEST)

        if not description:
            return Response({
                "message": "Category description is required",
            }, status=status.HTTP_400_BAD_REQUEST)

        # Enforce one category name per business (case-insensitive).
        if TicketCategories.objects.filter(
            business=request.user.business,
            name__iexact=name,
        ).exists():
            return Response({
                "message": "Ticket category exists",
            }, status=status.HTTP_409_CONFLICT)

        try:
            category = TicketCategories.objects.create(
                name=name,
                description=description,
                department_id=department_id if department_id else None,
                business=request.user.business,
                created_by=request.user,
            )
            log_audit_event(
                request,
                event_type="CATEGORY_CREATED",
                entity_type="category",
                entity=category,
                activity=f"{actor_name(request.user)} created ticket category '{category.name}'",
                metadata={"department_id": department_id},
            )
        except IntegrityError:
            return Response({
                "message": "Ticket category exists",
            }, status=status.HTTP_409_CONFLICT)

        return Response({
            "message": "Ticket category created successfully",
        }, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        """List all ticket categories, optionally filtered by department"""
        queryset = self.get_queryset()

        # Filter by department if provided
        department_id = request.query_params.get('department')
        if department_id:
            queryset = queryset.filter(department_id=department_id)

        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # Unpaginated response
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


    def retrieve(self, request, pk=None, *args, **kwargs):
        """Get a specific ticket category by ID"""
        instance = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = self.get_serializer(instance)
        return Response({
            "message": "Ticket category retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def update(self, request, pk=None, *args, **kwargs):
        """Update a ticket category"""
        instance = get_object_or_404(self.get_queryset(), pk=pk)
        before = {
            "name": instance.name,
            "description": instance.description,
            "department_id": instance.department_id,
        }
        serializer = self.get_serializer(instance, data=request.data, partial=True)

        if serializer.is_valid():
            incoming_name = serializer.validated_data.get("name")
            if incoming_name and TicketCategories.objects.filter(
                business=request.user.business,
                name__iexact=incoming_name.strip(),
            ).exclude(pk=instance.pk).exists():
                return Response({
                    "message": "Ticket category exists",
                    "errors": {"name": ["Category name must be unique per business."]},
                }, status=status.HTTP_409_CONFLICT)

            try:
                category = serializer.save()
            except IntegrityError:
                return Response({
                    "message": "Ticket category exists",
                    "errors": {"name": ["Category name must be unique per business."]},
                }, status=status.HTTP_409_CONFLICT)
            after = {
                "name": category.name,
                "description": category.description,
                "department_id": category.department_id,
            }
            changed = {
                field: {"old_value": old_value, "new_value": after[field]}
                for field, old_value in before.items()
                if old_value != after[field]
            }
            if changed:
                log_audit_event(
                    request,
                    event_type="CATEGORY_UPDATED",
                    entity_type="category",
                    entity=category,
                    activity=f"{actor_name(request.user)} updated ticket category '{category.name}'",
                    metadata={"changes": changed},
                )
            return Response({
                "message": "Ticket category updated successfully",
                "data": serializer.data
            }, status=status.HTTP_200_OK)

        return Response({
            "message": "Validation failed",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


    def destroy(self, request, pk=None, *args, **kwargs):
        """Hard delete a ticket category"""
        instance = get_object_or_404(self.get_queryset(), pk=pk)
        category_name = instance.name
        with transaction.atomic():
            instance.delete()
            log_audit_event(
                request,
                event_type="CATEGORY_DELETED",
                entity_type="category",
                entity=instance,
                activity=f"{actor_name(request.user)} deleted ticket category '{category_name}'",
                metadata={},
                business=request.user.business,
            )
        return Response({
            "message": "Ticket category deleted successfully"
        }, status=status.HTTP_200_OK)

class TicketView(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    pagination_class = TicketPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Defense in depth: scopes the default ModelViewSet actions (retrieve/update/
        # partial_update/destroy) to the requester's business. No current URL routes to
        # these default actions (see tenant/routes/ticket.py), but the unscoped class-level
        # `queryset` above is a landmine for the next route added without scoping in mind.
        return Ticket.objects.for_business()

    def get_serializer_class(self):
        if self.action == 'assign':
            return TicketAssign
        if self.action == 'merge':
            return TicketMergeRequestSerializer

        if self.action in ['list', 'read_by_ticket_id', 'my_tickets', 'my_customer_tickets', 'profile_ticket_counts']:
            return TicketsList

        if self.action == 'update_status':
            return TicketUpdateStatus
        if self.action == 'add_comment':
            return TicketAddComment
        if self.action == 'add_ticket_watchers':
            return TicketAddWatchers
        if self.action == 'add_ticket_tags':
            return TicketAddTags
        if self.action == 'update_labels':
            return LabelAssignmentSerializer
        return TicketSerializer

    def loadActivityStream(self, request, *args, **kwargs):
        id = kwargs.get('id')
        try:
            all_activities = activity_stream_service.load_activity_stream(ticket_id=id, user=request.user)
        except Ticket.DoesNotExist:
            return Response({
                "error": "Ticket not found"
            }, status=status.HTTP_404_NOT_FOUND)

        return Response(all_activities)

    def loadAttachments(self, request, *args, **kwargs):
        id = kwargs.get('id')
        try:
            unique_urls = attachments_service.load_attachments(ticket_id=id, user=request.user)
        except Ticket.DoesNotExist:
            return Response({
                "error": "Ticket not found"
            }, status=status.HTTP_404_NOT_FOUND)

        return Response(unique_urls, status=status.HTTP_200_OK)

    def loadTasks(self, request, *args, **kwargs):
        id = kwargs.get('id')

        try:
            ticket = Ticket.objects.select_related(
                'category',
                'department',
                'assigned_to'
            ).prefetch_related(
                'comments__author',
                'comments__attachment',
                'attachments',
                'activities__user'
            ).get(
                id=id,
                business=request.user.business
            )
        except Ticket.DoesNotExist:
            return Response({
                "error": "Ticket not found"
            }, status=status.HTTP_404_NOT_FOUND)

        # Get tasks linked to this ticket
        tasks = Task.objects.prefetch_related(
            'attachments',
            'comments__attachment',
            'comments__author'
        ).filter(
            linked_ticket=ticket,
            is_archived=False,
            is_deleted=False,
        )

        tasks_data = []

        for task in tasks:
            # Task-level attachments
            task_attachments = [att.file_url for att in task.attachments.all()]

            # Task comments with their attachments
            comments_data = []
            for comment in task.comments.all():
                comment_attachments = [a.file_url for a in comment.attachment.all()]
                comments_data.append({
                    "id": comment.id,
                    "content": comment.content,
                    "author": comment.author.full_name() if comment.author else "Anonymous",
                    "created_at": comment.created_at,
                    "attachments": comment_attachments
                })

            tasks_data.append({
                "id": task.id,
                "task_trackid": task.task_trackid,
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "status": task.task_status,
                "assigned_to": task.assigned_to.full_name() if task.assigned_to else None,
                "due_date": task.due_date,
                "completed_at": task.completed_at,
                "attachments": task_attachments,
                "comments": comments_data
            })

        return Response(tasks_data)

    def getSla(self, request, *args, **kwargs):
        """
        Get comprehensive SLA details for a specific ticket.
        """
        try:
            response_data = sla_service.get_sla(ticket_id=kwargs.get("id"))
            return Response(response_data, status=status.HTTP_200_OK)
        except Ticket.DoesNotExist:
            return Response({
                "message": "Ticket not found."
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error retrieving SLA details for ticket ID {kwargs.get('id')}: {str(e)}")
            return Response({
                "message": "An error occurred while retrieving SLA details.",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def read_by_ticket_id(self, request, *args, **kwargs):
        ticket_id = str(kwargs.get('ticket_id') or '').strip()
        lookup = Q(ticket_id=ticket_id)
        if ticket_id.isdigit():
            lookup |= Q(id=int(ticket_id))
        try:
            ticket = Ticket.objects.select_related(
                'category',
                'department',
                'assigned_to'
            ).prefetch_related(
                'labels',
                'comments__author',
                'comments__attachment',
                'attachments',
                'activities__user',
                'email_messages',
            ).get(lookup, business=request.user.business)

            # Apply department-based visibility restrictions for non-admin agents
            user = request.user
            if user.role and user.role.name == 'agent':
                # Check if the agent belongs to the ticket's department
                agent_departments = user.department.all()
                if ticket.department not in agent_departments:
                    return Response({
                        "error": "You do not have permission to view this ticket"
                    }, status=status.HTTP_403_FORBIDDEN)

        except Ticket.DoesNotExist:
            return Response({"error": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)
        except Ticket.MultipleObjectsReturned:
            logger.error(
                "Duplicate ticket_id detected: %s for business %s — data integrity violation",
                ticket_id, request.user.business_id,
            )
            return Response({
                "error": "Duplicate ticket reference detected. Contact support.",
                "ticket_id": ticket_id,
            }, status=status.HTTP_409_CONFLICT)

        # Mark ticket as opened and clear new reply badge
        update_fields = []
        if not ticket.is_opened:
            ticket.is_opened = True
            update_fields.append('is_opened')
        if ticket.has_new_reply:
            ticket.has_new_reply = False
            update_fields.append('has_new_reply')
        if update_fields:
            ticket.save(update_fields=update_fields)


        # Calculate SLA status based on first response and resolution dates
        sla_status = ticket.get_sla_status()
        breached = False

        if sla_status and sla_status.get('has_sla'):
            current_time = timezone.now()

            # If ticket is resolved or closed, SLA is not breached
            if ticket.status in ('closed', 'resolved'):
                breached = False
            else:
                # Check first response status
                first_response_info = sla_status.get('first_response', {})
                if first_response_info.get('due_time'):
                    if ticket.first_response_at:
                        # First response has been made - check resolution status
                        resolution_info = sla_status.get('resolution', {})
                        if (resolution_info.get('due_time') and
                            current_time > resolution_info['due_time']):
                            breached = True
                    elif current_time > first_response_info['due_time']:
                        # First response is overdue and not yet responded to
                        breached = True

        ticket_data = {
            "id": ticket.id,
            "ticket_id": ticket.ticket_id,
            "title": ticket.title,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "source": ticket.source,
            "created_at": ticket.created_at,
            "updated_at": ticket.updated_at,
            "due_date": ticket.calculate_sla_due_times()['resolution_due'] if ticket.calculate_sla_due_times() else None,
            "resolved_at": ticket.resolved_at,
            "is_public": ticket.is_public,
            "labels": _serialize_labels(ticket.labels.all()),
            "tags": list(ticket.labels.order_by("name").values_list("name", flat=True)),
            "breached": breached,
            "csat_score": ticket.csat_score,
            # "is_overdue": helper.format_datetime(ticket.is_overdue),


            #
            # Creator information
            "creator_name": ticket.creator_name,
            "creator_email": ticket.creator_email,
            "creator_phone": ticket.creator_phone,
            "contact": {
                "id": ticket.contact.id,
                "name": ticket.contact.name,
                "email": ticket.contact.email or "",
                "phone": ticket.contact.phone or "",
                "is_active": ticket.contact.is_active,
            } if ticket.contact else None,

            # Email messages
            "email_messages": EmailMessageRecordSerializer(ticket.email_messages.all(), many=True).data,

            # Related objects
            "category": {
                "id": ticket.category.id,
                "name": ticket.category.name,
                "description": ticket.category.description
            } if ticket.category else None,

            "department": {
                "id": ticket.department.id,
                "name": getattr(ticket.department, 'name', 'N/A')
            } if ticket.department else None,

            "assigned_to": {
                "id": ticket.assigned_to.id,
                "name": ticket.assigned_to.get_full_name(),
                "email": ticket.assigned_to.email,
                "avatar": ticket.assigned_to.avatar_url,
                "is_active": ticket.assigned_to.is_active,
            } if ticket.assigned_to else None,
            "is_merged": ticket.is_merged,
            "merged_into": {
                "id": ticket.merged_into.id,
                "ticket_id": ticket.merged_into.ticket_id,
                "title": ticket.merged_into.title,
            } if ticket.merged_into else None,
            "merged_children": [
                {
                    "id": child.id,
                    "ticket_id": child.ticket_id,
                    "title": child.title,
                } for child in ticket.merged_children.all()
            ] if hasattr(ticket, "merged_children") else [],
            "potential_duplicate": None,
        }

        if not ticket.is_merged and ticket.status != 'closed':
            ticket_data["potential_duplicate"] = DuplicateDetectionService().evaluate_ticket(ticket)

        # Add linked tasks count
        from tenant.models import Task
        ticket_data['linked_tasks_count'] = Task.objects.filter(
            linked_ticket=ticket,
            status='A'
        ).count()

        # Add unread activity count for current user
        from tenant.models import ActivityReadStatus
        activity_ids = ticket.activities.values_list('id', flat=True)
        read_activity_ids = ActivityReadStatus.objects.filter(
            activity_id__in=activity_ids,
            user=request.user
        ).values_list('activity_id', flat=True)
        ticket_data['unread_activity_count'] = len(activity_ids) - len(read_activity_ids)


        # Compile final response
        response_data = {
            "ticket": ticket_data,
        }

        return Response(response_data, status=status.HTTP_200_OK)

    def list(self, request, *args, **kwargs):
        """List all tickets, optionally without pagination and with view-based filtering"""
        view = request.query_params.get('view', None)
        queryset = Ticket.objects.for_business().prefetch_related('labels')

        # Apply department-based visibility restrictions for non-admin agents
        user = request.user
        if user.role and user.role.name == 'agent':
            # Get all departments the agent belongs to
            agent_departments = user.department.all()
            # Filter tickets to only show those in the agent's departments
            queryset = queryset.filter(department__in=agent_departments)

        # Exclude archived, deleted, and merged tickets from normal views
        if view not in ['archived', 'trash', 'merged']:
            queryset = queryset.filter(is_archived=False, is_deleted=False, is_merged=False)

        status_filter_param = request.query_params.get('status')
        if view:
            # View names now match the count keys in ticket_counts endpoint
            if view == 'all_unresolved':
                # Only exclude closed/resolved if no explicit status filter is set —
                # a status filter of 'closed' or 'resolved' must take precedence.
                if not status_filter_param or status_filter_param == 'all':
                    queryset = queryset.exclude(status__in=['closed', 'resolved']).filter(is_merged=False)
                else:
                    queryset = queryset.filter(is_merged=False)
            elif view == 'all_tickets':
                queryset = queryset.filter(is_merged=False)
            elif view == 'all_unassigned':
                queryset = queryset.filter(assigned_to__isnull=True, is_merged=False)
            elif view == 'all_resolved':
                queryset = queryset.filter(status__in=['closed', 'resolved'], is_merged=False)
            elif view == 'my_overdue':
                queryset = queryset.filter(assigned_to=request.user, due_date__lt=timezone.now(), is_merged=False).exclude(status__in=['closed', 'resolved'])
            elif view == 'my_due_today':
                today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
                today_end = today_start + timedelta(days=1)
                queryset = queryset.filter(
                    assigned_to=request.user,
                    due_date__gte=today_start,
                    due_date__lt=today_end,
                    is_merged=False,
                ).exclude(status__in=['closed', 'resolved'])
            elif view == 'my_unresolved':
                queryset = queryset.filter(assigned_to=request.user, is_merged=False).exclude(status__in=['closed', 'resolved'])
            elif view == 'my_resolved':
                queryset = queryset.filter(assigned_to=request.user, status__in=['closed', 'resolved'], is_merged=False)
            elif view == 'requested_by_me':
                queryset = queryset.filter(created_by=request.user, is_merged=False)
            elif view == 'sla_breached':
                # This is inefficient. A better approach is needed for production.
                breached_tickets = [ticket.id for ticket in queryset.filter(is_merged=False) if ticket.is_sla_breached]
                queryset = queryset.filter(id__in=breached_tickets)
            elif view == 'slow_queues':
                queryset = queryset.filter(status__in=['closed', 'resolved'], resolved_at__isnull=False, is_merged=False).annotate(
                    resolution_duration=ExpressionWrapper(
                        F('resolved_at') - F('created_at'),
                        output_field=DurationField(),
                    )
                ).order_by('-resolution_duration', '-resolved_at')
            elif view == 'reopened':
                # Tickets that have been reopened (have at least one TicketReopen record)
                reopened_ticket_ids = TicketReopen.objects.filter(
                    ticket__business=request.user.business
                ).values_list('ticket_id', flat=True).distinct()
                queryset = queryset.filter(id__in=reopened_ticket_ids, is_merged=False)
            elif view == 'archived':
                # Archived tickets: is_archived=True AND is_deleted=False
                queryset = queryset.filter(is_archived=True, is_deleted=False)
            elif view == 'trash':
                # Trash/Deleted tickets: is_deleted=True (regardless of is_archived)
                queryset = queryset.filter(is_deleted=True)
            elif view == 'merged':
                queryset = queryset.filter(is_merged=True)

        # Apply search filter
        search_query = request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(ticket_id__icontains=search_query) |
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(creator_name__icontains=search_query) |
                Q(creator_email__icontains=search_query)
            )

        # Apply individual field filters
        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'all':
            if status_filter in ['closed', 'resolved']:
                queryset = queryset.filter(status__in=['closed', 'resolved'])
            else:
                queryset = queryset.filter(status=status_filter)

        priority_filter = request.query_params.get('priority')
        if priority_filter and priority_filter != 'all':
            queryset = queryset.filter(priority=priority_filter)

        assigned_to_filter = request.query_params.get('assigned_to')
        if assigned_to_filter:
            if assigned_to_filter == 'unassigned':
                queryset = queryset.filter(assigned_to__isnull=True)
            elif assigned_to_filter != 'all':
                queryset = queryset.filter(assigned_to_id=assigned_to_filter)

        department_filter = request.query_params.get('department')
        if department_filter and department_filter != 'all':
            queryset = queryset.filter(department_id=department_filter)

        category_filter = request.query_params.get('category')
        if category_filter and category_filter != 'all':
            queryset = queryset.filter(category_id=category_filter)

        label_ids = parse_label_ids(request.query_params.get('label_ids'))
        queryset = apply_label_filter(queryset, label_ids)

        # Date range filters
        date_from = request.query_params.get('date_from')
        if date_from:
            from_date = parse_date_input(date_from)
            if from_date:
                queryset = queryset.filter(created_at__date__gte=from_date)

        date_to = request.query_params.get('date_to')
        if date_to:
            to_date = parse_date_input(date_to)
            if to_date:
                queryset = queryset.filter(created_at__date__lte=to_date)

        sort_by = request.query_params.get('sort_by')
        sort_direction = request.query_params.get('sort_direction')
        queryset = _apply_ticket_ordering(
            queryset,
            sort_by,
            sort_direction,
            preserve_existing=view == 'slow_queues' and not sort_by,
        )

        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # Unpaginated fallback
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def ticket_counts(self, request, *args, **kwargs):
        """Return counts of tickets for the sidebar views, applying all filters from query params."""
        counts = queries_service.ticket_counts(user=request.user, query_params=request.query_params)
        return Response(counts, status=status.HTTP_200_OK)

    def my_tickets(self, request, *args, **kwargs):
        """List all tickets for user (by departments or as watcher), optionally without pagination"""
        queryset = queries_service.my_tickets_queryset(user=request.user, query_params=request.query_params)

        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # Unpaginated fallback
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def my_customer_tickets(self, request, *args, **kwargs):
        """List all tickets for the authenticated user, with optional pagination and search"""
        queryset = queries_service.my_customer_tickets_queryset(user=request.user, query_params=request.query_params)

        # Handle pagination
        pagination = request.query_params.get('pagination', 'yes').lower()
        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # Unpaginated fallback
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def profile_ticket_counts(self, request, *args, **kwargs):
        """Return counts of tickets and tasks assigned to or completed by the authenticated user"""
        return Response(queries_service.profile_ticket_counts(user=request.user), status=status.HTTP_200_OK)

    def my_customer_dashboard(self, request, *args, **kwargs):
        """List all tickets, optionally without pagination"""
        return Response(queries_service.my_customer_dashboard(user=request.user), status=status.HTTP_200_OK)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        try:
            # Extract data from request
            print(request.data)

            raw_title = request.data.get('title')
            creator_name = request.data.get('creator_name')
            creator_phone = request.data.get('creator_phone')
            creator_email = request.data.get('creator_email')
            description = request.data.get('description')
            # DB-safe: strip 4-byte characters (e.g. emojis) for MySQL setups that don't support utf8mb4
            description = sanitize_text_for_mysql(description) if description else description
            # Accept both legacy keys (category/department) and frontend keys (category_id/department_id)
            category_id = request.data.get('category') or request.data.get('category_id')
            department_id = request.data.get('department') or request.data.get('department_id')

            priority = request.data.get('priority')
            if not priority:
                priority = 'medium'  # Fallback

            customer_tier = request.data.get('customer_tier', 'standard')  # Add customer tier
            source = request.data.get('source', 'web')  # Add source field with default 'web'
            is_public = True if str(request.data.get('is_public')).lower() == 'true' else False
            assignee_id = request.data.get('assignee_id')
            raw_tags = []
            try:
                raw_tags = request.data.getlist('tags[]')
            except Exception:
                pass
            if not raw_tags and 'tags' in request.data:
                maybe_tags = request.data.get('tags')
                if isinstance(maybe_tags, list):
                    raw_tags = maybe_tags
                elif isinstance(maybe_tags, str):
                    raw_tags = [t.strip() for t in maybe_tags.split(',') if t.strip()]
            raw_label_ids = []
            try:
                raw_label_ids = request.data.getlist('label_ids[]')
            except Exception:
                pass
            if not raw_label_ids and 'label_ids' in request.data:
                maybe_label_ids = request.data.get('label_ids')
                if isinstance(maybe_label_ids, list):
                    raw_label_ids = maybe_label_ids
                elif isinstance(maybe_label_ids, str):
                    raw_label_ids = [item.strip() for item in maybe_label_ids.split(',') if item.strip()]
            label_ids = parse_label_ids(raw_label_ids)

            created_by = None

            # Validate required fields
            if not all([raw_title, category_id, department_id, priority]):
                return Response({
                    "message": "Missing required fields: title, category, department, or priority"
                }, status=status.HTTP_400_BAD_REQUEST)
            raw_title = str(raw_title).strip()
            if len(raw_title) > TICKET_TITLE_SUMMARY_MAX_LENGTH:
                return Response({
                    "message": f"Ticket title is too long. Maximum {TICKET_TITLE_SUMMARY_MAX_LENGTH} characters allowed."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Generate ticket ID and formatted title using shared naming rules.
            ticket_id = generate_ticket_id(business=request.user.business)
            title = render_ticket_title(
                summary=raw_title,
                ticket_id=ticket_id,
                source=source,
                business=request.user.business,
                max_length=None,
            )
            if len(title) > TICKET_TITLE_MAX_LENGTH:
                return Response({
                    "message": f"Formatted ticket title is too long. Please shorten the title to fit within {TICKET_TITLE_MAX_LENGTH} characters."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate customer tier
            valid_tiers = ['premium', 'standard', 'basic']
            if customer_tier not in valid_tiers:
                return Response({
                    "message": f"Invalid customer tier. Must be one of: {', '.join(valid_tiers)}"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get category and department objects
            try:
                category = get_object_or_404(TicketCategories, id=category_id, business=request.user.business)
            except Http404:
                return Response({
                    "message": f"Category with id {category_id} not found"
                }, status=status.HTTP_404_NOT_FOUND)

            try:
                department = get_object_or_404(Department, id=department_id, business=request.user.business)
            except Http404:
                return Response({
                    "message": f"Department with id {department_id} not found"
                }, status=status.HTTP_404_NOT_FOUND)

            # Check if user already exists
            if creator_email:
                try:
                    existing_user = Users.objects.filter(
                        email=creator_email,
                        business=request.user.business
                    ).first()
                    if existing_user:
                        created_by = existing_user
                except Exception as e:
                    # Fallback to create a customer
                    logger.warning(f"Error checking existing user: {str(e)}")


            # Optional assignee lookup (must belong to business)
            assigned_agent = None
            if assignee_id not in [None, '', 'null']:
                try:
                    assigned_agent = Users.objects.filter(
                        id=int(assignee_id),
                        business=request.user.business
                    ).first()
                    if not assigned_agent:
                        return Response({
                            "message": f"Assignee with id {assignee_id} not found for this business"
                        }, status=status.HTTP_404_NOT_FOUND)
                except ValueError:
                    return Response({
                        "message": "assignee_id must be an integer"
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Normalize tags
            tag_list = []
            for t in raw_tags:
                if isinstance(t, str) and t.strip():
                    tag_list.append(t.strip())
            tag_list = list(dict.fromkeys(tag_list))  # dedupe preserving order
            try:
                validated_labels = []
                if label_ids:
                    validated_labels = _get_active_business_labels(request.user, label_ids)
                elif tag_list:
                    validated_labels = _get_existing_business_labels_by_names(request.user, tag_list)
            except ValueError as e:
                return Response({
                    "message": str(e),
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create ticket (without due_date - SLA will calculate it)
            try:
                ticket = Ticket.objects.create(
                    title=title,
                    description=description,
                    category=category,
                    department=department,
                    creator_name=creator_name,
                    creator_email=creator_email,
                    creator_phone=creator_phone,
                    created_by=created_by,
                    ticket_id=ticket_id,
                    priority=priority,
                    customer_tier=customer_tier,  # Add customer tier
                    source=source,  # Add source field
                    is_public=is_public,
                    assigned_to=assigned_agent,
                    tags=",".join(tag_list) if tag_list else ""
                )
                if validated_labels:
                    _set_ticket_labels(ticket, validated_labels)
                contact = link_or_create_contact(
                    business=request.user.business,
                    name=creator_name,
                    email=creator_email,
                    phone=creator_phone,
                    owner=request.user if isinstance(request.user, Users) else None,
                )
                if contact:
                    ticket.contact = contact
                    ticket.save(update_fields=["contact"])
                if assigned_agent:
                    ticket.status = 'assigned'
                    ticket.save(update_fields=['status'])

                # Auto-assign SLA policy to ticket if SLA is enabled
                try:
                    # Check if SLA is globally enabled for this business
                    from tenant.models.SlaXModel import SLAConfiguration
                    sla_config = SLAConfiguration.objects.filter(business=request.user.business).first()

                    if sla_config and sla_config.sla_enabled:
                        # First, try to find a policy with auto_apply enabled and matching priority
                        applicable_sla = SLA.objects.filter(
                            business=request.user.business,
                            is_active=True,
                            auto_apply=True,
                            targets__priority=priority
                        ).first()

                        # If no auto_apply policy found, look for any active policy with matching priority
                        if not applicable_sla:
                            applicable_sla = SLA.objects.filter(
                                business=request.user.business,
                                is_active=True,
                                targets__priority=priority
                            ).first()

                        if applicable_sla:
                            ticket.sla = applicable_sla
                            ticket.save(update_fields=['sla'])
                            logger.info(f"SLA policy '{applicable_sla.name}' assigned to ticket {ticket_id}")
                        else:
                            logger.warning(f"No applicable SLA found for ticket {ticket_id} with priority {priority}")
                    else:
                        logger.info(f"SLA is disabled for business {request.user.business.name}, skipping auto-assignment")
                except Exception as e:
                    logger.error(f"Error auto-assigning SLA to ticket {ticket_id}: {str(e)}")

                # Calculate due dates using the ticket's own methods
                sla_due_times = ticket.calculate_sla_due_times()
                due_date = None
                if sla_due_times and sla_due_times['resolution_due']:
                    due_date = sla_due_times['resolution_due']
                    ticket.due_date = due_date
                    ticket.save()
                    logger.info(f"Ticket {ticket_id} resolution due date set to {due_date} based on SLA.")
                else:
                    logger.warning(f"Could not calculate SLA due date for ticket {ticket_id}. Falling back to default.")
                    # Fallback to old method if no SLA policy exists or calculation fails
                    try:
                        priority_dict = dict(PRIORITY_DURATION)
                        priority_hours_str = priority_dict.get(priority)
                        if priority_hours_str:
                            priority_hours = int(priority_hours_str)
                            due_date = datetime.now() + timedelta(hours=priority_hours)
                            ticket.due_date = due_date
                            ticket.save()
                        else:
                            due_date = None
                    except Exception as e:
                        logger.error(f"Error with fallback due date calculation: {str(e)}")
                        due_date = None

            except ValueError as e:
                return Response({
                    "message": str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.error(f"Error creating ticket or assigning SLA: {str(e)}")
                return Response({
                    "message": "Failed to create ticket or assign SLA",
                    "details": str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            duplicate_detection = DuplicateDetectionService().process_new_ticket(ticket, actor=request.user)
            if duplicate_detection:
                setattr(ticket, "_duplicate_detection", duplicate_detection)
                ticket.refresh_from_db()

            # Optional assignee at creation (internal only) - mirror assign endpoint behavior
            if assignee_id and not (duplicate_detection and duplicate_detection.get("status") == "auto_merged"):
                try:
                    agent = get_object_or_404(Users, id=assignee_id, business=request.user.business)
                except Http404:
                    return Response({
                        "message": f"Assignee with id {assignee_id} not found"
                    }, status=status.HTTP_404_NOT_FOUND)

                old_assignee = ticket.assigned_to
                ticket.assigned_to = agent
                ticket.status = 'assigned'
                ticket.updated_by = request.user
                ticket.updated_at = datetime.now()
                ticket.save(update_fields=['assigned_to', 'status', 'updated_by', 'updated_at'])

                # Activity log
                from tenant.models import TicketActivity
                TicketActivity.objects.create(
                    ticket=ticket,
                    user=request.user,
                    activity_type='assigned',
                    description=f"Ticket Assignment\nTicket was assigned to {agent.get_full_name()}",
                    new_value=agent.get_full_name(),
                    old_value=old_assignee.get_full_name() if old_assignee else ''
                )

                # Notifications
                NotificationSettingsService.create_in_app_notification(
                    user=agent,
                    ticket=ticket,
                    message=f"Ticket #{ticket.ticket_id} has been assigned to you: {ticket.title}",
                    notification_type="ticket_assigned",
                    metadata={
                        "reassigned": bool(old_assignee),
                        "previous_assignee": old_assignee.get_full_name() if old_assignee else None,
                        "priority": ticket.priority,
                        "activity_type": "assigned",
                        "assigned_by": request.user.get_full_name()
                    }
                )
                if old_assignee and old_assignee != agent:
                    NotificationSettingsService.create_in_app_notification(
                        user=old_assignee,
                        ticket=ticket,
                        message=f"Ticket #{ticket.ticket_id} was reassigned from you to {agent.get_full_name()}",
                        notification_type="ticket_assigned",
                        metadata={
                            "reassigned_from": True,
                            "new_assignee": agent.get_full_name(),
                            "priority": ticket.priority,
                            "activity_type": "reassigned"
                        }
                    )
                    ticket_transfer_notification.delay(ticket.id, old_assignee.get_full_name())

                if not ticket.first_response_at:
                    ticket.mark_first_response()

            # Note: Description is NOT added as a TicketComment to avoid redundancy
            # since it's already displayed in the description section of the ticket

            # Handle file uploads
            if request.FILES:
                logger.info("Files found in request, processing...")
                uploaded_files = request.FILES

                for uploaded_file_name, uploaded_file in uploaded_files.items():
                    try:
                        file_extension = os.path.splitext(uploaded_file.name)[1].lower()

                        # Validate file extension (add your allowed extensions)
                        allowed_extensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.txt']
                        if file_extension not in allowed_extensions:
                            return Response({
                                "error": f"File type {file_extension} not allowed"
                            }, status=status.HTTP_400_BAD_REQUEST)

                        # Generate unique filename
                        unique_filename = f"{uuid.uuid4()}{file_extension}"

                        # Create directory (scoped by business)
                        properties_dir, url_base = _build_storage_paths(ticket.business, subfolder='files')

                        # Full file path
                        file_path = os.path.join(properties_dir, unique_filename)

                        # Save file
                        with open(file_path, 'wb+') as destination:
                            for chunk in uploaded_file.chunks():
                                destination.write(chunk)

                        # Generate URL
                        file_url = f"{url_base}/{unique_filename}" if url_base else unique_filename

                        # Create attachment
                        TicketAttachment.objects.create(
                            ticket=ticket,
                            file_url=file_url,
                            filename=uploaded_file.name,  # Save original filename
                            description=f"File uploaded for ticket {ticket_id}"
                        )

                        logger.info(f"File saved: {file_path}")

                    except Exception as file_error:
                        logger.error(f"Error saving file {uploaded_file_name}: {str(file_error)}")
                        return Response({
                            "error": f"Failed to save file {uploaded_file_name}",
                            "details": str(file_error)
                        }, status=status.HTTP_400_BAD_REQUEST)

            # Prepare email data
            ticket_email_data = {
                'ticket_id': ticket_id,
                'title': title,
                'due_date': due_date.strftime('%Y-%m-%d %H:%M:%S') if due_date else 'TBD',
                'priority': priority,
                'customer_tier': customer_tier,
                'creator_name': creator_name or 'Anonymous',
                'creator_email': creator_email or 'N/A',
                'creator_phone': creator_phone or 'N/A',
                'category_name': category.name,
                'description': description or 'No description provided',
            }

            # Create in-app notifications for new ticket
            # If ticket has no assignee, notify all department members
            if not (duplicate_detection and duplicate_detection.get("status") == "auto_merged"):
                if ticket.assigned_to:
                    NotificationSettingsService.create_in_app_notification(
                        user=ticket.assigned_to,
                        ticket=ticket,
                        message=f"New ticket #{ticket.ticket_id} has been assigned to you: {ticket.title}",
                        notification_type="ticket_assigned",
                        metadata={
                            "priority": ticket.priority,
                            "category": category.name,
                            "department": department.name,
                            "activity_type": "assigned"
                        }
                    )
                elif department:
                    # No assignee - notify all department members
                    dept_members = NotificationSettingsService.active_department_members(department)
                    NotificationSettingsService.notify_many(
                        users=list(dept_members),
                        ticket=ticket,
                        message=f"New unassigned ticket #{ticket.ticket_id} in {department.name}: {ticket.title}",
                        notification_type="ticket_assigned",
                        metadata={
                            "priority": ticket.priority,
                            "category": category.name,
                            "department": department.name,
                            "unassigned": True,
                            "activity_type": "created"
                        }
                    )

            # Prepare response data
            response_data = {
                "message": "Ticket created successfully",
                "ticket_id": ticket.merged_into.ticket_id if ticket.is_merged and ticket.merged_into else ticket.ticket_id,
                "priority": priority,
                "customer_tier": customer_tier,
            }
            if duplicate_detection:
                response_data["duplicate_detection"] = duplicate_detection
                if duplicate_detection.get("status") == "auto_merged":
                    response_data["message"] = "Duplicate ticket detected and merged automatically"
                    response_data["created_ticket_id"] = ticket.ticket_id

            # Add SLA information if available
            if hasattr(ticket, 'sla_tracker'):
                sla_info = ticket.sla_status
                if sla_info:
                    response_data["sla_info"] = {
                        "first_response_due": sla_info['first_response_due'].isoformat(),
                        "resolution_due": sla_info['resolution_due'].isoformat(),
                        "policy_name": ticket.sla_tracker.sla_policy.name
                    }

            # Save Activity
            from tenant.models import TicketActivity
            # Only attach a Users instance here; customer portal requests use Customer accounts.
            activity_user = request.user if isinstance(request.user, Users) else (created_by if isinstance(created_by, Users) else None)

            # Log ticket creation activity without description (as per user requirement)
            user_name = 'Customer' if activity_user is None else (
                activity_user.get_full_name() if hasattr(activity_user, 'get_full_name') else str(activity_user)
            )
            TicketActivity.objects.create(
                ticket=ticket,
                user=activity_user,
                activity_type='created',
                description=f"{user_name} created the ticket"
            )

            log_audit_event(
                request,
                event_type="TICKET_CREATED",
                entity_type="ticket",
                entity=ticket,
                activity=f"{actor_name(request.user)} created Ticket #{ticket.ticket_id} - '{ticket.title}'",
                metadata={
                    "entity_identifier": ticket.ticket_id,
                    "priority": ticket.priority,
                    "status": ticket.status,
                    "department": department.name if department else None,
                    "category": category.name if category else None,
                    "assignee": assigned_agent.get_full_name() if assigned_agent else None,
                },
            )

            return Response(response_data, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            logger.error(f"Validation error in ticket creation: {str(e)}")
            return Response({
                "message": "Validation error",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Unexpected error in ticket creation: {str(e)}")
            return Response({
                "message": "An unexpected error occurred while creating the ticket",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    def add_ticket_watchers(self, request, *args, **kwargs):
        try:
            result = watchers_service.add_ticket_watchers(
                ticket_id=kwargs.get("id"), data=request.data, user=request.user,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        return Response(result, status=status.HTTP_200_OK)

    def get_watchers(request, *args, **kwargs):
        # NOTE (pre-existing bug, preserved): missing `self` parameter — see
        # tenant/services/tickets/watchers.get_watchers for details. Harmless
        # because the body never touches `request`/`self`.
        watcher_list = watchers_service.get_watchers(ticket_id=kwargs.get("id"))
        return Response(watcher_list, status=status.HTTP_200_OK)

    @transaction.atomic
    def add_ticket_tags(self, request, *args, **kwargs):
        try:
            result = labels_service.add_ticket_tags(
                ticket_id=kwargs.get("id"), data=request.data, user=request.user,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        return Response(result, status=status.HTTP_200_OK)

    @transaction.atomic
    def update_labels(self, request, *args, **kwargs):
        ticket_id = kwargs.get("id")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = labels_service.update_labels(
                ticket_id=ticket_id,
                label_ids=serializer.validated_data.get("label_ids", []),
                user=request.user,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)

        return Response(result, status=status.HTTP_200_OK)

    def get_tags(self, request, *args, **kwargs):
        result = labels_service.get_tags(ticket_id=kwargs.get("id"), user=request.user)
        return Response(result, status=status.HTTP_200_OK)

    @transaction.atomic
    def assign(self, request, *args, **kwargs):
        ticket_id = request.data.get('ticket_id')
        agent_id = request.data.get('agent_id')
        try:
            result = assignment_service.assign(request=request)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        except Users.DoesNotExist:
            logger.warning(f"Agent with ID {agent_id} not found for business {request.user.business}")
            return Response({"message": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.exception("An error occurred while assigning the ticket.", exc_info=e)
            return Response({
                "message": "An unexpected error occurred. Please try again later."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    @transaction.atomic
    def assign_to_me(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')
        try:
            result = assignment_service.assign_to_me(ticket_id=ticket_id, user=request.user)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.exception("An error occurred while assigning the ticket.", exc_info=e)
            return Response({
                "message": "An unexpected error occurred. Please try again later."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    @transaction.atomic
    def update_status(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')

        if not ticket_id:
            return Response({
                "message": "Ticket ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = status_transitions_service.update_status(request=request, ticket_id=ticket_id)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    def update_department(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')

        if not ticket_id:
            return Response({
                "message": "Ticket ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = field_updates_service.update_department(request=request, ticket_id=ticket_id)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    def update_category(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')

        if not ticket_id:
            return Response({
                "message": "Ticket ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = field_updates_service.update_category(request=request, ticket_id=ticket_id)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    def update_priority(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')

        if not ticket_id:
            return Response({
                "message": "Ticket ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = field_updates_service.update_priority(request=request, ticket_id=ticket_id)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    @transaction.atomic
    def update_source(self, request, *args, **kwargs):
        """Ticket source editing is disabled."""
        result = field_updates_service.update_source(request=request, ticket_id=kwargs.get('id'))
        return Response(result, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def _update_source_disabled(self, request, *args, **kwargs):
        """Update the source of a ticket (e.g., email, phone, web, chat). DISABLED."""
        ticket_id = kwargs.get('id')

        if not ticket_id:
            return Response({
                "message": "Ticket ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            ticket = get_object_or_404(Ticket, id=ticket_id, business=request.user.business)
            if ticket.status == 'closed':
                return Response(
                    {"message": "Cannot update source of a closed ticket. Please reopen it first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            new_source = request.data.get('source')
            old_source = ticket.source

            if not new_source:
                return Response({"message": "Source is required"}, status=status.HTTP_400_BAD_REQUEST)

            # Valid source options - matches frontend options
            normalized_source = str(new_source).strip().lower()
            # Backward compatibility for older frontend payloads.
            if normalized_source == 'portal':
                normalized_source = 'customer_portal'

            valid_sources = ['email', 'phone', 'web', 'chat', 'chatbot', 'api', 'internal', 'customer_portal', 'other']
            if normalized_source not in valid_sources:
                return Response({
                    "message": f"Invalid source. Valid options are: {', '.join(valid_sources)}"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Update the ticket source
            ticket.source = normalized_source
            ticket.updated_at = datetime.now()
            ticket.updated_by = request.user
            ticket.save()

            # Create TicketActivity for source change
            from tenant.models import TicketActivity
            TicketActivity.objects.create(
                ticket=ticket,
                user=request.user,
                activity_type='updated',
                description=f"Ticket source changed from {old_source or 'None'} to {normalized_source}",
                old_value=old_source or 'None',
                new_value=normalized_source
            )

            return Response(
                {"message": "Ticket source updated successfully", "source": ticket.source},
                status=status.HTTP_200_OK,
            )

        except Ticket.DoesNotExist:
            logger.warning(f"Ticket with ID {ticket_id} not found for business {request.user.business}")
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='add-note')
    def add_note(self, request, *args, **kwargs):
        try:
            result = comments_service.add_note(
                ticket_id=kwargs.get('pk'), data=request.data, user=request.user,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def add_comment(self, request, *args, **kwargs):
        try:
            result = comments_service.add_comment(
                ticket_id=kwargs.get('id'), data=request.data, user=request.user, files=request.FILES,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("Unhandled error in add_comment: %s", e)
            return Response({
                "message": "An unexpected error occurred while adding the comment",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='email-reply')
    def send_email_reply(self, request, pk=None, *args, **kwargs):
        """
        Send an email reply for a ticket from the activity stream.
        Supports JSON and multipart/form-data payloads with optional attachments.
        """
        try:
            result = email_reply_service.send_email_reply(request=request, pk=pk)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except ValidationError as e:
            err = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"message": err}, status=status.HTTP_400_BAD_REQUEST)
        except Ticket.DoesNotExist:
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("Error in send_email_reply: %s", e)
            return Response({
                "message": "Failed to send email reply",
                "details": str(e) if settings.DEBUG else "Please try again"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def log_call(self, request, *args, **kwargs):
        try:
            result = call_logs_service.log_call(request=request, ticket_id=kwargs.get('id'))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)

        return Response(result, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def reopen(self, request, *args, **kwargs):
        ticket_id = kwargs.get('pk')
        reason = request.data.get('reason')

        if not ticket_id:
            return Response({"message": "Ticket ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({"message": "Reason is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = status_transitions_service.reopen(request=request, ticket_id=ticket_id, reason=reason)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path=r'comments/(?P<comment_id>\d+)/flag')
    def flag_comment(self, request, pk=None, comment_id=None):
        """Flag or unflag a comment"""
        try:
            result = comment_reactions_service.flag_comment(pk=pk, comment_id=comment_id, user=request.user)
        except TicketComment.DoesNotExist:
            return Response({"message": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path=r'comments/(?P<comment_id>\d+)/like')
    def like_comment(self, request, pk=None, comment_id=None):
        """Like or unlike a comment"""
        try:
            result = comment_reactions_service.like_comment(pk=pk, comment_id=comment_id, user=request.user)
        except TicketComment.DoesNotExist:
            return Response({"message": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path=r'comments/(?P<comment_id>\d+)/reply')
    def reply_to_comment(self, request, pk=None, comment_id=None):
        """Create a reply to a comment"""
        try:
            result = comments_service.reply_to_comment(
                pk=pk, comment_id=comment_id, data=request.data, user=request.user,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except TicketComment.DoesNotExist:
            return Response({"message": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['put'], url_path=r'comments/(?P<comment_id>\d+)/edit')
    def edit_comment(self, request, pk=None, comment_id=None):
        """Edit a comment"""
        try:
            result = comments_service.edit_comment(
                pk=pk, comment_id=comment_id, data=request.data, user=request.user,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except TicketComment.DoesNotExist:
            return Response({"message": "Comment not found or you don't have permission to edit it"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path=r'comments/(?P<comment_id>\d+)/delete')
    def delete_comment(self, request, pk=None, comment_id=None):
        """Delete a comment"""
        try:
            result = comments_service.delete_comment(pk=pk, comment_id=comment_id, user=request.user)
        except TicketComment.DoesNotExist:
            return Response({"message": "Comment not found or you don't have permission to delete it"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path=r'comments/(?P<comment_id>\d+)/replies/(?P<reply_id>\d+)/like')
    def like_comment_reply(self, request, pk=None, comment_id=None, reply_id=None):
        """Like or unlike a comment reply"""
        try:
            result = comment_reactions_service.like_comment_reply(
                comment_id=comment_id, reply_id=reply_id, user=request.user,
            )
        except CommentReply.DoesNotExist:
            return Response({"message": "Reply not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)

    def export_tickets(self, request, *args, **kwargs):
        """Export selected tickets to CSV, Excel, or JSON format."""
        try:
            return export_service.export_tickets(request=request)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def bulk_archive(self, request, *args, **kwargs):
        """Archive selected tickets"""
        try:
            result = bulk_actions_service.bulk_archive(ticket_ids=request.data.get('ticket_ids', []))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    def bulk_delete(self, request, *args, **kwargs):
        """Soft delete selected tickets"""
        try:
            result = bulk_actions_service.bulk_delete(ticket_ids=request.data.get('ticket_ids', []))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    def bulk_unarchive(self, request, *args, **kwargs):
        """Unarchive selected tickets"""
        try:
            result = bulk_actions_service.bulk_unarchive(ticket_ids=request.data.get('ticket_ids', []))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    def bulk_restore(self, request, *args, **kwargs):
        """Restore selected tickets from trash"""
        try:
            result = bulk_actions_service.bulk_restore(ticket_ids=request.data.get('ticket_ids', []))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    def bulk_permanent_delete(self, request, *args, **kwargs):
        """Permanently delete tickets from trash (hard delete)"""
        try:
            result = bulk_actions_service.bulk_permanent_delete(
                ticket_ids=request.data.get('ticket_ids', []),
                business_id=request.user.business_id,
            )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            logger.exception("bulk_permanent_delete failed for business %s: %s", request.user.business_id, e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def merge(self, request, *args, **kwargs):
        """
        Merge one or more tickets into this ticket (primary).
        Soft-link strategy: mark source tickets as merged/closed without moving related records.
        """
        try:
            result = merge_service.merge(request=request, primary_id=kwargs.get('pk'))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def get_config(self, request):
        """
        Get ticket configuration for the current business.
        Admin-only endpoint.
        """
        try:
            result = config_service.get_config(user=request.user)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            logger.error(f"Error fetching ticket config: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post', 'put'], permission_classes=[IsAuthenticated])
    def update_config(self, request):
        """
        Create or update ticket configuration for the current business.
        Admin-only endpoint.
        """
        try:
            result = config_service.update_config(request=request)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Exception as e:
            logger.error(f"Error updating ticket config: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)


class AIComposeView(APIView):
    """Generate an AI-drafted email/note reply for a ticket using Gemini."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        from tenant.models.TicketModel import TicketComment
        from tenant.services.ai.gemini_client import GeminiClient

        prompt = (request.data.get('prompt') or '').strip()
        reply_type = request.data.get('reply_type', 'email')

        if not prompt:
            return Response({'message': 'prompt is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ticket = get_object_or_404(Ticket, id=pk, business=request.user.business)
        except Exception:
            return Response({'message': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        # Build conversation context from last 10 comments
        recent_comments = (
            TicketComment.objects
            .filter(ticket=ticket)
            .order_by('-created_at')[:10]
        )
        conversation_lines = []
        for c in reversed(list(recent_comments)):
            role = 'Agent' if c.author_id else 'Customer'
            # Strip HTML tags for context
            import re as _re
            plain = _re.sub(r'<[^>]+>', '', c.content or '').strip()
            if plain:
                conversation_lines.append(f"{role}: {plain[:300]}")
        conversation_context = '\n'.join(conversation_lines) or 'No prior conversation.'

        customer_name = getattr(ticket, 'creator_name', 'the customer')
        if reply_type == 'email':
            system_instruction = f"""You are a customer support agent for {ticket.business.name}.
Ticket title: {ticket.title}
Customer: {customer_name}

Recent conversation:
{conversation_context}

Return ONLY valid JSON with this exact shape:
{{"subject": "plain text subject", "content": "<p>HTML body</p>"}}

Write a professional email reply to the customer.
- The subject must be concise plain text.
- The content must be an HTML fragment using <p> tags.
- Do NOT include a signature.
- Do NOT include a subject line inside the content.
- Do NOT include markdown or code fences.
- Do NOT include <html> or <body> tags.
- Be concise and professional."""
        else:
            system_instruction = f"""You are a customer support agent for {ticket.business.name}.
Ticket title: {ticket.title}
Customer: {customer_name}

Recent conversation:
{conversation_context}

Write a professional internal note for the support team in HTML format.
- Use <p> tags for paragraphs.
- Do NOT include a subject line or <html>/<body> tags.
- Do NOT include a signature.
- Be concise and professional."""

        user_prompt = f"Agent instruction: {prompt}"

        try:
            client = GeminiClient()
            result = client.generate_content(
                prompt=user_prompt,
                system_instruction=system_instruction,
                temperature=0.7,
                max_tokens=1000,
            )
            if reply_type == 'email':
                payload = _parse_ai_email_draft(result['content'])
                return Response(payload, status=status.HTTP_200_OK)
            return Response({'content': result['content']}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("AI compose failed for ticket %s", pk)
            return Response({'message': 'AI generation failed. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
