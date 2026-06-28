import logging
import os
from datetime import datetime, timedelta

import uuid

from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status, viewsets
from urllib.parse import urlparse

from RNSafarideskBack import settings
from RNSafarideskBack.settings import FILE_URL
from tenant.models import Department, TicketCategories, Ticket, SLAPolicy, SLATracker, TicketAttachment, Requests
from tenant.services.contact_linker import link_or_create_contact
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService
from tenant.serializers.DepartmentSerializer import DepartmentSerializer
from tenant.serializers.DomainValidationSerializer import DomainValidationSerializer, TicketSearchSerializer, \
    RequestCreateSerializer
from tenant.serializers.TicketSerializer import TicketCategorySerializer, TicketSerializer
from users.models import Business, Customer, CustomDomains
from util.Constants import PRIORITY_DURATION
from util.SlaUtil import SLACalculator
from shared.tasks import  send_ticket_notification
from tenant.services.tickets.naming import generate_ticket_id, render_ticket_title


logger = logging.getLogger(__name__)
TICKET_TITLE_SUMMARY_MAX_LENGTH = 120
TICKET_TITLE_MAX_LENGTH = 200

class PublicView(viewsets.ModelViewSet):  # or ModelViewSet if you're using it
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == 'validate':
            return DomainValidationSerializer
        if self.action == 'search_ticket':
            return TicketSearchSerializer
        if self.action == 'new_request':
            return RequestCreateSerializer
        return TicketSerializer

    @staticmethod
    def _extract_domain_segment(host: str):
        parts = host.split(".")
        if "localhost" in host:
            return parts[0] if len(parts) > 1 else None
        return parts[0] if len(parts) > 2 else None

    def _resolve_business_from_host(self, host: str):
        normalized_host = (host or "").strip().lower().rstrip(".")
        if not normalized_host:
            return None

        custom_domain = CustomDomains.objects.select_related("business").filter(
            domain__iexact=normalized_host,
            is_verified=True,
            business__is_active=True,
        ).first()
        if custom_domain:
            return custom_domain.business

        domain_segment = self._extract_domain_segment(normalized_host)
        if not domain_segment:
            return None

        return Business.objects.filter(domain__iexact=domain_segment, is_active=True).first()

    def validate(self, request):
        support_url = request.data.get("url")

        if not support_url:
            return Response({"message": "support_url is required"}, status=status.HTTP_403_FORBIDDEN)

        try:
            parsed_url = urlparse(support_url)
            host = parsed_url.hostname  # e.g. "zim.localhost" or "zim.safaridesk.io"

            if not host:
                return Response({"message": "Invalid URL format"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"message": "Invalid URL format"}, status=status.HTTP_400_BAD_REQUEST)

        business = self._resolve_business_from_host(host)
        if not business:
            return Response({"message": "Domain not found"}, status=status.HTTP_403_FORBIDDEN)

        # Departments
        departments = Department.objects.filter(business=business, status='A')
        departments_serialized = DepartmentSerializer(departments, many=True).data

        # Ticket Categories
        ticket_categories = TicketCategories.objects.filter(
            business=business,
            status='A',
            is_active=True,
        )
        ticket_categories_serialized = TicketCategorySerializer(ticket_categories, many=True).data

        return Response({
            "business_id": business.id,
            "business_name": business.name,
            "logo_url": business.logo_url,
            "favicon_url": business.favicon_url,
            "auth_backdrop_url": business.auth_backdrop_url,
            "color_theme": getattr(business, 'color_theme', 'default') or 'default',
            "departments": departments_serialized,
            "ticket_categories": ticket_categories_serialized,
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        try:
            # Extract business context
            resolved_business = None
            business = request.data.get('business') or request.data.get('business_id')
            if business not in (None, ''):
                try:
                    resolved_business = Business.objects.get(id=int(business), is_active=True)
                except (TypeError, ValueError, Business.DoesNotExist):
                    return Response({"message": "Invalid business ID"}, status=status.HTTP_400_BAD_REQUEST)

            if resolved_business is None:
                resolved_business = getattr(request, "custom_domain_business", None)

            if resolved_business is None:
                resolved_business = self._resolve_business_from_host(request.get_host().split(":")[0])
            
            raw_title = request.data.get('title')
            creator_name = request.data.get('creator_name')
            creator_phone = request.data.get('creator_phone')
            creator_email = request.data.get('creator_email')
            description = request.data.get('description')
            category_id = request.data.get('category_id')
            department_id = request.data.get('department_id')

            # When a logged-in customer submits the form, bind the ticket to the
            # authenticated account so it reliably appears in "Your cases".
            if getattr(request.user, 'is_authenticated', False) and getattr(request.user, 'category', None) == 'CUSTOMER':
                creator_email = getattr(request.user, 'email', creator_email) or creator_email
                creator_name = getattr(request.user, 'full_name', lambda: creator_name)() or creator_name
                creator_phone = getattr(request.user, 'phone_number', creator_phone) or creator_phone
            
            # Priority: use config default if not provided
            priority = request.data.get('priority')
            if not priority:
                priority = 'medium'  # Ultimate fallback
            
            customer_tier = request.data.get('customer_tier', 'standard')  # Add customer tier
            source = request.data.get('source', 'customer_portal')
            is_public = True if request.data.get('is_public') == 'true' else False
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

            # Validate priority value against the updated choices
            valid_priorities = ['critical', 'high', 'medium', 'low']
            # if priority not in valid_priorities:
            #     return Response({
            #         "message": f"Invalid priority. Must be one of: {', '.join(valid_priorities)}"
            #     }, status=status.HTTP_400_BAD_REQUEST)

            # Validate customer tier
            valid_tiers = ['premium', 'standard', 'basic']
            if customer_tier not in valid_tiers:
                return Response({
                    "message": f"Invalid customer tier. Must be one of: {', '.join(valid_tiers)}"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get category and department objects
            category_filters = {
                "id": category_id,
                "status": "A",
                "is_active": True,
            }
            department_filters = {
                "id": department_id,
                "status": "A",
            }
            if resolved_business:
                category_filters["business"] = resolved_business
                department_filters["business"] = resolved_business

            category = TicketCategories.objects.filter(**category_filters).first()
            if not category:
                return Response({
                    "message": f"Category with id {category_id} not found"
                }, status=status.HTTP_404_NOT_FOUND)

            department = Department.objects.filter(**department_filters).first()
            if not department:
                return Response({
                    "message": f"Department with id {department_id} not found"
                }, status=status.HTTP_404_NOT_FOUND)

            if category.business_id != department.business_id:
                return Response({
                    "message": "Category and department must belong to the same business"
                }, status=status.HTTP_400_BAD_REQUEST)

            ticket_business = resolved_business or department.business

            if ticket_business and (
                category.business_id != ticket_business.id or department.business_id != ticket_business.id
            ):
                return Response({
                    "message": "Category/department mismatch for the resolved business context"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Remove the old priority-based due date calculation
            # The SLA system will handle this automatically

            # Create ticket (without due_date - SLA will calculate it)
            try:
                naming_business = ticket_business
                ticket_id = generate_ticket_id(business=naming_business)
                title = render_ticket_title(
                    summary=raw_title,
                    ticket_id=ticket_id,
                    source=source,
                    business=naming_business,
                    max_length=None,
                )
                if len(title) > TICKET_TITLE_MAX_LENGTH:
                    return Response({
                        "message": f"Formatted ticket title is too long. Please shorten the title to fit within {TICKET_TITLE_MAX_LENGTH} characters."
                    }, status=status.HTTP_400_BAD_REQUEST)

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
                    customer_tier=customer_tier,
                    is_public=is_public,
                    business=ticket_business,
                    source=source
                )

                # Link or create contact
                contact = link_or_create_contact(
                    business=ticket_business,
                    name=creator_name,
                    email=creator_email,
                    phone=creator_phone,
                )
                if contact:
                    ticket.contact = contact
                    ticket.save(update_fields=["contact"])

                # Set Up SLA Tracker
                # sla_policy = instance.get_applicable_sla_policy()
                sla_policy = SLAPolicy.objects.filter(
                    priority=priority,
                    # customer_tier=ticket.customer_tier,
                    # category=self.category,
                    is_active=True,
                    business=ticket_business
                ).first()

                # print(f"Creating SLA tracker for Ticket #{ticket.ticket_id} with policy: {sla_policy}")

                if sla_policy:
                    calculator = SLACalculator()

                    # Calculate due dates
                    first_response_due = calculator.calculate_due_date(
                        ticket.created_at,
                        sla_policy.first_response_time,
                        sla_policy.business_hours_only
                    )

                    resolution_due = calculator.calculate_due_date(
                        ticket.created_at,
                        sla_policy.resolution_time,
                        sla_policy.business_hours_only
                    )

                    # Create SLA tracker
                    SLATracker.objects.create(
                        ticket=ticket,
                        sla_policy=sla_policy,
                        first_response_due=first_response_due,
                        resolution_due=resolution_due,
                        business=ticket_business
                    )

                # The SLA tracker will be created automatically by the post_save signal
                # Check if SLA was properly applied
                if hasattr(ticket, 'sla_tracker'):
                    logger.info(f"SLA tracker created for ticket {ticket_id}")
                    # Get the calculated due date from SLA tracker
                    due_date = ticket.sla_tracker.resolution_due
                else:
                    logger.warning(f"No SLA policy found for ticket {ticket_id}")
                    # Fallback to old method if no SLA policy exists
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

            except Exception as e:
                logger.error(f"Error creating ticket: {str(e)}")
                return Response({
                    "message": "Failed to create ticket",
                    "details": str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

                        # Create directory
                        properties_dir = os.path.join(settings.MEDIA_ROOT, 'files')
                        os.makedirs(properties_dir, exist_ok=True)

                        # Full file path
                        file_path = os.path.join(properties_dir, unique_filename)

                        # Save file
                        with open(file_path, 'wb+') as destination:
                            for chunk in uploaded_file.chunks():
                                destination.write(chunk)

                        # Generate URL
                        file_url = f"{FILE_URL}/{unique_filename}"

                        # Create attachment
                        TicketAttachment.objects.create(
                            ticket=ticket,
                            file_url=file_url,
                            filename=uploaded_file.name,  # Save original filename
                            description=f"File uploaded for ticket {ticket_id}",
                            business=ticket_business
                        )

                        logger.info(f"File saved: {file_path}")

                    except Exception as file_error:
                        logger.error(f"Error saving file {uploaded_file_name}: {str(file_error)}")
                        return Response({
                            "error": f"Failed to save file {uploaded_file_name}",
                            "details": str(file_error)
                        }, status=status.HTTP_400_BAD_REQUEST)

            duplicate_detection = DuplicateDetectionService().process_new_ticket(ticket)
            if duplicate_detection:
                setattr(ticket, "_duplicate_detection", duplicate_detection)
                ticket.refresh_from_db()

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

            # Send notification
            if not (duplicate_detection and duplicate_detection.get("status") == "auto_merged"):
                try:
                    send_ticket_notification.delay(ticket_email_data, department_id)
                except Exception as e:
                    logger.error(f"Error sending notification for ticket {ticket_id}: {str(e)}")
                    # Don't fail the request if notification fails

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

            # Set up customer only when email is provided.
            if creator_email:
                customerExists = Customer.objects.filter(
                    email=creator_email,
                    business=ticket_business,
                ).first()

                if not customerExists:
                    name_parts = (creator_name or "").strip().split()
                    customer = Customer.objects.create(
                        email=creator_email,
                        first_name=name_parts[0] if name_parts else "Customer",
                        last_name=name_parts[-1] if len(name_parts) > 1 else "",
                        phone_number=creator_phone,
                        business=ticket_business,
                        username=creator_email,
                        allow_login=True,
                        is_active=True,
                    )
                    customer.set_unusable_password()
                    customer.save(update_fields=['password'])

            logger.info(f"Ticket {ticket_id} created successfully with SLA tracking")
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

    def search_ticket(self, request, *args, **kwargs):
        ticket_id = kwargs.get('ticket_id')
        businessId = request.data.get('businessId')
        business = Business.objects.filter(id=businessId).first()
        if not business:
            return Response({
                "message": "Business not found"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get ticket with related data using select_related and prefetch_related for optimization
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
                ticket_id=ticket_id,
                business=business
            )
        except Ticket.DoesNotExist:
            return Response({
                "message": "Ticket not found"
            }, status=status.HTTP_400_BAD_REQUEST)


        # Serialize ticket basic information
        sla_due_times = ticket.calculate_sla_due_times()
        ticket_data = {
            "id": ticket.id,
            "ticket_id": ticket.ticket_id,
            "title": ticket.title,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "created_at": ticket.created_at,
            "updated_at": ticket.updated_at,
            "due_date": sla_due_times['resolution_due'] if sla_due_times else None,
            "resolved_at": ticket.resolved_at,
            "is_public": ticket.is_public,
            "tags": ticket.get_tags_list(),
            "breached": ticket.is_sla_breached,
            #
            # Creator information
            "creator_name": ticket.creator_name,
            "creator_email": ticket.creator_email,
            "creator_phone": ticket.creator_phone,

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
            } if ticket.assigned_to else None,
        }

        # Compile final response
        response_data = {
            "ticket": ticket_data,
        }

        return Response(response_data, status=status.HTTP_200_OK)

    @transaction.atomic
    def new_request(self, request, *args, **kwargs):
        try:
            business = Business.objects.get(id=request.data.get("businessId"))
        except Business.DoesNotExist:
            return Response(
                {"massage": "Invalid businessId"},
                status=status.HTTP_400_BAD_REQUEST
            )

        department = None
        department_id = request.data.get("departmentId")
        if department_id:
            try:
                department = Department.objects.get(id=department_id)
            except Department.DoesNotExist:
                return Response(
                    {"massage": "Invalid departmentId"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        Requests.objects.create(
            title=request.data.get("title"),
            description=request.data.get("description"),
            type=request.data.get("type"),
            creator_name=request.data.get("creator_name"),
            creator_email=request.data.get("creator_email"),
            creator_phone=request.data.get("creator_phone"),
            business=business,
            department=department,
            ref_number=f"RQ{uuid.uuid4().hex[:10].upper()}"
        )

        return Response(
            {
                "message": "Request created successfully",
            },
            status=status.HTTP_201_CREATED
        )
