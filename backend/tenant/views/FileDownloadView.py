import mimetypes
import os
from urllib.parse import urlparse

from django.http import FileResponse, Http404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from RNSafarideskBack import settings
from tenant.models import TicketAttachment, TicketReplayAttachment
from tenant.models.TaskModel import TaskAttachment, TaskReplayAttachment


class AttachmentDownloadView(APIView):
    """
    Auth-gated download endpoint that serves attachments from disk with business scoping.
    Supports ticket attachments, ticket comment attachments, task attachments, and task comment attachments.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int, *args, **kwargs):
        attachment, source = self._get_attachment(pk)
        if not attachment:
            raise Http404("Attachment not found")

        # Permission: same business as the attachment's parent object
        business = getattr(source, "business", None)
        if not business or business != request.user.business:
            raise Http404("Attachment not found")

        file_path = self._resolve_path(attachment, business)
        if not file_path or not os.path.exists(file_path):
            raise Http404("File missing on server")

        filename = getattr(attachment, "filename", None) or os.path.basename(file_path)
        content_type, _ = mimetypes.guess_type(filename)
        response = FileResponse(open(file_path, "rb"), content_type=content_type or "application/octet-stream")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    def _get_attachment(self, pk):
        """
        Try to resolve an attachment by ID across supported models.
        Returns (attachment_obj, parent_obj_with_business)
        """
        # TicketAttachment
        att = TicketAttachment.objects.filter(id=pk).select_related("ticket__business").first()
        if att:
            return att, att.ticket

        # TicketReplayAttachment
        att = TicketReplayAttachment.objects.filter(id=pk).select_related("comment__ticket__business").first()
        if att:
            return att, att.comment.ticket

        # TaskAttachment
        att = TaskAttachment.objects.filter(id=pk).select_related("task__business").first()
        if att:
            return att, att.task

        # TaskReplayAttachment
        att = TaskReplayAttachment.objects.filter(id=pk).select_related("comment__task__business").first()
        if att:
            return att, att.comment.task

        return None, None

    def _resolve_path(self, attachment, business):
        """
        Build filesystem path for the attachment based on business-scoped storage.
        """
        # Prefer parsing the stored file_url to extract filename
        file_url = getattr(attachment, "file_url", "") or ""
        parsed = urlparse(file_url)
        filename = os.path.basename(parsed.path) if parsed.path else None
        if not filename:
            return None
        # business-scoped files live under MEDIA_ROOT/files/<business_id>/<filename>
        return os.path.join(settings.MEDIA_ROOT, "files", str(business.id), filename)
