from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404

from shared.services.notification_preferences import NotificationSettingsService
from shared.workers.Ticket import ticket_transfer_notification
from tenant.models import Department, Ticket, TicketAttachment, TicketCategories
from tenant.models.SlaXModel import SLA
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.labels import parse_label_ids
from tenant.services.tickets.attachments import _build_storage_paths
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.labels import (
    _get_active_business_labels,
    _get_existing_business_labels_by_names,
    _set_ticket_labels,
)
from tenant.services.tickets.shared import sanitize_text_for_mysql
from users.models import Users
from util.Constants import PRIORITY_DURATION
from tenant.services.contact_linker import link_or_create_contact
from tenant.services.tickets.naming import generate_ticket_id, render_ticket_title
from tenant.services.tickets.reference_resolver import resolve_assignee, resolve_label_ids

logger = logging.getLogger(__name__)

# Used by create_ticket_from_request() below (the web ticket-creation endpoint).
TICKET_TITLE_SUMMARY_MAX_LENGTH = 120
TICKET_TITLE_MAX_LENGTH = 200


@transaction.atomic
def create_ticket_from_payload(
    *,
    business_id: int,
    data: Dict[str, Any],
    source: str = 'web',
) -> Ticket:
    """
    Shared ticket creation flow aligned with TicketView.create().
    Expects keys: title, description, department (id), priority,
    optional: category (id),
    optional: creator_name, creator_email, creator_phone, customer_tier, is_public
    """
    # Get business object for ID generation
    from users.models.BusinessModel import Business
    business = Business.objects.get(id=business_id)
    
    # Generate ticket ID and title using shared naming configuration.
    ticket_id = generate_ticket_id(business=business)
    raw_title = data.get('title')
    creator_name = data.get('creator_name')
    creator_phone = data.get('creator_phone')
    creator_email = data.get('creator_email')
    description = data.get('description')
    category_id = data.get('category') or data.get('category_id')
    department_id = data.get('department') or data.get('department_id')
    assignee_id = data.get('assignee') or data.get('assignee_id')
    
    # Priority: use provided value or fallback
    priority = data.get('priority')
    if not priority:
        priority = 'medium'  # Ultimate fallback
    
    customer_tier = data.get('customer_tier', 'standard')
    is_public = data.get('is_public', True)

    # Required field validation (match shared creation expectations)
    if not all([raw_title, category_id, department_id, priority]):
        raise ValueError("Missing required fields: title, category, department, or priority")

    title = render_ticket_title(
        summary=raw_title,
        ticket_id=ticket_id,
        source=source,
        business=business,
    )

    # Validate category and department
    category = None
    if category_id:
        category = get_object_or_404(TicketCategories, id=category_id, business_id=business_id)
    department = get_object_or_404(Department, id=department_id, business_id=business_id)

    # Attempt to link existing user by email within business
    created_by: Optional[Users] = None
    if creator_email:
        try:
            created_by = Users.objects.filter(email=creator_email, business_id=business_id).first()
        except Exception:
            created_by = None

    raw_tags = data.get('tags') or []
    if isinstance(raw_tags, str):
        raw_tags = [t.strip() for t in raw_tags.split(',') if t.strip()]
    if not isinstance(raw_tags, list):
        raw_tags = []
    tag_value = ",".join(raw_tags) if raw_tags else ""

    label_resolution = resolve_label_ids(business_id, data.get("label_ids") or [])
    if label_resolution["invalid"]:
        raise ValueError("Invalid label_ids for this business")
    if label_resolution["names"]:
        tag_value = ", ".join(label_resolution["names"])

    assignee = None
    if assignee_id:
        assignee_data = resolve_assignee(business_id, assignee_id)
        if not assignee_data:
            raise ValueError("Invalid assignee_id for this business")
        assignee = Users.objects.filter(id=assignee_data["id"], business_id=business_id, is_active=True).first()

    # Create ticket (SLA due dates calculated later)
    ticket = Ticket.objects.create(
        business_id=business_id,
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
        assigned_to=assignee,
        customer_tier=customer_tier,
        is_public=is_public,
        source=source,
        tags=tag_value
    )

    if label_resolution["labels"]:
        ticket.labels.set(label_resolution["labels"])

    # Link or create contact (use business_id directly to ensure correct Business object)
    from users.models.BusinessModel import Business
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        business = Business.objects.get(id=business_id)
        contact = link_or_create_contact(
            business=business,
            name=creator_name,
            email=creator_email,
            phone=creator_phone,
            owner=created_by,
        )
        if contact:
            ticket.contact = contact
            ticket.save(update_fields=["contact"])
            logger.info(
                f"[TICKET_CREATION] Contact linked to ticket ticket_id={ticket_id} "
                f"contact_id={contact.id} name={contact.name} email={contact.email} "
                f"business_id={business_id} source={source}"
            )
        else:
            logger.warning(
                f"[TICKET_CREATION] Contact creation returned None ticket_id={ticket_id} "
                f"creator_name={creator_name} creator_email={creator_email} creator_phone={creator_phone} "
                f"business_id={business_id} source={source}"
            )
    except Business.DoesNotExist:
        logger.error(f"[TICKET_CREATION] Business not found business_id={business_id}")
    except Exception as e:
        logger.error(
            f"[TICKET_CREATION] Contact creation failed ticket_id={ticket_id} "
            f"error={str(e)} business_id={business_id} source={source}",
            exc_info=True
        )

    # Assign SLA by business + priority
    applicable_sla = SLA.objects.filter(
        business_id=business_id,
        is_active=True,
        targets__priority=priority,
    ).first()
    if applicable_sla:
        ticket.sla = applicable_sla
        ticket.save(update_fields=['sla'])

    # Calculate due dates using ticket methods, fallback to PRIORITY_DURATION
    sla_due_times = ticket.calculate_sla_due_times()
    if sla_due_times and sla_due_times.get('resolution_due'):
        ticket.due_date = sla_due_times['resolution_due']
        ticket.save(update_fields=['due_date'])
    else:
        try:
            priority_dict = dict(PRIORITY_DURATION)
            priority_hours_str = priority_dict.get(priority)
            if priority_hours_str:
                priority_hours = int(priority_hours_str)
                ticket.due_date = datetime.now() + timedelta(hours=priority_hours)
                ticket.save(update_fields=['due_date'])
        except Exception:
            pass

    # Add system comment for audit trail (if system user exists)
    # Skip system comment for chatbot-created tickets to avoid noisy activity streams
    if source != "chatbot":
        try:
            system_user = Users.objects.filter(email='system@safaridesk.io').first()
            if system_user:
                ticket.comments.create(
                    ticket=ticket,
                    author=system_user,
                    content=f"Ticket Creation\nTitle: {ticket.title}\nDescription: {ticket.description}",
                    updated_by=system_user,
                    is_internal=False,
                )
        except Exception:
            pass

    duplicate_detection = DuplicateDetectionService().process_new_ticket(ticket, actor=created_by)
    if duplicate_detection:
        setattr(ticket, "_duplicate_detection", duplicate_detection)
        ticket.refresh_from_db()

    return ticket


