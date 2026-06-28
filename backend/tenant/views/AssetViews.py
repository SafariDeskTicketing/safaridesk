from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db import models
from django.utils import timezone

from tenant.models.AssetModel import (
    AssetCategory, Vendor, Asset, AssetType, Supplier, AssetLocation,
    SoftwareLicense, Contract, Purchase, Disposal, AssetUserMapping,
    AssetTicket, AssetDependency, DiscoveryAgent, DiscoveryResult,
    SecurityVulnerability, PatchLevel, DepreciationRule, Alert, AuditLog,
    AssetHistory, AssetMaintenance
)

from tenant.serializers.AssetSerializer import (
    AssetCategorySerializer, VendorSerializer, AssetSerializer,
    AssetTypeSerializer, SupplierSerializer, AssetLocationSerializer,
    SoftwareLicenseSerializer, ContractSerializer, PurchaseSerializer,
    DisposalSerializer, AssetUserMappingSerializer, AssetTicketSerializer,
    AssetDependencySerializer, DiscoveryAgentSerializer, DiscoveryResultSerializer,
    SecurityVulnerabilitySerializer, PatchLevelSerializer, DepreciationRuleSerializer,
    AlertSerializer, AuditLogSerializer, AssetHistorySerializer, AssetMaintenanceSerializer
)


class AssetCategoryViewSet(viewsets.ModelViewSet):
    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return AssetCategory.objects.filter(business=self.request.user.business)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # If pagination=no or pagination fails
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return Vendor.objects.filter(business=self.request.user.business)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # If pagination=no or pagination fails
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class AssetTypeViewSet(viewsets.ModelViewSet):
    queryset = AssetType.objects.all()
    serializer_class = AssetTypeSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["type_category", "requires_assignment", "requires_license", "has_physical_presence"]
    search_fields = ["name", "description"]
    ordering_fields = ["type_category", "name", "created_at"]

    def get_queryset(self):
        return AssetType.objects.filter(business=self.request.user.business)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "supplier_category"]
    search_fields = ["name", "contact_person", "email"]
    ordering_fields = ["name", "is_active", "created_at"]

    def get_queryset(self):
        return Supplier.objects.filter(business=self.request.user.business)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # If pagination=no or pagination fails
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class AssetLocationViewSet(viewsets.ModelViewSet):
    queryset = AssetLocation.objects.all()
    serializer_class = AssetLocationSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["location_type", "is_active", "city", "country"]
    search_fields = ["name", "address", "postal_code"]
    ordering_fields = ["location_type", "name", "created_at"]

    def get_queryset(self):
        return AssetLocation.objects.filter(business=self.request.user.business)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # If pagination=no or pagination fails
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class SoftwareLicenseViewSet(viewsets.ModelViewSet):
    queryset = SoftwareLicense.objects.all()
    serializer_class = SoftwareLicenseSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["license_type", "compliance_status", "auto_renewal", "vendor"]
    search_fields = ["name", "version", "license_key", "vendor__name"]
    ordering_fields = ["name", "expiration_date", "compliance_status", "created_at"]

    def get_queryset(self):
        return SoftwareLicense.objects.filter(business=self.request.user.business)


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["contract_type", "is_active", "auto_renewal", "vendor", "supplier"]
    search_fields = ["name", "contract_number", "vendor__name"]
    ordering_fields = ["name", "end_date", "is_active", "contract_type"]

    def get_queryset(self):
        return Contract.objects.filter(business=self.request.user.business)


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all()
    serializer_class = PurchaseSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "supplier", "vendor", "priority"]
    search_fields = ["asset_name", "po_number", "invoice_number"]
    ordering_fields = ["asset_name", "status", "purchase_date", "delivery_date"]

    def get_queryset(self):
        return Purchase.objects.filter(business=self.request.user.business)


class DisposalViewSet(viewsets.ModelViewSet):
    queryset = Disposal.objects.all()
    serializer_class = DisposalSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["disposal_method"]
    search_fields = ["asset__name", "asset__serial_number", "certificate_number"]
    ordering_fields = ["disposal_date", "asset__name"]

    def get_queryset(self):
        return Disposal.objects.filter(business=self.request.user.business)


class AssetUserMappingViewSet(viewsets.ModelViewSet):
    queryset = AssetUserMapping.objects.all()
    serializer_class = AssetUserMappingSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["role", "is_active", "asset", "user"]
    search_fields = ["asset__name", "asset__serial_number", "user__email", "user__first_name", "user__last_name"]
    ordering_fields = ["asset__name", "user__email", "assigned_date", "is_active"]

    def get_queryset(self):
        return AssetUserMapping.objects.filter(asset__business=self.request.user.business)


