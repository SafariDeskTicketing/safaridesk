from __future__ import annotations

import logging
import os
import uuid
import re
from typing import Any, Dict, List

from RNSafarideskBack import settings
from RNSafarideskBack.settings import FILE_URL
from tenant.models import Ticket
from tenant.models.TicketModel import TicketReplayAttachment

logger = logging.getLogger(__name__)


def _build_storage_paths(business, subfolder="files"):
    """
    Return (dir_path, url_base) for storing files under MEDIA_ROOT/files/<business_id>/...
    """
    base_media = settings.MEDIA_ROOT
    if business:
        dir_path = os.path.join(base_media, subfolder, str(business.id))
        url_base = f"{FILE_URL}/{business.id}" if FILE_URL else f"{getattr(settings, 'FILE_BASE_URL', '')}/{business.id}"
    else:
        dir_path = os.path.join(base_media, subfolder)
        url_base = FILE_URL or getattr(settings, 'FILE_BASE_URL', '')
    os.makedirs(dir_path, exist_ok=True)
    return dir_path, url_base


def _extract_and_save_base64_images(html_content: str, comment, business) -> str:
    """
    Extract base64-encoded images from HTML content, save them as files,
    create TicketReplayAttachment records, and replace base64 src with file URLs.

    Args:
        html_content: HTML string potentially containing base64 images
        comment: TicketComment instance to attach files to
        business: Business instance for storage path

    Returns:
        Modified HTML with base64 images replaced by file URLs
    """
    import base64

    if not html_content:
        return html_content

    # Regex to find base64 images in img src attributes
    # Matches: src="data:image/png;base64,..." or src='data:image/jpeg;base64,...'
    base64_pattern = re.compile(
        r'src=["\']data:image/(png|jpg|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)["\']',
        re.IGNORECASE
    )

    modified_html = html_content
    matches = list(base64_pattern.finditer(html_content))

    for match in matches:
        try:
            image_type = match.group(1).lower()
            base64_data = match.group(2)
            original_src = match.group(0)

            # Decode base64 to binary
            image_data = base64.b64decode(base64_data)

            # Generate unique filename
            file_extension = f".{image_type}" if image_type != 'jpg' else '.jpeg'
            unique_filename = f"{uuid.uuid4()}{file_extension}"

            # Build storage paths
            properties_dir, url_base = _build_storage_paths(business, subfolder='files')
            file_path = os.path.join(properties_dir, unique_filename)

            # Save file
            with open(file_path, 'wb') as f:
                f.write(image_data)

            # Generate URL
            file_url_base = url_base or FILE_URL or getattr(settings, 'FILE_BASE_URL', '')
            if file_url_base:
                file_url = f"{file_url_base.rstrip('/')}/{unique_filename}"
            else:
                file_url = unique_filename

            # Create attachment record
            TicketReplayAttachment.objects.create(
                comment=comment,
                file_url=file_url,
                filename=f"pasted_image_{uuid.uuid4().hex[:8]}{file_extension}"
            )

            # Replace base64 src with file URL in HTML
            new_src = f'src="{file_url}"'
            modified_html = modified_html.replace(original_src, new_src)

            logger.info(f"Extracted and saved base64 image: {unique_filename}")

        except Exception as e:
            logger.error(f"Failed to extract base64 image: {e}")
            # Continue with other images, don't fail the whole operation
            continue

    return modified_html


def load_attachments(*, ticket_id, user) -> List[Dict[str, Any]]:
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
        id=ticket_id,
        business=user.business,
    )
    merged_children = ticket.merged_children.prefetch_related(
        'comments__author',
        'comments__attachment',
        'attachments'
    ).all()

    # Ticket-level attachments
    attachment_urls = [
        {
            "id": attachment.id,
            "file_url": attachment.file_url,
            "ticket_id": ticket.ticket_id,
        }
        for attachment in ticket.attachments.all()
    ]

    for comment in ticket.comments.all():
        comment_attachment_urls = [
            {
                "id": a.id,
                "file_url": a.file_url,
                "ticket_id": ticket.ticket_id,
            }
            for a in comment.attachment.all()
        ]
        attachment_urls.extend(comment_attachment_urls)

    for child in merged_children:
        attachment_urls.extend(
            [
                {
                    "id": a.id,
                    "file_url": a.file_url,
                    "ticket_id": child.ticket_id,
                }
                for a in child.attachments.all()
            ]
        )
        for comment in child.comments.all():
            attachment_urls.extend(
                [
                    {
                        "id": a.id,
                        "file_url": a.file_url,
                        "ticket_id": child.ticket_id,
                    }
                    for a in comment.attachment.all()
                ]
            )

    # Remove duplicates (optional)
    unique_urls = []
    seen = set()
    for item in attachment_urls:
        key = (item.get("id"), item.get("file_url"), item.get("ticket_id"))
        if key in seen:
            continue
        seen.add(key)
        unique_urls.append(item)

    return unique_urls