def create_ticket_from_request(*, request) -> Dict[str, Any]:
    """
    Behavior-preserving extraction of TicketView.create()'s original inline
    logic (the web-facing "create a ticket" endpoint used by agents/admins).

    IMPORTANT: despite create_ticket_from_payload()'s docstring above claiming
    it is "aligned with TicketView.create()", the two flows had already
    diverged by the time this was extracted — e.g. this flow validates
    customer_tier and title length, resolves assignee/labels differently,
    only auto-applies an SLA when SLAConfiguration.sla_enabled is set (and
    prefers auto_apply policies), sets status='assigned' when an assignee is
    present, re-applies assignment after duplicate-detection with its own
    notifications/activity log, handles file uploads, sends in-app
    notifications, writes a TicketActivity + audit log entry, and uses
    actor=request.user (not created_by) for duplicate detection. This
    function intentionally mirrors the view's previous inline behavior 1:1
    rather than being unified with create_ticket_from_payload — that is a
    product decision for a human to make deliberately, not something to do
    silently in a decomposition pass.
    """
    data = request.data
    user = request.user

    # Extract data from request
    raw_title = data.get('title')
    creator_name = data.get('creator_name')
    creator_phone = data.get('creator_phone')
    creator_email = data.get('creator_email')
    description = data.get('description')
    # DB-safe: strip 4-byte characters (e.g. emojis) for MySQL setups that don't support utf8mb4
    description = sanitize_text_for_mysql(description) if description else description
    # Accept both legacy keys (category/department) and frontend keys (category_id/department_id)
    category_id = data.get('category') or data.get('category_id')
    department_id = data.get('department') or data.get('department_id')

    priority = data.get('priority')
    if not priority:
        priority = 'medium'  # Fallback

    customer_tier = data.get('customer_tier', 'standard')  # Add customer tier
    source = data.get('source', 'web')  # Add source field with default 'web'
    is_public = True if str(data.get('is_public')).lower() == 'true' else False
    assignee_id = data.get('assignee_id')
    raw_tags = []
    try:
        raw_tags = data.getlist('tags[]')
    except Exception:
        pass
    if not raw_tags and 'tags' in data:
        maybe_tags = data.get('tags')
        if isinstance(maybe_tags, list):
            raw_tags = maybe_tags
        elif isinstance(maybe_tags, str):
            raw_tags = [t.strip() for t in maybe_tags.split(',') if t.strip()]
    raw_label_ids = []
    try:
        raw_label_ids = data.getlist('label_ids[]')
    except Exception:
        pass
    if not raw_label_ids and 'label_ids' in data:
        maybe_label_ids = data.get('label_ids')
        if isinstance(maybe_label_ids, list):
            raw_label_ids = maybe_label_ids
        elif isinstance(maybe_label_ids, str):
            raw_label_ids = [item.strip() for item in maybe_label_ids.split(',') if item.strip()]
    label_ids = parse_label_ids(raw_label_ids)

    created_by = None

    # Validate required fields
    if not all([raw_title, category_id, department_id, priority]):
        raise TicketActionError(
            {"message": "Missing required fields: title, category, department, or priority"}, 400
        )
    raw_title = str(raw_title).strip()
    if len(raw_title) > TICKET_TITLE_SUMMARY_MAX_LENGTH:
        raise TicketActionError(
            {"message": f"Ticket title is too long. Maximum {TICKET_TITLE_SUMMARY_MAX_LENGTH} characters allowed."},
            400,
        )

    # Generate ticket ID and formatted title using shared naming rules.
    ticket_id = generate_ticket_id(business=user.business)
    title = render_ticket_title(
        summary=raw_title,
        ticket_id=ticket_id,
        source=source,
        business=user.business,
        max_length=None,
    )
    if len(title) > TICKET_TITLE_MAX_LENGTH:
        raise TicketActionError(
            {
                "message": f"Formatted ticket title is too long. Please shorten the title to fit within {TICKET_TITLE_MAX_LENGTH} characters."
            },
            400,
        )

    # Validate customer tier
    valid_tiers = ['premium', 'standard', 'basic']
    if customer_tier not in valid_tiers:
        raise TicketActionError(
            {"message": f"Invalid customer tier. Must be one of: {', '.join(valid_tiers)}"}, 400
        )

    # Get category and department objects
    try:
        category = get_object_or_404(TicketCategories, id=category_id, business=user.business)
    except Http404:
        raise TicketActionError({"message": f"Category with id {category_id} not found"}, 404)

    try:
        department = get_object_or_404(Department, id=department_id, business=user.business)
    except Http404:
        raise TicketActionError({"message": f"Department with id {department_id} not found"}, 404)

    # Check if user already exists
    if creator_email:
        try:
            existing_user = Users.objects.filter(
                email=creator_email,
                business=user.business
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
                business=user.business
            ).first()
            if not assigned_agent:
                raise TicketActionError(
                    {"message": f"Assignee with id {assignee_id} not found for this business"}, 404
                )
        except ValueError:
            raise TicketActionError({"message": "assignee_id must be an integer"}, 400)

    # Normalize tags
    tag_list = []
    for t in raw_tags:
        if isinstance(t, str) and t.strip():
            tag_list.append(t.strip())
    tag_list = list(dict.fromkeys(tag_list))  # dedupe preserving order
    try:
        validated_labels = []
        if label_ids:
            validated_labels = _get_active_business_labels(user, label_ids)
        elif tag_list:
            validated_labels = _get_existing_business_labels_by_names(user, tag_list)
    except ValueError as e:
        raise TicketActionError({"message": str(e)}, 400)

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
            business=user.business,
            name=creator_name,
            email=creator_email,
            phone=creator_phone,
            owner=user if isinstance(user, Users) else None,
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
            sla_config = SLAConfiguration.objects.filter(business=user.business).first()

            if sla_config and sla_config.sla_enabled:
                # First, try to find a policy with auto_apply enabled and matching priority
                applicable_sla = SLA.objects.filter(
                    business=user.business,
                    is_active=True,
                    auto_apply=True,
                    targets__priority=priority
                ).first()

                # If no auto_apply policy found, look for any active policy with matching priority
                if not applicable_sla:
                    applicable_sla = SLA.objects.filter(
                        business=user.business,
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
                logger.info(f"SLA is disabled for business {user.business.name}, skipping auto-assignment")
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
        raise TicketActionError({"message": str(e)}, 400)
    except Exception as e:
        logger.error(f"Error creating ticket or assigning SLA: {str(e)}")
        raise TicketActionError(
            {"message": "Failed to create ticket or assign SLA", "details": str(e)}, 500
        )

    duplicate_detection = DuplicateDetectionService().process_new_ticket(ticket, actor=user)
    if duplicate_detection:
        setattr(ticket, "_duplicate_detection", duplicate_detection)
        ticket.refresh_from_db()

    # Optional assignee at creation (internal only) - mirror assign endpoint behavior
    if assignee_id and not (duplicate_detection and duplicate_detection.get("status") == "auto_merged"):
        try:
            agent = get_object_or_404(Users, id=assignee_id, business=user.business)
        except Http404:
            raise TicketActionError({"message": f"Assignee with id {assignee_id} not found"}, 404)

        old_assignee = ticket.assigned_to
        ticket.assigned_to = agent
        ticket.status = 'assigned'
        ticket.updated_by = user
        ticket.updated_at = datetime.now()
        ticket.save(update_fields=['assigned_to', 'status', 'updated_by', 'updated_at'])

        # Activity log
        from tenant.models import TicketActivity
        TicketActivity.objects.create(
            ticket=ticket,
            user=user,
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
                "assigned_by": user.get_full_name()
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
                    raise TicketActionError({"error": f"File type {file_extension} not allowed"}, 400)

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

            except TicketActionError:
                # Re-raise as-is (e.g. disallowed file type) without falling into
                # the generic handler below, matching the original view's bare
                # `return` (which exited before reaching its except Exception).
                raise
            except Exception as file_error:
                logger.error(f"Error saving file {uploaded_file_name}: {str(file_error)}")
                raise TicketActionError(
                    {"error": f"Failed to save file {uploaded_file_name}", "details": str(file_error)}, 400
                )

    # Prepare email data
    # NOTE: ticket_email_data is built but never used/sent anywhere — dead code
    # carried over unchanged from the original inline view implementation.
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
    activity_user = user if isinstance(user, Users) else (created_by if isinstance(created_by, Users) else None)

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
        activity=f"{actor_name(user)} created Ticket #{ticket.ticket_id} - '{ticket.title}'",
        metadata={
            "entity_identifier": ticket.ticket_id,
            "priority": ticket.priority,
            "status": ticket.status,
            "department": department.name if department else None,
            "category": category.name if category else None,
            "assignee": assigned_agent.get_full_name() if assigned_agent else None,
        },
    )

    return response_data
