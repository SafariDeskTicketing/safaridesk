# from django.urls import path
# from rest_framework.routers import DefaultRouter
# from tenant.views.AssetViews import AssetCategoryViewSet, VendorViewSet, AssetViewSet
#
# router = DefaultRouter()
# router.register(r'asset-categories', AssetCategoryViewSet)
# router.register(r'vendors', VendorViewSet)
# router.register(r'', AssetViewSet, basename='asset')
#
# urlpatterns = router.urls

from django.urls import path
from rest_framework.routers import DefaultRouter
from tenant.views.AssetViews import (
    AssetCategoryViewSet, VendorViewSet, AssetViewSet, AssetTypeViewSet,
    SupplierViewSet, AssetLocationViewSet, SoftwareLicenseViewSet,
    ContractViewSet, PurchaseViewSet, DisposalViewSet, AssetUserMappingViewSet,
    AssetTicketViewSet, AssetDependencyViewSet, DiscoveryAgentViewSet,
    DiscoveryResultViewSet, SecurityVulnerabilityViewSet, PatchLevelViewSet,
    DepreciationRuleViewSet, AlertViewSet, AuditLogViewSet,
    AssetHistoryViewSet, AssetMaintenanceViewSet
)

router = DefaultRouter()

# Core asset management
router.register(r'asset-categories', AssetCategoryViewSet, basename='asset-category')
router.register(r'vendors', VendorViewSet, basename='vendor')

# Asset classification and types
router.register(r'asset-types', AssetTypeViewSet, basename='asset-type')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'asset-locations', AssetLocationViewSet, basename='asset-location')

# Software and license management
router.register(r'software-licenses', SoftwareLicenseViewSet, basename='software-license')

# Contracts and procurement
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'purchases', PurchaseViewSet, basename='purchase')

# Assignment and relationships
router.register(r'asset-assignments', AssetUserMappingViewSet, basename='asset-assignment')
router.register(r'asset-tickets', AssetTicketViewSet, basename='asset-ticket')
router.register(r'asset-dependencies', AssetDependencyViewSet, basename='asset-dependency')

# Discovery and security
router.register(r'discovery-agents', DiscoveryAgentViewSet, basename='discovery-agent')
router.register(r'discovery-results', DiscoveryResultViewSet, basename='discovery-result')
router.register(r'vulnerabilities', SecurityVulnerabilityViewSet, basename='vulnerability')
router.register(r'patch-levels', PatchLevelViewSet, basename='patch-level')

# Financial management
router.register(r'depreciation-rules', DepreciationRuleViewSet, basename='depreciation-rule')

# Alerts and monitoring
router.register(r'alerts', AlertViewSet, basename='alert')

# Audit and compliance
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

# History and maintenance
router.register(r'asset-history', AssetHistoryViewSet, basename='asset-history')
router.register(r'asset-maintenance', AssetMaintenanceViewSet, basename='asset-maintenance')

# Disposal
router.register(r'disposals', DisposalViewSet, basename='disposal')

# Root asset viewset - MUST BE LAST
router.register(r'', AssetViewSet, basename='asset')

urlpatterns = router.urls