class AssetTicketViewSet(viewsets.ModelViewSet):
    queryset = AssetTicket.objects.all()
    serializer_class = AssetTicketSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["relationship_type", "impact_level", "asset", "ticket"]
    search_fields = ["asset__name", "asset__serial_number", "ticket__ref_number", "ticket__title"]
    ordering_fields = ["asset__name", "ticket__ref_number", "relationship_type"]

    def get_queryset(self):
        return AssetTicket.objects.filter(asset__business=self.request.user.business)


class AssetDependencyViewSet(viewsets.ModelViewSet):
    queryset = AssetDependency.objects.all()
    serializer_class = AssetDependencySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["dependency_type", "criticality_level", "is_active", "asset", "dependent_asset"]
    search_fields = ["asset__name", "dependent_asset__name", "description"]
    ordering_fields = ["asset__name", "dependent_asset__name", "dependency_type"]

    def get_queryset(self):
        return AssetDependency.objects.filter(asset__business=self.request.user.business)


class DiscoveryAgentViewSet(viewsets.ModelViewSet):
    queryset = DiscoveryAgent.objects.all()
    serializer_class = DiscoveryAgentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["agent_type", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "last_run", "agent_type"]

    def get_queryset(self):
        return DiscoveryAgent.objects.filter(business=self.request.user.business)


class DiscoveryResultViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DiscoveryResult.objects.all()
    serializer_class = DiscoveryResultSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["agent", "disposition", "matched_asset"]
    search_fields = ["discovered_hostname", "discovered_ip", "review_notes"]
    ordering_fields = ["discovered_hostname", "confidence_score", "disposition"]

    def get_queryset(self):
        return DiscoveryResult.objects.filter(agent__business=self.request.user.business)


class SecurityVulnerabilityViewSet(viewsets.ModelViewSet):
    queryset = SecurityVulnerability.objects.all()
    serializer_class = SecurityVulnerabilitySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["severity", "remediation_status", "patch_available", "asset"]
    search_fields = ["title", "cve_id", "affected_component", "asset__name"]
    ordering_fields = ["asset__name", "severity", "cvss_score", "detection_date"]

    def get_queryset(self):
        return SecurityVulnerability.objects.filter(asset__business=self.request.user.business)


class PatchLevelViewSet(viewsets.ModelViewSet):
    queryset = PatchLevel.objects.all()
    serializer_class = PatchLevelSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["patch_status", "is_critical", "auto_update_enabled", "asset"]
    search_fields = ["software_name", "patch_source", "asset__name"]
    ordering_fields = ["asset__name", "software_name", "patch_status"]

    def get_queryset(self):
        return PatchLevel.objects.filter(asset__business=self.request.user.business)


