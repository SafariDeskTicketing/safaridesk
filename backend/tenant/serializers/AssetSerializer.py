from rest_framework import serializers
from tenant.models.AssetModel import (
    AssetCategory, Vendor, Asset, AssetType, Supplier, AssetLocation,
    SoftwareLicense, Contract, Purchase, Disposal, AssetUserMapping,
    AssetTicket, AssetDependency, DiscoveryAgent, DiscoveryResult,
    SecurityVulnerability, PatchLevel, DepreciationRule, Alert, AuditLog,
    AssetHistory, AssetMaintenance
)


class AssetCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetCategory
        fields = "__all__"


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = "__all__"


class AssetTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetType
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "email", "phone", "address", "website", "is_active", "supplier_category", "notes", "created_at", "updated_at"]


class AssetLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetLocation
        fields = "__all__"


class SoftwareLicenseSerializer(serializers.ModelSerializer):
    vendor_detail = VendorSerializer(source="vendor", read_only=True)

    class Meta:
        model = SoftwareLicense
        fields = "__all__"


class ContractSerializer(serializers.ModelSerializer):
    vendor_detail = VendorSerializer(source="vendor", read_only=True)
    supplier_detail = SupplierSerializer(source="supplier", read_only=True)

    class Meta:
        model = Contract
        fields = "__all__"


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_detail = SupplierSerializer(source="supplier", read_only=True)
    vendor_detail = VendorSerializer(source="vendor", read_only=True)

    class Meta:
        model = Purchase
        fields = "__all__"


class DisposalSerializer(serializers.ModelSerializer):
    approved_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = Disposal
        fields = "__all__"

    def get_approved_by_detail(self, obj):
        if obj.approved_by:
            return {
                "id": obj.approved_by.id,
                "name": obj.approved_by.get_full_name() or obj.approved_by.email
            }
        return None


class AssetUserMappingSerializer(serializers.ModelSerializer):
    user_detail = serializers.SerializerMethodField()
    asset_detail = serializers.SerializerMethodField()

    class Meta:
        model = AssetUserMapping
        fields = "__all__"

    def get_user_detail(self, obj):
        return {
            "id": obj.user.id,
            "name": obj.user.get_full_name() or obj.user.email,
            "email": obj.user.email
        }

    def get_asset_detail(self, obj):
        return {
            "id": obj.asset.id,
            "name": obj.asset.name,
            "serial_number": obj.asset.serial_number
        }


class AssetTicketSerializer(serializers.ModelSerializer):
    asset_detail = serializers.SerializerMethodField()
    ticket_detail = serializers.SerializerMethodField()

    class Meta:
        model = AssetTicket
        fields = "__all__"

    def get_asset_detail(self, obj):
        return {
            "id": obj.asset.id,
            "name": obj.asset.name,
            "serial_number": obj.asset.serial_number
        }

    def get_ticket_detail(self, obj):
        return {
            "id": obj.ticket.id,
            "ref_number": obj.ticket.ticket_id,
            "title": obj.ticket.title,
            "status": obj.ticket.status,
        }


class AssetDependencySerializer(serializers.ModelSerializer):
    asset_detail = serializers.SerializerMethodField()
    dependent_asset_detail = serializers.SerializerMethodField()

    class Meta:
        model = AssetDependency
        fields = "__all__"

    def get_asset_detail(self, obj):
        return {
            "id": obj.asset.id,
            "name": obj.asset.name
        }

    def get_dependent_asset_detail(self, obj):
        return {
            "id": obj.dependent_asset.id,
            "name": obj.dependent_asset.name
        }


class DiscoveryAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveryAgent
        fields = "__all__"


class DiscoveryResultSerializer(serializers.ModelSerializer):
    agent_detail = DiscoveryAgentSerializer(source="agent", read_only=True)

    class Meta:
        model = DiscoveryResult
        fields = "__all__"


class SecurityVulnerabilitySerializer(serializers.ModelSerializer):
    asset_detail = serializers.SerializerMethodField()

    class Meta:
        model = SecurityVulnerability
        fields = "__all__"

    def get_asset_detail(self, obj):
        return {
            "id": obj.asset.id,
            "name": obj.asset.name,
            "serial_number": obj.asset.serial_number
        }


class PatchLevelSerializer(serializers.ModelSerializer):
    asset_detail = serializers.SerializerMethodField()

    class Meta:
        model = PatchLevel
        fields = "__all__"

    def get_asset_detail(self, obj):
        return {
            "id": obj.asset.id,
            "name": obj.asset.name
        }


class DepreciationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DepreciationRule
        fields = "__all__"


class AlertSerializer(serializers.ModelSerializer):
    acknowledged_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = "__all__"

    def get_acknowledged_by_detail(self, obj):
        if obj.acknowledged_by:
            return {
                "id": obj.acknowledged_by.id,
                "name": obj.acknowledged_by.get_full_name() or obj.acknowledged_by.email
            }
        return None


class AuditLogSerializer(serializers.ModelSerializer):
    user_detail = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = "__all__"

    def get_user_detail(self, obj):
        if obj.user:
            return {
                "id": obj.user.id,
                "name": obj.user.get_full_name() or obj.user.email,
                "email": obj.user.email
            }
        return None


class AssetHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetHistory
        fields = "__all__"


class AssetMaintenanceSerializer(serializers.ModelSerializer):
    asset_detail = serializers.SerializerMethodField()

    class Meta:
        model = AssetMaintenance
        fields = "__all__"

    def get_asset_detail(self, obj):
        return {
            "id": obj.asset.id,
            "name": obj.asset.name,
            "serial_number": obj.asset.serial_number
        }


class AssetSerializer(serializers.ModelSerializer):
    category_detail = AssetCategorySerializer(source="category", read_only=True)
    vendor_detail = VendorSerializer(source="vendor", read_only=True)
    active_assignments = AssetUserMappingSerializer(source="user_mappings", many=True, read_only=True)

    class Meta:
        model = Asset
        fields = [
            "id", "name", "description", "category", "vendor", "asset_tag",
            "brand", "model", "serial_number", "status", "condition",
            "location", "purchase_price", "purchase_date", "supplier",
            "invoice_number", "warranty_start_date", "warranty_end_date",
            "last_maintenance", "next_maintenance", "notes", "is_critical",
            "created_at", "updated_at", "category_detail", "vendor_detail",
            "active_assignments",  # Only active assignments
        ]
