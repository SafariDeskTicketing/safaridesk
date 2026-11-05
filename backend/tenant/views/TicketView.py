import logging
from datetime import datetime

from django.db.utils import IntegrityError
from django.db import transaction
from django.forms import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from RNSafarideskBack import settings
from tenant.models import Ticket, TicketCategories, Task
from tenant.models.TicketModel import TicketComment, CommentReply
from tenant.serializers.LabelSerializer import LabelAssignmentSerializer
from tenant.serializers.TicketSerializer import TicketAddComment, TicketAssign, TicketCategorySerializer, \
    TicketSerializer, TicketUpdateStatus, TicketsList, TicketAddWatchers, TicketAddTags, TicketCategoryUpdateSerializer, \
    TicketMergeRequestSerializer
from tenant.serializers.EmailMessageRecordSerializer import EmailMessageRecordSerializer
from users.models import Users
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService

# --- Extracted service modules (see tenant/services/tickets/) ---
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets import (
    activity_stream as activity_stream_service,
    assignment as assignment_service,
    attachments as attachments_service,
    bulk_actions as bulk_actions_service,
    call_logs as call_logs_service,
    comment_reactions as comment_reactions_service,
    comments as comments_service,
    config as config_service,
    creation as creation_service,
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
    _serialize_labels,
)
from tenant.services.tickets.email_reply import _parse_ai_email_draft

logger = logging.getLogger(__name__)


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


        # SLA breach status — single source of truth is `Ticket.is_sla_breached`.
        # This used to be reimplemented here by hand, and disagreed with the
        # model property in two ways: it didn't check whether the *first
        # response itself* was late when resolution wasn't yet overdue, and
        # (separately) it's the version the AUDIT_TRACKER flagged as the
        # "two different answers depending on endpoint" bug.
        breached = ticket.is_sla_breached

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
        queryset = queries_service.list_tickets_queryset(user=request.user, query_params=request.query_params)

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

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                result = creation_service.create_ticket_from_request(request=request)
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
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

        return Response(result, status=status.HTTP_201_CREATED)

    def add_ticket_watchers(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
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

    def add_ticket_tags(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                result = labels_service.add_ticket_tags(
                    ticket_id=kwargs.get("id"), data=request.data, user=request.user,
                )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        return Response(result, status=status.HTTP_200_OK)

    def update_labels(self, request, *args, **kwargs):
        ticket_id = kwargs.get("id")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
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

    def assign(self, request, *args, **kwargs):
        ticket_id = request.data.get('ticket_id')
        agent_id = request.data.get('agent_id')
        try:
            with transaction.atomic():
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

    def assign_to_me(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')
        try:
            with transaction.atomic():
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

    def update_status(self, request, *args, **kwargs):
        ticket_id = kwargs.get('id')

        if not ticket_id:
            return Response({
                "message": "Ticket ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
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

    @action(detail=True, methods=['post'], url_path='add-note')
    def add_note(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                result = comments_service.add_note(
                    ticket_id=kwargs.get('pk'), data=request.data, user=request.user,
                )
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)
        except Ticket.DoesNotExist:
            return Response({"message": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_201_CREATED)

    def add_comment(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
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

    @action(detail=True, methods=['post'], url_path='email-reply')
    def send_email_reply(self, request, pk=None, *args, **kwargs):
        """
        Send an email reply for a ticket from the activity stream.
        Supports JSON and multipart/form-data payloads with optional attachments.
        """
        try:
            with transaction.atomic():
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

    def log_call(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                result = call_logs_service.log_call(request=request, ticket_id=kwargs.get('id'))
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)

        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reopen(self, request, *args, **kwargs):
        ticket_id = kwargs.get('pk')
        reason = request.data.get('reason')

        if not ticket_id:
            return Response({"message": "Ticket ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({"message": "Reason is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
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

    @action(detail=True, methods=['post'])
    def merge(self, request, *args, **kwargs):
        """
        Merge one or more tickets into this ticket (primary).
        Soft-link strategy: mark source tickets as merged/closed without moving related records.
        """
        try:
            with transaction.atomic():
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
