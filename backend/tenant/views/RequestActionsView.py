import logging
import os
import uuid
from datetime import datetime, timedelta

import uuid
from django.db import transaction
from django.db.models import Q
from django.forms import ValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from RNSafarideskBack.settings import FILE_BASE_URL, FILE_URL
from RNSafarideskBack import settings

from tenant.models import Requests, TicketCategories, Department, Ticket, Task
from tenant.models.SlaXModel import SLA
from tenant.models.TaskModel import Task as TaskModel
from tenant.models.TicketModel import TicketComment
from users.models import Users
from util.Constants import PRIORITY_DURATION
from util.Helper import Helper
from shared.tasks import create_notification_task

logger = logging.getLogger(__name__)

helper = Helper()

class RequestViewSet(viewsets.ModelViewSet):
    queryset = Requests.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Requests.objects.filter(business=self.request.user.business)

    def list(self, request, *args, **kwargs):
        """List all requests for the user's business"""
        queryset = self.get_queryset()

        # Handle search
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                title__icontains=search
            ) | queryset.filter(
                description__icontains=search
            ) | queryset.filter(
                creator_name__icontains=search
            ) | queryset.filter(
                creator_email__icontains=search
            ) | queryset.filter(
                ref_number__icontains=search
            )

        # Handle status and conversion filtering
        status_filter = request.query_params.get('status')
        converted_filter = request.query_params.get('converted')

        if status_filter == 'converted' or converted_filter == 'true':
            queryset = queryset.filter(
                Q(converted_to_ticket=True) | Q(converted_to_task=True)
            )
        else:
            queryset = queryset.filter(converted_to_ticket=False, converted_to_task=False)
            if status_filter and status_filter != 'all':
                queryset = queryset.filter(status=status_filter)

        # Handle type filter
        type_filter = request.query_params.get('type')
        if type_filter and type_filter != 'all':
            queryset = queryset.filter(type=type_filter)

        # Handle request type filters from customer support mapping
        # Map customer-facing request types to internal request types
        # "Report an Issue" -> technical issues
        # "Request Service" -> general service requests
        # "Suggest an Idea" -> feature requests
        request_type_mapping = {
            'issue_reports': 'technical',
            'service_requests': 'general',
            'billing_requests': 'billing',
            'feature_requests': 'feature',
        }

        for filter_key, request_type_value in request_type_mapping.items():
            if request.query_params.get(filter_key) == 'true':
                queryset = queryset.filter(type=request_type_value)
                break

        # Handle pagination
        pagination = request.query_params.get('pagination', 'yes').lower()
        if pagination == 'no':
            # Return unpaginated data
            serializer_data = []
            for request_obj in queryset:
                serializer_data.append({
                    'id': str(request_obj.id),
                    'title': request_obj.title,
                    'description': request_obj.description,
                    'type': request_obj.type,
                    'status': request_obj.status,
                    'creator_name': request_obj.creator_name,
                    'creator_email': request_obj.creator_email,
                    'creator_phone': request_obj.creator_phone,
                    'ref_number': request_obj.ref_number,
                    'created_at': request_obj.created_at.isoformat(),
                    'updated_at': request_obj.updated_at.isoformat(),
                    'converted_to_ticket': request_obj.converted_to_ticket,
                    'converted_to_task': request_obj.converted_to_task,
                    'attached_to': request_obj.attached_to,
                })

            return Response({
                'results': serializer_data,
                'count': len(serializer_data)
            })

        # Paginated response
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer_data = []
            for request_obj in page:
                serializer_data.append({
                    'id': str(request_obj.id),
                    'title': request_obj.title,
                    'description': request_obj.description,
                    'type': request_obj.type,
                    'status': request_obj.status,
                    'creator_name': request_obj.creator_name,
                    'creator_email': request_obj.creator_email,
                    'creator_phone': request_obj.creator_phone,
                    'ref_number': request_obj.ref_number,
                    'created_at': request_obj.created_at.isoformat(),
                    'updated_at': request_obj.updated_at.isoformat(),
                    'converted_to_ticket': request_obj.converted_to_ticket,
                    'converted_to_task': request_obj.converted_to_task,
                })

            return self.get_paginated_response(serializer_data)
        return None

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='make-ticket')
    def make_ticket(self, request, pk=None):
        """Convert a request to a ticket"""
        try:
            request_obj = get_object_or_404(Requests, id=pk, business=request.user.business)

            if request_obj.converted_to_ticket:
                return Response({
                    "message": "Request has already been converted to a ticket"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get default category and department if available
            category = TicketCategories.objects.filter(business=request.user.business).first()
            department = Department.objects.filter(business=request.user.business).first()

            if not category:
                return Response({
                    "message": "No ticket categories found. Please create a category first."
                }, status=status.HTTP_400_BAD_REQUEST)

            if not department:
                return Response({
                    "message": "No departments found. Please create a department first."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Set priority based on request content or config default
            priority = 'medium'  # Fallback
            
            # Override if keywords found in request
            if 'urgent' in request_obj.title.lower() or 'urgent' in request_obj.description.lower():
                priority = 'urgent'
            elif 'high' in request_obj.title.lower() or 'high' in request_obj.description.lower():
                priority = 'high'
            elif 'low' in request_obj.title.lower() or 'low' in request_obj.description.lower():
                priority = 'low'

            # Generate ticket ID using business context and config format
            ticket_id = Helper().generate_incident_code(business=request.user.business)

            # Check if user exists by email
            created_by = None
            if request_obj.creator_email:
                created_by = Users.objects.filter(
                    email=request_obj.creator_email,
                    business=request.user.business
                ).first()

            try:
                ticket = Ticket.objects.create(
                    title=request_obj.title,
                    description=request_obj.description,
                    category=category,
                    department=department,
                    creator_name=request_obj.creator_name,
                    creator_email=request_obj.creator_email,
                    creator_phone=request_obj.creator_phone,
                    created_by=created_by,
                    ticket_id=ticket_id,
                    priority=priority,
                    is_public=True,
                    source='internal',
                )

                # Assign SLA if available
                applicable_sla = SLA.objects.filter(
                    business=request.user.business,
                    is_active=True,
                    targets__priority=priority
                ).first()

                if applicable_sla:
                    ticket.sla = applicable_sla
                    ticket.save()

                # Calculate due dates using the ticket's own methods
                sla_due_times = ticket.calculate_sla_due_times()
                due_date = None
                if sla_due_times and sla_due_times['resolution_due']:
                    due_date = sla_due_times['resolution_due']
                    ticket.due_date = due_date
                    ticket.save()
                else:
                    # Fallback: use priority-based duration
                    priority_hours = {
                        'low': 168,     # 7 days
                        'medium': 72,   # 3 days
                        'high': 24,     # 1 day
                        'urgent': 4     # 4 hours
                    }.get(priority, 72)

                    due_date = timezone.now() + timedelta(hours=priority_hours)
                    ticket.due_date = due_date
                    ticket.save()

            except Exception as e:
                logger.error(f"Error creating ticket from request {pk}: {str(e)}")
                return Response({
                    "message": "Failed to create ticket from request",
                    "details": str(e) if settings.DEBUG else "Please contact support"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Update request status
            request_obj.converted_to_ticket = True
            request_obj.attached_to = ticket.ticket_id
            request_obj.status = 'converted'
            request_obj.save()

            # Create system comment on the ticket
            ticket.comments.create(
                ticket=ticket,
                author=Users.objects.filter(email='system@safaridesk.io').first(),
                content=f"Ticket created from Request #{request_obj.ref_number}\nTitle: {request_obj.title}\nDescription: {request_obj.description}",
                is_internal=False
            )

            return Response({
                "message": f"Request converted to ticket successfully (Ticket ID: {ticket_id})",
                "ticket_id": ticket_id,
                "ticket_pk": ticket.id
            }, status=status.HTTP_201_CREATED)

        except Requests.DoesNotExist:
            return Response({
                "message": "Request not found"
            }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error(f"Unexpected error converting request {pk} to ticket: {str(e)}")
            return Response({
                "message": "An unexpected error occurred while converting the request",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='make-task')
    def make_task(self, request, pk=None):
        """Convert a request to a task"""
        try:
            request_obj = get_object_or_404(Requests, id=pk, business=request.user.business)

            if request_obj.converted_to_task:
                return Response({
                    "message": "Request has already been converted to a task"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get default department if available
            department = Department.objects.filter(business=request.user.business).first()
            if not department:
                return Response({
                    "message": "No departments found. Please create a department first."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Set default agent to current user for now
            assigned_user = request.user

            # Set default priority based on keywords or config
            priority = 'medium'  # Fallback
            
            # Override if keywords found
            if 'urgent' in request_obj.title.lower() or 'urgent' in request_obj.description.lower():
                priority = 'urgent'
            elif 'high' in request_obj.title.lower() or 'high' in request_obj.description.lower():
                priority = 'high'
            
            # Set due date based on request priority or default to 3 days
            due_date = timezone.now() + timedelta(days=3)
            if priority == 'urgent' or 'asap' in request_obj.title.lower() or 'asap' in request_obj.description.lower():
                due_date = timezone.now() + timedelta(days=1)

            try:
                task = TaskModel.objects.create(
                    title=request_obj.title,
                    description=request_obj.description,
                    assigned_to=assigned_user,
                    task_trackid=Helper().generate_task_code(business=request.user.business),
                    department=department,
                    due_date=due_date.date(),  # TaskModel uses date field
                    priority=priority,
                )
            except Exception as e:
                logger.error(f"Error creating task from request {pk}: {str(e)}")
                return Response({
                    "message": "Failed to create task from request",
                    "details": str(e) if settings.DEBUG else "Please contact support"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Update request status
            request_obj.converted_to_task = True
            request_obj.attached_to = task.task_trackid
            request_obj.status = 'converted'
            request_obj.save()

            # Create system comment on the task
            task.comments.create(
                task=task,
                author=Users.objects.filter(email='system@safaridesk.io').first(),
                content=f"Task created from Request #{request_obj.ref_number}\nTitle: {request_obj.title}\nDescription: {request_obj.description}",
                is_internal=False
            )

            return Response({
                "message": f"Request converted to task successfully (Task ID: {task.task_trackid})",
                "task_id": task.task_trackid,
                "task_pk": task.id
            }, status=status.HTTP_201_CREATED)

        except Requests.DoesNotExist:
            return Response({
                "message": "Request not found"
            }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error(f"Unexpected error converting request {pk} to task: {str(e)}")
            return Response({
                "message": "An unexpected error occurred while converting the request",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Approve a request without converting it"""
        try:
            request_obj = get_object_or_404(Requests, id=pk, business=request.user.business)

            if request_obj.status != 'pending':
                return Response({
                    "message": f"Request is already {request_obj.status}"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Update request status
            request_obj.status = 'approved'
            request_obj.approved_at = timezone.now()
            request_obj.approved_by = request.user
            request_obj.save()

            return Response({
                "message": "Request approved successfully"
            }, status=status.HTTP_200_OK)

        except Request.DoesNotExist:
            return Response({
                "message": "Request not found"
            }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error(f"Unexpected error approving request {pk}: {str(e)}")
            return Response({
                "message": "An unexpected error occurred while approving the request",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
