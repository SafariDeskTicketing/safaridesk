from django.db import transaction, IntegrityError
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant.models import Department, DepartmentEmails
from tenant.serializers.DepartmentSerializer import DepartmentSerializer, DepartmentListSerializer
from tenant.services.audit import actor_name, log_audit_event


class DepartmentViewSet(viewsets.ModelViewSet):

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Department.objects.filter(business=self.request.user.business)

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'list':
            return DepartmentListSerializer
        return DepartmentSerializer
    
    def list(self, request, *args, **kwargs):
        """List all ticket categories, with optional pagination"""
        queryset = self.get_queryset().filter(status='A')  # Only active departments

        # Check for optional pagination override
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # Unpaginated fallback
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic()
    def create(self, request, *args, **kwargs):
        """Create a new department"""
        name = request.data.get("name")
        support_email = request.data.get("support_email", "")
        business = request.user.business

        # Check if a department with the same name exists for the user's business
        if self.queryset.filter(name__iexact=name, business=business).exists():
            return Response(
                {"message": "Department with this name already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate email uniqueness
        if support_email and DepartmentEmails.objects.filter(email__iexact=support_email).exists():
            return Response(
                {"message": "This support email is already in use"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            department = Department.objects.create(
                name=name,
                support_email=support_email,
                business=business  # ensure business is linked
            )

            # Create Department Email, if provided
            if support_email:
                DepartmentEmails.objects.create(
                    email=support_email,
                    department=department
                )
            log_audit_event(
                request,
                event_type="DEPARTMENT_CREATED",
                entity_type="department",
                entity=department,
                activity=f"{actor_name(request.user)} created department '{department.name}'",
                metadata={"support_email": support_email},
            )

        except IntegrityError:
            return Response(
                {"message": "An error occurred while creating the department"},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {"message": "Department created successfully"},
            status=status.HTTP_201_CREATED
        )

    @transaction.atomic()
    def update(self, request, *args, **kwargs):
        """Update a department"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)


        if serializer.is_valid():
            before = {
                "name": instance.name,
                "support_email": instance.support_email,
                "status": instance.status,
            }
            department = serializer.save()

            support_email = request.data.get("support_email")
            if support_email:
                # Ensure email is not used by another department
                if DepartmentEmails.objects.filter(email__iexact=support_email).exclude(department=department).exists():
                    return Response(
                        {"message": "This support email is already in use"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # If department has no email → create one
                if not department.emails.exists():
                    DepartmentEmails.objects.create(
                        email=support_email,
                        department=department
                    )
                else:
                    # Update existing email
                    dept_email = department.emails.first()
                    dept_email.email = support_email
                    dept_email.save()
            after = {
                "name": department.name,
                "support_email": department.support_email,
                "status": department.status,
            }
            changed = {
                field: {"old_value": old_value, "new_value": after[field]}
                for field, old_value in before.items()
                if old_value != after[field]
            }
            if changed:
                log_audit_event(
                    request,
                    event_type="DEPARTMENT_UPDATED",
                    entity_type="department",
                    entity=department,
                    activity=f"{actor_name(request.user)} updated department '{department.name}'",
                    metadata={"changes": changed},
                )

            return Response(
                {"message": "Department updated successfully"},
                status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def activate_deactivate_department(self, request, *args, **kwargs):
        """Activate or deactivate a department based on current status"""
        department = Department.objects.filter(id=kwargs.get("pk"), business=request.user.business).first()

        if not department:
            return Response({
                "message": "Department not found"
            }, status=status.HTTP_404_NOT_FOUND)

        # Toggle department status
        department.status = "A" if department.status == "D" else "D"
        department.save()

        # If department is deactivated → also deactivate its email(s)
        if department.status == "D":
            department.emails.update(is_active=False)
        else:
            department.emails.update(is_active=True)

        status_msg = "activated" if department.status == "A" else "deactivated"
        log_audit_event(
            request,
            event_type="DEPARTMENT_UPDATED",
            entity_type="department",
            entity=department,
            activity=f"{actor_name(request.user)} {status_msg} department '{department.name}'",
            metadata={"field_name": "status", "new_value": department.status},
        )

        return Response({
            "message": f"Department successfully {status_msg}"
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Delete a department"""
        instance = self.get_object()
        department_name = instance.name
        with transaction.atomic():
            self.perform_destroy(instance)
            log_audit_event(
                request,
                event_type="DEPARTMENT_DELETED",
                entity_type="department",
                entity=instance,
                activity=f"{actor_name(request.user)} deleted department '{department_name}'",
                metadata={},
                business=request.user.business,
            )
        return Response(
            {'message': f'Department "{department_name}" deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )
