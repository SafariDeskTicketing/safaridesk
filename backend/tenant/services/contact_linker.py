from __future__ import annotations

import logging
from typing import Optional

from tenant.models import Contact

logger = logging.getLogger(__name__)


def link_or_create_contact(
    *,
    business,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    owner=None,
) -> Optional[Contact]:
    """
    Find or create a contact for the given business using email/phone.
    Fills missing fields on existing contact when possible.
    Handles race conditions with atomic get_or_create when email is provided.
    """
    if not any([email, phone, name]):
        logger.warning("[CONTACT] No contact info provided - skipping creation")
        return None

    contact: Optional[Contact] = None
    
    # If email is provided, use get_or_create for atomicity to avoid unique constraint races
    if email:
        try:
            contact, created = Contact.objects.get_or_create(
                business=business,
                email=email,
                defaults={
                    "name": name or email or "Contact",
                    "phone": phone,
                    "owner": owner,
                }
            )
            if created:
                logger.info(
                    f"[CONTACT] ✅ CREATED NEW contact_id={contact.id} "
                    f"business_id={business.id} name={contact.name} "
                    f"email={email} phone={phone}"
                )
                return contact
            else:
                logger.info(f"[CONTACT] Found existing by email={email} id={contact.id}")
        except Exception as e:
            logger.error(f"[CONTACT] Error in get_or_create for email={email}: {str(e)}")
            return None
    
    # Fallback to phone lookup if email not provided
    if not contact and phone:
        contact = Contact.objects.filter(
            business=business,
            phone=phone,
        ).first()
        if contact:
            logger.info(f"[CONTACT] Found existing by phone={phone} id={contact.id}")
    
    # If no contact found by email/phone, create one
    if not contact:
        try:
            contact = Contact.objects.create(
                business=business,
                name=name or phone or "Contact",
                email=email,
                phone=phone,
                owner=owner,
            )
            logger.info(
                f"[CONTACT] ✅ CREATED NEW contact_id={contact.id} "
                f"business_id={business.id} name={contact.name} "
                f"phone={phone}"
            )
            return contact
        except Exception as e:
            logger.error(f"[CONTACT] Error creating contact: {str(e)}")
            return None

    # Revive soft-deleted contact and update missing fields
    update_fields = []
    if contact.is_deleted:
        contact.is_deleted = False
        update_fields.append("is_deleted")
        logger.info(f"[CONTACT] ✅ REVIVED soft-deleted contact_id={contact.id}")
    
    if not contact.is_active:
        contact.is_active = True
        update_fields.append("is_active")
    
    if not contact.name and name:
        contact.name = name
        update_fields.append("name")
    
    if not contact.phone and phone:
        contact.phone = phone
        update_fields.append("phone")
    
    if owner is not None and contact.owner_id != getattr(owner, "id", None):
        contact.owner = owner
        update_fields.append("owner")

    if update_fields:
        contact.save(update_fields=update_fields)
        logger.info(f"[CONTACT] Updated existing contact_id={contact.id} fields={update_fields}")

    return contact
