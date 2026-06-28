import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from tenant.models.MailIntegrationModel import (
    EmailFilterList,
    EmailFilterLog,
    DEFAULT_FILTER_RULES,
)
from tenant.serializers.EmailFilterSerializer import (
    EmailFilterListSerializer,
    EmailFilterLogSerializer,
)
from util.mail.filter_engine import invalidate_cache

logger = logging.getLogger(__name__)


class EmailFilterListView(APIView):
    """
    GET  /settings/email/filters/   → return the business's filter rules
    PUT  /settings/email/filters/   → save rules and bust cache
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business
        try:
            filter_list = EmailFilterList.objects.get(business=business)
            rules = filter_list.rules
            updated_at = filter_list.updated_at
        except EmailFilterList.DoesNotExist:
            rules = list(DEFAULT_FILTER_RULES)
            updated_at = None
        return Response({"rules": rules, "updated_at": updated_at})

    def put(self, request):
        business = request.user.business
        filter_list, _ = EmailFilterList.objects.get_or_create(business=business)
        serializer = EmailFilterListSerializer(filter_list, data=request.data, partial=False)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        invalidate_cache(business.id)
        logger.info("email_filter_rules_saved", extra={"business_id": business.id, "count": len(filter_list.rules)})
        return Response(serializer.data)


class EmailFilterResetView(APIView):
    """
    POST /settings/email/filters/reset/  → restore pre-configured default rules
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = request.user.business
        filter_list, _ = EmailFilterList.objects.get_or_create(business=business)
        filter_list.rules = list(DEFAULT_FILTER_RULES)
        filter_list.save()
        invalidate_cache(business.id)
        return Response({"rules": filter_list.rules, "updated_at": filter_list.updated_at})


class EmailFilterLogView(APIView):
    """
    GET /settings/email/filters/log/   → paginated block log for the business
    DELETE /settings/email/filters/log/ → clear log for the business
    """
    permission_classes = [IsAuthenticated]
    PAGE_SIZE = 50

    def get(self, request):
        business = request.user.business
        qs = EmailFilterLog.objects.filter(business=business)
        total = qs.count()
        logs = qs[:self.PAGE_SIZE]
        serializer = EmailFilterLogSerializer(logs, many=True)
        return Response({"count": total, "results": serializer.data})

    def delete(self, request):
        business = request.user.business
        deleted, _ = EmailFilterLog.objects.filter(business=business).delete()
        return Response({"deleted": deleted})
