from django.db import IntegrityError, transaction
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant.models import Label
from tenant.serializers.LabelSerializer import LabelSerializer, LabelUpdateSerializer


class LabelViewSet(viewsets.ModelViewSet):
    queryset = Label.objects.all()
    serializer_class = LabelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Label.objects.for_business().order_by("name", "-id")
        active_only = self.request.query_params.get("active_only")
        if active_only and active_only.lower() in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)
        return queryset

    def get_serializer_class(self):
        if self.action in {"update", "partial_update"}:
            return LabelUpdateSerializer
        return LabelSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        pagination = request.query_params.get("pagination", "yes").lower()

        if pagination != "no":
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            serializer.save(business=request.user.business)
        except IntegrityError:
            return Response(
                {"message": "Label name must be unique per business."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Label created successfully",
                "label": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {"message": "Label name must be unique per business."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Label updated successfully",
                "label": LabelSerializer(instance).data,
            },
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(
            {"message": "Label deleted successfully"},
            status=status.HTTP_200_OK,
        )
