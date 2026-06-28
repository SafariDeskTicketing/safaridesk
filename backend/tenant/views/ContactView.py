from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant.models import Contact
from tenant.serializers.ContactSerializer import ContactSerializer
from tenant.services.audit import actor_name, log_audit_event
from shared.services.ticket_broadcast import broadcast_contact_event


CONTACT_AUDITED_FIELDS = ("name", "email", "phone", "notes", "tags")


def _audit_value(value):
    if isinstance(value, list):
        return list(value)
    if value is None:
        return ""
    return value


class ContactPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ContactViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ContactSerializer
    pagination_class = ContactPagination

    def get_queryset(self):
        qs = Contact.objects.filter(
            business=self.request.user.business,
            is_deleted=False,
        )

        # List views are mutually exclusive: active contacts by default, archived
        # contacts only when show_archived=true. Detail and restore can load both.
        show_archived = self.request.query_params.get("show_archived", "false").lower() == "true"
        include_archived_by_action = getattr(self, "action", None) in {"retrieve", "restore"}
        if not include_archived_by_action:
            qs = qs.filter(is_active=not show_archived)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )

        tags = self.request.query_params.get("tags")
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
            for tag in tag_list:
                qs = qs.filter(tags__contains=[tag])

        return qs.order_by("-id")

    def _can_manage(self, contact: Contact) -> bool:
        user = self.request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return True
        role_name = getattr(getattr(user, "role", None), "name", "").lower()
        if role_name == "admin":
            return True
        return contact.owner_id == user.id

    def _snapshot_contact(self, contact: Contact) -> dict:
        return {field: _audit_value(getattr(contact, field)) for field in CONTACT_AUDITED_FIELDS}

    def _log_contact_updates(self, request, contact: Contact, before: dict) -> None:
        after = self._snapshot_contact(contact)
        for field, old_value in before.items():
            new_value = after[field]
            if old_value != new_value:
                log_audit_event(
                    request,
                    event_type="CONTACT_UPDATED",
                    entity_type="contact",
                    entity=contact,
                    activity=f"{actor_name(request.user)} updated Contact '{contact.name}' {field}",
                    metadata={"field_name": field, "old_value": old_value, "new_value": new_value},
                )

    def perform_create(self, serializer):
        contact = serializer.save(
            business=self.request.user.business,
            owner=self.request.user,
        )
        log_audit_event(
            self.request,
            event_type="CONTACT_CREATED",
            entity_type="contact",
            entity=contact,
            activity=f"{actor_name(self.request.user)} created Contact '{contact.name}'",
            metadata={"email": contact.email or ""},
        )
        broadcast_contact_event(contact.business_id, {"action": "created", "contact_id": contact.id})

    def update(self, request, *args, **kwargs):
        contact = self.get_object()
        if not self._can_manage(contact):
            return Response({"message": "Not authorized to update this contact."}, status=status.HTTP_403_FORBIDDEN)
        before = self._snapshot_contact(contact)
        response = super().update(request, *args, **kwargs)
        contact.refresh_from_db()
        self._log_contact_updates(request, contact, before)
        broadcast_contact_event(contact.business_id, {"action": "updated", "contact_id": contact.id})
        return response

    def partial_update(self, request, *args, **kwargs):
        contact = self.get_object()
        if not self._can_manage(contact):
            return Response({"message": "Not authorized to update this contact."}, status=status.HTTP_403_FORBIDDEN)
        before = self._snapshot_contact(contact)
        response = super().partial_update(request, *args, **kwargs)
        contact.refresh_from_db()
        self._log_contact_updates(request, contact, before)
        broadcast_contact_event(contact.business_id, {"action": "updated", "contact_id": contact.id})
        return response

    def destroy(self, request, *args, **kwargs):
        contact = self.get_object()
        if not self._can_manage(contact):
            return Response({"message": "Not authorized to delete this contact."}, status=status.HTTP_403_FORBIDDEN)

        ticket_count = contact.ticket_set.count() if hasattr(contact, "ticket_set") else contact.tickets.count()
        if ticket_count > 0:
            return Response(
                {
                    "message": f"This contact cannot be deleted because they are associated with {ticket_count} ticket(s). Please deactivate the contact instead.",
                    "ticket_count": ticket_count,
                    "can_archive": True,
                },
                status=status.HTTP_409_CONFLICT,
            )

        contact.is_deleted = True
        contact.is_active = False
        contact.save(update_fields=["is_deleted", "is_active"])
        log_audit_event(
            request,
            event_type="CONTACT_DELETED",
            entity_type="contact",
            entity=contact,
            activity=f"{actor_name(request.user)} deleted Contact '{contact.name}'",
            metadata={"email": contact.email or ""},
        )
        broadcast_contact_event(contact.business_id, {"action": "deleted", "contact_id": contact.id})
        return Response({"message": "Contact deleted successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="archive")
    def archive(self, request, pk=None):
        contact = self.get_object()
        if not self._can_manage(contact):
            return Response({"message": "Not authorized to archive this contact."}, status=status.HTTP_403_FORBIDDEN)
        contact.is_active = False
        contact.save(update_fields=["is_active"])
        log_audit_event(
            request,
            event_type="CONTACT_ARCHIVED",
            entity_type="contact",
            entity=contact,
            activity=f"{actor_name(request.user)} archived Contact '{contact.name}'",
            metadata={"email": contact.email or ""},
        )
        broadcast_contact_event(contact.business_id, {"action": "archived", "contact_id": contact.id})
        return Response({"message": "Contact archived successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="restore")
    def restore(self, request, pk=None):
        contact = self.get_object()
        if not self._can_manage(contact):
            return Response({"message": "Not authorized to restore this contact."}, status=status.HTTP_403_FORBIDDEN)
        contact.is_active = True
        contact.save(update_fields=["is_active"])
        log_audit_event(
            request,
            event_type="CONTACT_RESTORED",
            entity_type="contact",
            entity=contact,
            activity=f"{actor_name(request.user)} restored Contact '{contact.name}'",
            metadata={"email": contact.email or ""},
        )
        broadcast_contact_event(contact.business_id, {"action": "restored", "contact_id": contact.id})
        return Response({"message": "Contact restored successfully."}, status=status.HTTP_200_OK)
