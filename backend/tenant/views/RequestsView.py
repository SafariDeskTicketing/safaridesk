from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant.models import Requests
from tenant.serializers.DomainValidationSerializer import RequestSerializer


class RequestsView(viewsets.ModelViewSet):

    queryset = Requests.objects.all()
    serializer_class = RequestSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        queryset = Requests.objects.filter(business=request.user.business).order_by('-id')
        # Check for pagination query param
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # If pagination=no or pagination fails
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)