class DepreciationRuleViewSet(viewsets.ModelViewSet):
    queryset = DepreciationRule.objects.all()
    serializer_class = DepreciationRuleSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["rule_type", "is_default", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "rule_type", "is_default"]

    def get_queryset(self):
        return DepreciationRule.objects.filter(business=self.request.user.business)


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["alert_type", "priority", "is_active", "is_acknowledged", "related_asset", "related_contract", "related_license"]
    search_fields = ["title", "description"]
    ordering_fields = ["title", "due_date", "priority", "is_active"]

    def get_queryset(self):
        return Alert.objects.filter(business=self.request.user.business)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.acknowledge(request.user)
        serializer = self.get_serializer(alert)
        return Response(serializer.data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["action_type", "model_name", "compliance_required", "risk_level", "asset", "user"]
    search_fields = ["model_name", "object_name", "field_name", "old_value", "new_value"]
    ordering_fields = ["created_at", "action_type", "model_name", "risk_level"]

    def get_queryset(self):
        return AuditLog.objects.filter(business=self.request.user.business)


class AssetHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AssetHistory.objects.all()
    serializer_class = AssetHistorySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["action", "asset"]
    search_fields = ["description", "old_value", "new_value"]
    ordering_fields = ["timestamp", "action"]

    def get_queryset(self):
        return AssetHistory.objects.filter(asset__business=self.request.user.business)


class AssetMaintenanceViewSet(viewsets.ModelViewSet):
    queryset = AssetMaintenance.objects.all()
    serializer_class = AssetMaintenanceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["maintenance_type", "status", "asset"]
    search_fields = ["title", "description", "notes"]
    ordering_fields = ["scheduled_date", "completed_date", "status"]

    def get_queryset(self):
        return AssetMaintenance.objects.filter(asset__business=self.request.user.business)


class AssetViewSet(viewsets.ModelViewSet):
    @action(detail=True, methods=['get'])
    def assignments(self, request, pk=None):
        """Get all user assignments for an asset"""
        asset = self.get_object()
        assignments = AssetUserMapping.objects.filter(asset=asset).select_related('user')
        serializer = AssetUserMappingSerializer(assignments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def maintenance(self, request, pk=None):
        """Get all maintenance records for an asset"""
        asset = self.get_object()
        records = AssetMaintenance.objects.filter(asset=asset).order_by('-scheduled_date')
        serializer = AssetMaintenanceSerializer(records, many=True)
        return Response(serializer.data)



    @action(detail=True, methods=['post'])
    def add_maintenance(self, request, pk=None):
        """Add a maintenance record for an asset"""
        asset = self.get_object()
        serializer = AssetMaintenanceSerializer(data={
            **request.data,
            'asset': asset.id
        })
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Maintenance record added successfully', 'maintenance': serializer.data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def link_ticket(self, request, pk=None):
        """Link a ticket to an asset"""
        asset = self.get_object()
        serializer = AssetTicketSerializer(data={
            **request.data,
            'asset': asset.id
        })
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Ticket linked successfully', 'ticket_link': serializer.data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get asset history"""
        asset = self.get_object()
        history = AssetHistory.objects.filter(asset=asset).order_by('-timestamp')
        serializer = AssetHistorySerializer(history, many=True)
        return Response(serializer.data)
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "category", "vendor", "condition", "is_critical"]
    search_fields = ["name", "serial_number", "description", "asset_tag", "brand", "model"]
    ordering_fields = [
        "name", "serial_number", "purchase_date", "status",
        "category", "vendor", "condition", "created_at"
    ]

    def get_queryset(self):
        queryset = Asset.objects.filter(business=self.request.user.business).order_by('-created_at')
        # Select related objects to prevent N+1 queries
        queryset = queryset.select_related('category', 'vendor')
        # Filter for only active assignments
        queryset = queryset.prefetch_related(
            models.Prefetch('user_mappings', queryset=AssetUserMapping.objects.filter(is_active=True))
        )
        return queryset

    def perform_create(self, serializer):
        """Set the business on the asset during creation"""
        serializer.save(business=self.request.user.business)



    @action(detail=True, methods=['post'], url_path='assign-user')
    def assign_user(self, request, pk=None):
        """Assign a user to this asset"""
        asset = self.get_object()
        data = request.data

        # Validate required fields
        user_id = data.get('user')
        role = data.get('role', 'primary')
        is_active = data.get('is_active', True)

        if not user_id:
            return Response({'detail': 'User is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for existing assignment with same role (if this is an active assignment)
        if is_active:
            existing_assignment = AssetUserMapping.objects.filter(
                asset=asset,
                role=role,
                is_active=True
            ).exclude(user_id=user_id).first()

            if existing_assignment:
                return Response({
                    'detail': f'Cannot assign user. Asset already has an active assignment with role "{role}". Please unassign the current user first.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Create or update assignment
        assignment, created = AssetUserMapping.objects.update_or_create(
            asset=asset,
            user_id=user_id,
            defaults={
                'role': role,
                'is_active': is_active,
                'business': asset.business
            }
        )

        serializer = AssetUserMappingSerializer(assignment)
        return Response({
            'detail': f'User {"assigned" if created else "updated"} successfully',
            'assignment': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='add-maintenance')
    def add_maintenance(self, request, pk=None):
        """Add a maintenance record for this asset"""
        asset = self.get_object()
        data = request.data

        # Validate required fields
        title = data.get('title')
        if not title:
            return Response({'detail': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create maintenance record
        from tenant.models.AssetModel import AssetMaintenance
        maintenance = AssetMaintenance.objects.create(
            asset=asset,
            title=title,
            description=data.get('description', ''),
            maintenance_type=data.get('maintenance_type', 'preventive'),
            priority=data.get('priority', 'medium'),
            status='scheduled',
            scheduled_date=data.get('scheduled_date'),
            estimated_cost=data.get('estimated_cost'),
            assigned_to=data.get('assigned_to'),
            notes=data.get('notes', ''),
            business=asset.business
        )

        serializer = AssetMaintenanceSerializer(maintenance)
        return Response({
            'detail': 'Maintenance record created successfully',
            'maintenance': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='link-ticket')
    def link_ticket(self, request, pk=None):
        """Link a ticket to this asset"""
        asset = self.get_object()
        data = request.data

        ticket_id = data.get('ticket')
        relationship_type = data.get('relationship_type', 'related')
        if not ticket_id:
            return Response({'detail': 'Ticket is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create linkage
        from tenant.models.AssetModel import AssetTicket
        linkage, created = AssetTicket.objects.get_or_create(
            asset=asset,
            ticket_id=ticket_id,
            defaults={
                'relationship_type': relationship_type,
                'business': asset.business
            }
        )

        if not created:
            linkage.relationship_type = relationship_type
            linkage.save()

        serializer = AssetTicketSerializer(linkage)
        return Response({
            'detail': f'Ticket {"linked" if created else "updated"} successfully',
            'linkage': serializer.data
        })

    @action(detail=False, methods=['post'], url_path='destroy-multiple')
    def destroy_multiple(self, request, *args, **kwargs):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'No IDs provided for deletion.'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = Asset.objects.filter(id__in=ids, business=self.request.user.business).delete()
        return Response({'detail': f'{deleted_count} assets deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def dependencies(self, request, pk=None):
        """Get all dependencies for an asset"""
        asset = self.get_object()
        upstream = AssetDependency.objects.filter(asset=asset, is_active=True)
        downstream = AssetDependency.objects.filter(dependent_asset=asset, is_active=True)

        return Response({
            'upstream': AssetDependencySerializer(upstream, many=True).data,
            'downstream': AssetDependencySerializer(downstream, many=True).data
        })

    @action(detail=True, methods=['get'])
    def tickets(self, request, pk=None):
        """Get all tickets linked to this asset"""
        asset = self.get_object()
        asset_tickets = AssetTicket.objects.filter(asset=asset).select_related('ticket')

        return Response(AssetTicketSerializer(asset_tickets, many=True).data)

    @action(detail=True, methods=['get'])
    def vulnerabilities(self, request, pk=None):
        """Get all vulnerabilities for this asset"""
        asset = self.get_object()
        vulnerabilities = SecurityVulnerability.objects.filter(asset=asset)

        return Response(SecurityVulnerabilitySerializer(vulnerabilities, many=True).data)

    @action(detail=True, methods=['get'])
    def alerts(self, request, pk=None):
        """Get all active alerts for this asset"""
        asset = self.get_object()
        alerts = Alert.objects.filter(related_asset=asset, is_active=True)

        return Response(AlertSerializer(alerts, many=True).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        """Get asset dashboard statistics"""
        business = request.user.business

        total_assets = Asset.objects.filter(business=business).count()
        available_assets = Asset.objects.filter(business=business, status='available').count()
        in_use_assets = Asset.objects.filter(business=business, status='in_use').count()
        maintenance_assets = Asset.objects.filter(business=business, status='maintenance').count()
        critical_assets = Asset.objects.filter(business=business, is_critical=True).count()

        # Warranty expiring soon (within 30 days)
        from django.utils import timezone
        from datetime import timedelta
        thirty_days_from_now = timezone.now().date() + timedelta(days=30)
        warranty_expiring = Asset.objects.filter(
            business=business,
            warranty_end_date__lte=thirty_days_from_now,
            warranty_end_date__gte=timezone.now().date()
        ).count()

        # Maintenance overdue
        overdue_maintenance = AssetMaintenance.objects.filter(
            asset__business=business,
            status__in=['scheduled', 'in_progress'],
            scheduled_date__lt=timezone.now().date()
        ).count()

        # Status distribution
        status_counts = Asset.objects.filter(business=business).values('status').annotate(
            count=models.Count('status')
        ).order_by('status')

        # Category distribution
        category_counts = Asset.objects.filter(business=business).values(
            'category__name'
        ).annotate(count=models.Count('category')).order_by('-count')[:10]

        # Recent assets
        recent_assets = Asset.objects.filter(business=business).order_by('-created_at')[:5]
        recent_assets_data = AssetSerializer(recent_assets, many=True).data

        # Upcoming maintenance
        upcoming_maintenance = AssetMaintenance.objects.filter(
            asset__business=business,
            status__in=['scheduled'],
            scheduled_date__gte=timezone.now().date()
        ).order_by('scheduled_date')[:5]

        # Critical vulnerabilities
        critical_vulns = SecurityVulnerability.objects.filter(
            asset__business=business,
            severity__in=['high', 'critical'],
            remediation_status__in=['open', 'mitigated']
        ).count()

        return Response({
            'total_assets': total_assets,
            'available_assets': available_assets,
            'in_use_assets': in_use_assets,
            'maintenance_assets': maintenance_assets,
            'critical_assets': critical_assets,
            'warranty_expiring': warranty_expiring,
            'overdue_maintenance': overdue_maintenance,
            'status_distribution': list(status_counts),
            'category_distribution': list(category_counts),
            'recent_assets': recent_assets_data,
            'upcoming_maintenance': AssetMaintenanceSerializer(upcoming_maintenance, many=True).data,
            'critical_vulnerabilities': critical_vulns
        })
