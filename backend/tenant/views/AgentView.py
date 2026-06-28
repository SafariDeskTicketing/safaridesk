from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from shared.services.auth_revocation import invalidate_user_sessions
from shared.tasks import send_welcome_message
from tenant.models import Department
from tenant.serializers.AgentSerializer import AgentSerializer, AgentReadSerializer
from tenant.services.audit import actor_name, log_audit_event
from users.models import Users
from util.Helper import Helper
from util.Mailer import Mailer


class AgentView(viewsets.ModelViewSet):

    queryset = Users.objects.all()
    serializer_class = AgentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return AgentReadSerializer
        return AgentSerializer

    def list(self, request):
        # Agents admin list shows all users except superusers and permanently deleted
        # Deactivated agents still appear here (for admin management) but are filtered out in assignment dropdowns
        queryset = Users.objects.filter(
            business=request.user.business
        ).exclude(
            is_superuser=True
        ).exclude(
            status='D'
        ).order_by('-id')
        
        # Check for pagination query param
        pagination = request.query_params.get('pagination', 'yes').lower()

        # When pagination=no (assignment dropdowns), filter strictly to active agents only
        include_inactive = request.query_params.get('include_inactive', 'false').lower() == 'true'
        if pagination == 'no' and not include_inactive:
            queryset = queryset.filter(is_active=True, status='A')

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # If pagination=no or pagination fails
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        queryset = Users.objects.filter(
            id=kwargs.get('id'),
            business=request.user.business,
        ).exclude(status='D').first()
        if not queryset:
            return Response({"message": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(queryset)

        return Response(serializer.data)


    def deactivate_activate_agent(self, request, *args, **kwargs):
        agent = Users.objects.filter(
            id=kwargs.get('id'),
            business=request.user.business,
        ).first()

        if not agent:
            return Response({
                "message": "Agent not found"
            }, status=status.HTTP_404_NOT_FOUND)

        is_deactivating = agent.is_active
        agent.is_active = not agent.is_active
        agent.status = "I" if is_deactivating else "A"
        if is_deactivating:
            agent.auth_revoked_at = timezone.now()
            agent.auth_session_version += 1
            agent.save(update_fields=["is_active", "status", "auth_revoked_at", "auth_session_version"])
            invalidate_user_sessions(agent, reason="account_deactivated")
        else:
            agent.save(update_fields=["is_active", "status"])

        status_msg = "activated" if agent.is_active else "deactivated"
        tokens_blacklisted = 0

        # If deactivating, blacklist all outstanding refresh tokens for this user.
        if not agent.is_active:
            for token in OutstandingToken.objects.filter(user_id=agent.id):
                _, created = BlacklistedToken.objects.get_or_create(token=token)
                if created:
                    tokens_blacklisted += 1

        log_audit_event(
            request,
            event_type="USER_DEACTIVATED" if is_deactivating else "USER_REACTIVATED",
            entity_type="user",
            entity=agent,
            activity=f"{actor_name(request.user)} {status_msg} User '{agent.get_full_name() or agent.email}'",
            metadata={
                "field_name": "status",
                "old_value": "active" if is_deactivating else "inactive",
                "new_value": "inactive" if is_deactivating else "active",
            },
        )

        return Response({
            "message": f"Agent successfully {status_msg}",
            "tokens_blacklisted": tokens_blacklisted
        }, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        try:
            business = request.user.business
            name = request.data.get('name', '').strip()
            email = request.data.get('email')
            phone_number = request.data.get('phone_number')
            gender = request.data.get('gender', 'other')  # Default to 'other' if not provided
            departments_ids = request.data.get('departments')  # list of department IDs

            # Validate required fields (gender is now optional with default)
            if not name or not email or not phone_number or not departments_ids:
                return Response({"message": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

            name_parts = name.split()
            f_name = name_parts[0] if name_parts else ""
            l_name = " ".join(name_parts[1:]).strip() if len(name_parts) > 1 else ""
            if not f_name:
                return Response({"message": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)

            first_for_username = f_name or "agent"
            last_for_username = l_name or f_name or "agent"
            username = Helper().generate_unique_username(
                first_name=first_for_username,
                last_name=last_for_username,
                business=business
            )


            # Check for existing email or phone
            if Users.objects.filter(email=email, business=business).exists():
                return Response({"message": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

            if Users.objects.filter(phone_number=phone_number).exists():
                return Response({"message": "Phone number already exists."}, status=status.HTTP_400_BAD_REQUEST)

            # Validate all department IDs
            departments = Department.objects.filter(
                id__in=departments_ids,
                business=business,
            )
            if len(departments) != len(departments_ids):
                return Response({"message": "One or more departments are invalid."}, status=status.HTTP_400_BAD_REQUEST)

            # Create user
            role, _ = Group.objects.get_or_create(name='agent')
            password = Helper().generate_random_password()

            print("The user password ==========> ", password)

            agent = Users.objects.create(
                first_name=f_name,
                last_name=l_name,
                username=username,
                email=email,
                phone_number=phone_number,
                is_superuser=False,
                gender=gender,
                business=business,
                is_active=True,
                is_staff=True,
                role=role,
                category="BUSINESS",
                password=make_password(password),
            )
            agent.groups.add(role)

            # Set many-to-many departments
            agent.department.set(departments)

            log_audit_event(
                request,
                event_type="USER_CREATED",
                entity_type="user",
                entity=agent,
                activity=f"{actor_name(request.user)} created User '{agent.get_full_name() or agent.email}'",
                metadata={
                    "email": agent.email,
                    "role": role.name,
                    "departments": [department.name for department in departments],
                },
            )

            # Send welcome message
            send_welcome_message.apply(args=[business.id, agent.id, password]).get()
            log_audit_event(
                request,
                event_type="INVITE_SENT",
                entity_type="user",
                entity=agent,
                activity=f"{actor_name(request.user)} sent invite to User '{agent.get_full_name() or agent.email}'",
                metadata={"email": agent.email},
            )

            return Response({
                "message": "Agent created successfully.",
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"message": f"An error occurred while creating the agent: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        try:
            business = request.user.business
            agent_id = kwargs.get("id")

            # Get the agent to update
            try:
                agent = Users.objects.get(id=agent_id, business=business)
            except Users.DoesNotExist:
                return Response({"message": "Agent not found."}, status=status.HTTP_404_NOT_FOUND)

            # Get data from request
            name = request.data.get('name', '').strip()
            email = request.data.get('email')
            phone_number = request.data.get('phone_number')
            gender = request.data.get('gender', 'other')  # Default to 'other' if not provided
            departments_ids = request.data.get('departments')
            role_name = request.data.get('role')  # Get role from request
            old_role_name = agent.role.name if agent.role else None
            old_agent_values = {
                "name": agent.get_full_name(),
                "email": agent.email,
                "phone_number": agent.phone_number,
                "gender": agent.gender,
                "departments": sorted(agent.department.values_list("name", flat=True)),
            }
            role_changed = False

            # Validate required fields (gender is now optional with default)
            if not name or not email or not phone_number or not departments_ids:
                return Response({"message": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

            name_parts = name.split()
            f_name = name_parts[0] if name_parts else ""
            l_name = " ".join(name_parts[1:]).strip() if len(name_parts) > 1 else ""
            if not f_name:
                return Response({"message": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)

            # Check for existing email (exclude current agent)
            if Users.objects.filter(email=email, business=business).exclude(id=agent_id).exists():
                return Response({"message": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

            # Check for existing phone number (exclude current agent)
            if Users.objects.filter(phone_number=phone_number).exclude(id=agent_id).exists():
                return Response({"message": "Phone number already exists."}, status=status.HTTP_400_BAD_REQUEST)

            # Validate all department IDs
            departments = Department.objects.filter(
                id__in=departments_ids,
                business=business,
            )
            if len(departments) != len(departments_ids):
                return Response({"message": "One or more departments are invalid."}, status=status.HTTP_400_BAD_REQUEST)

            # Update agent fields
            agent.first_name = f_name
            agent.last_name = l_name
            agent.email = email
            agent.phone_number = phone_number
            agent.gender = gender

            # Update role if provided
            if role_name:
                try:
                    role, _ = Group.objects.get_or_create(name=role_name)
                    role_changed = role.name != old_role_name
                    # Clear existing roles and assign the new one
                    agent.groups.clear()
                    agent.groups.add(role)
                    # Also update the agent's role field if it exists
                    agent.role = role
                except Exception as e:
                    return Response(
                        {"message": f"Error updating role: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            agent.save()

            # Update many-to-many departments
            agent.department.set(departments)
            new_agent_values = {
                "name": agent.get_full_name(),
                "email": agent.email,
                "phone_number": agent.phone_number,
                "gender": agent.gender,
                "departments": sorted(agent.department.values_list("name", flat=True)),
            }
            changed_fields = {
                field: {
                    "old_value": old_value,
                    "new_value": new_agent_values[field],
                }
                for field, old_value in old_agent_values.items()
                if old_value != new_agent_values[field]
            }

            if changed_fields:
                log_audit_event(
                    request,
                    event_type="USER_UPDATED",
                    entity_type="user",
                    entity=agent,
                    activity=f"{actor_name(request.user)} updated User '{agent.get_full_name() or agent.email}'",
                    metadata={"changes": changed_fields},
                )

            if role_changed:
                agent.auth_revoked_at = timezone.now()
                agent.auth_session_version += 1
                agent.save(update_fields=["auth_revoked_at", "auth_session_version"])
                invalidate_user_sessions(agent, reason="role_changed")
                log_audit_event(
                    request,
                    event_type="ROLE_CHANGED",
                    entity_type="user",
                    entity=agent,
                    activity=f"{actor_name(request.user)} changed User '{agent.get_full_name() or agent.email}' role from {old_role_name or 'Unassigned'} to {agent.role.name if agent.role else 'Unassigned'}",
                    metadata={
                        "field_name": "role",
                        "old_value": old_role_name or "",
                        "new_value": agent.role.name if agent.role else "",
                    },
                )
                Mailer().send_role_changed_notice(agent)

            return Response({
                "message": "Agent updated successfully.",
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"message": f"An error occurred while updating the agent: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
