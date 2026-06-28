from django.db import models
from django.urls import reverse
from django.utils import timezone
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid

from shared.models.BaseModel import BaseEntity
from tenant.models.TicketModel import Ticket

# from users.models import BaseUser # REMOVE THIS IMPORT if BaseUser is only for assigned_to

class AssetCategory(BaseEntity):
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name = "Asset Category"
        verbose_name_plural = "Asset Categories"
        ordering = ["name"]
        db_table = "asset_categories"

    def __str__(self):
        return self.name


class Vendor(BaseEntity):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name = "Asset Vendor"
        verbose_name_plural = "Asset Vendors"
        ordering = ["name"]
        db_table = "asset_vendors"

    def __str__(self):
        return self.name


class Asset(BaseEntity):
    STATUS_CHOICES = [
        ("available", "Available"),
        # ('assigned', 'Assigned'), # REMOVE if assigned_to is removed
        ("in_use", "In Use"),
        ("maintenance", "Under Maintenance"),
        ("repair", "Under Repair"),
        ("retired", "Retired"),
        ("lost", "Lost"),
        ("stolen", "Stolen"),
    ]

    CONDITION_CHOICES = [
        ("excellent", "Excellent"),
        ("good", "Good"),
        ("fair", "Fair"),
        ("poor", "Poor"),
        ("damaged", "Damaged"),
    ]

    asset_tag = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique asset identifier",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(AssetCategory, on_delete=models.CASCADE)
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True)

    brand = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="available"
    )
    condition = models.CharField(
        max_length=20, choices=CONDITION_CHOICES, default="good"
    )

    assigned_to = models.ForeignKey( # REMOVED
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_assets'
    )
    assigned_date = models.DateTimeField(null=True, blank=True) # REMOVED

    location = models.CharField(max_length=255, blank=True)

    purchase_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    purchase_date = models.DateField(null=True, blank=True)
    supplier = models.CharField(max_length=200, blank=True)
    invoice_number = models.CharField(max_length=100, blank=True)

    warranty_start_date = models.DateField(null=True, blank=True)
    warranty_end_date = models.DateField(null=True, blank=True)
    last_maintenance = models.DateField(null=True, blank=True)
    next_maintenance = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    is_critical = models.BooleanField(
        default=False, help_text="Mark as business critical asset"
    )

    class Meta:
        ordering = ["name"]  # Changed from 'asset_tag' to 'name'
        verbose_name = "Asset"
        db_table = "assets"
        verbose_name_plural = "Assets"
        indexes = [
            # models.Index(fields=['asset_tag']), # REMOVED
            models.Index(fields=["status"]),
            # models.Index(fields=['assigned_to']), # REMOVED
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return f"{self.name}"  # Removed asset_tag from string representation

    def get_absolute_url(self):
        return reverse("asset_detail", kwargs={"pk": self.pk})

    def save(self, *args, **kwargs):
        # REMOVED assigned_to related logic
        # if self.assigned_to and not self.assigned_date:
        #     self.assigned_date = timezone.now()
        # elif not self.assigned_to:
        #     self.assigned_date = None

        # if self.assigned_to and self.status == 'available':
        #     self.status = 'assigned'
        # elif not self.assigned_to and self.status == 'assigned':
        #     self.status = 'available'

        super().save(*args, **kwargs)

    # REMOVED assigned_to related properties
    # @property
    # def is_assigned(self):
    #     return self.assigned_to is not None

    @property
    def is_warranty_expired(self):
        if self.warranty_end_date:
            return timezone.now().date() > self.warranty_end_date
        return None

    @property
    def warranty_status(self):
        if not self.warranty_end_date:
            return "No warranty info"

        days_remaining = (self.warranty_end_date - timezone.now().date()).days
        if days_remaining < 0:
            return "Expired"
        elif days_remaining <= 30:
            return "Expiring soon"
        else:
            return "Active"

    @property
    def needs_maintenance(self):
        if self.next_maintenance:
            return timezone.now().date() >= self.next_maintenance
        return False

    @property
    def age_in_days(self):
        if self.purchase_date:
            return (timezone.now().date() - self.purchase_date).days
        return None

    @property
    def get_current_value(self, depreciation_rate=0.2):
        if not self.purchase_price or not self.purchase_date:
            return None

        years_old = self.age_in_days / 365.25 if self.age_in_days else 0
        depreciated_value = float(self.purchase_price) * (
            (1 - depreciation_rate) ** years_old
        )
        return round(Decimal(str(depreciated_value)), 2)


class AssetHistory(BaseEntity):
    ACTION_CHOICES = [
        ("created", "Created"),
        # ('assigned', 'Assigned'), # REMOVED
        # ('unassigned', 'Unassigned'), # REMOVED
        ("transferred", "Transferred"),
        ("maintenance", "Maintenance"),
        ("repair", "Repair"),
        ("retired", "Retired"),
        ("status_change", "Status Changed"),
        ("location_change", "Location Changed"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    description = models.TextField()
    # performed_by = models.ForeignKey( # REMOVED
    #     "users.Users",
    #     on_delete=models.CASCADE,
    #     related_name='asset_actions'
    # )
    old_value = models.CharField(max_length=200, blank=True)
    new_value = models.CharField(max_length=200, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        db_table = "asset_history"
        verbose_name = "Asset History"
        verbose_name_plural = "Asset Histories"
        indexes = [
            models.Index(fields=["asset", "timestamp"]),
            # models.Index(fields=['performed_by']), # REMOVED
        ]

    def __str__(self):
        return f"{self.asset.name} - {self.action} on {self.timestamp.strftime('%Y-%m-%d')}"  # Removed asset_tag and fixed date


class AssetMaintenance(BaseEntity):
    MAINTENANCE_TYPE_CHOICES = [
        ("preventive", "Preventive"),
        ("corrective", "Corrective"),
        ("emergency", "Emergency"),
        ("upgrade", "Upgrade"),
    ]

    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name="maintenance_records"
    )
    maintenance_type = models.CharField(max_length=20, choices=MAINTENANCE_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="scheduled"
    )

    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)

    # performed_by = models.ForeignKey( # REMOVED
    #     "users.Users",
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='performed_maintenance'
    # )

    assigned_to = models.CharField(max_length=200, blank=True, help_text="Technician assigned to this maintenance")
    priority = models.CharField(max_length=10, default="medium", choices=[
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent")
    ])
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Estimated cost of maintenance")
    actual_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Actual cost incurred")

    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    supplier = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-scheduled_date"]
        db_table = "asset_maintenance"
        verbose_name = "Asset Maintenance"
        verbose_name_plural = "Asset Maintenance Records"
        indexes = [
            models.Index(fields=["asset", "scheduled_date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.asset.name} - {self.title}"  # Removed asset_tag

    def save(self, *args, **kwargs):
        if self.status == "completed" and not self.completed_date:
            self.completed_date = timezone.now().date()
        elif self.status != "completed":
            self.completed_date = None
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        if self.status not in ["completed", "cancelled"]:
            return timezone.now().date() > self.scheduled_date
        return False


# =========================== NEW ASSET MANAGEMENT MODELS =============================

class AssetType(BaseEntity):
    """Asset type classification (Hardware, Software, Digital, Consumables)"""
    TYPE_CHOICES = [
        ("hardware", "Hardware"),
        ("software", "Software"),
        ("digital", "Digital Asset"),
        ("consumable", "Consumable"),
    ]

    name = models.CharField(max_length=100, unique=True)
    type_category = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default="hardware"
    )
    description = models.TextField(blank=True)
    requires_assignment = models.BooleanField(default=True)
    requires_license = models.BooleanField(default=False)
    has_physical_presence = models.BooleanField(default=True)
    depreciation_applicable = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Asset Type"
        verbose_name_plural = "Asset Types"
        ordering = ["type_category", "name"]
        db_table = "assets_assettype"

    def __str__(self):
        return f"{self.name} ({self.get_type_category_display()})"


class Supplier(BaseEntity):
    """Supplier management for procurement"""
    name = models.CharField(max_length=255, unique=True)
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    supplier_category = models.CharField(
        max_length=50, blank=True,
        help_text="Hardware, Software, Services, etc."
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Supplier"
        verbose_name_plural = "Suppliers"
        ordering = ["name"]
        db_table = "assets_supplier"

    def __str__(self):
        return self.name


class AssetLocation(BaseEntity):
    """Structured location management"""
    LOCATION_TYPE_CHOICES = [
        ("office", "Office"),
        ("datacenter", "Data Center"),
        ("warehouse", "Warehouse"),
        ("remote", "Remote User"),
        ("cloud", "Cloud"),
        ("contractor", "Contractor"),
    ]

    name = models.CharField(max_length=100)
    location_type = models.CharField(
        max_length=20, choices=LOCATION_TYPE_CHOICES, default="office"
    )
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    manager = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='managed_locations'
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Asset Location"
        verbose_name_plural = "Asset Locations"
        ordering = ["location_type", "name"]
        db_table = "assets_assetlocation"

    def __str__(self):
        return f"{self.name} ({self.get_location_type_display()})"


class SoftwareLicense(BaseEntity):
    """Software license management"""
    LICENSE_TYPE_CHOICES = [
        ("perpetual", "Perpetual"),
        ("subscription", "Subscription"),
        ("open_source", "Open Source"),
        ("trial", "Trial/Evaluation"),
        ("academic", "Academic"),
    ]

    name = models.CharField(max_length=200)
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE)
    license_key = models.CharField(max_length=500, blank=True)
    license_type = models.CharField(
        max_length=20, choices=LICENSE_TYPE_CHOICES, default="subscription"
    )
    version = models.CharField(max_length=50, blank=True)
    max_users = models.PositiveIntegerField(null=True, blank=True)
    current_users = models.PositiveIntegerField(default=0)
    purchase_date = models.DateField()
    expiration_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    auto_renewal = models.BooleanField(default=False)
    compliance_status = models.CharField(max_length=20, default="compliant",
        choices=[
            ("compliant", "Compliant"),
            ("non_compliant", "Non-Compliant"),
            ("expired", "Expired"),
            ("warning", "Warning"),
        ]
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Software License"
        verbose_name_plural = "Software Licenses"
        ordering = ["-expiration_date"]
        db_table = "assets_softwarelicense"
        indexes = [
            models.Index(fields=["expiration_date"]),
            models.Index(fields=["compliance_status"]),
        ]

    def __str__(self):
        return f"{self.name} v{self.version or 'N/A'}"

    @property
    def is_expired(self):
        if self.expiration_date:
            return timezone.now().date() > self.expiration_date
        return False

    @property
    def days_until_expiry(self):
        if self.expiration_date:
            return (self.expiration_date - timezone.now().date()).days
        return None

    @property
    def license_utilization_percentage(self):
        if self.max_users and self.max_users > 0:
            return min((self.current_users / self.max_users) * 100, 100)
        return 0


class Contract(BaseEntity):
    """Contract and agreement management"""
    CONTRACT_TYPE_CHOICES = [
        ("warranty", "Warranty Agreement"),
        ("support", "Support Contract"),
        ("lease", "Lease Agreement"),
        ("software", "Software License"),
        ("service", "Service Agreement"),
        ("maintenance", "Maintenance Contract"),
    ]

    name = models.CharField(max_length=200)
    contract_number = models.CharField(max_length=100, unique=True)
    contract_type = models.CharField(
        max_length=20, choices=CONTRACT_TYPE_CHOICES, default="support"
    )
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True
    )
    start_date = models.DateField()
    end_date = models.DateField()
    renewal_date = models.DateField(null=True, blank=True)
    auto_renewal = models.BooleanField(default=False)
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    payment_terms = models.CharField(max_length=200, blank=True)
    coverage = models.TextField(help_text="What this contract covers")
    limitations = models.TextField(blank=True)
    contact_person = models.CharField(max_length=100, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    notifications_enabled = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Contract"
        verbose_name_plural = "Contracts"
        ordering = ["-end_date"]
        db_table = "assets_contract"
        indexes = [
            models.Index(fields=["end_date"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["contract_type"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.contract_number})"

    @property
    def is_expired(self):
        return timezone.now().date() > self.end_date

    @property
    def days_until_expiry(self):
        return (self.end_date - timezone.now().date()).days

    @property
    def status(self):
        if self.is_expired:
            return "Expired"
        elif self.days_until_expiry <= 30:
            return "Expiring Soon"
        else:
            return "Active"


class Purchase(BaseEntity):
    """Procurement lifecycle tracking"""
    STATUS_CHOICES = [
        ("requested", "Requested"),
        ("approved", "Approved"),
        ("ordered", "Ordered"),
        ("received", "Received"),
        ("installed", "Installed"),
        ("cancelled", "Cancelled"),
        ("rejected", "Rejected"),
    ]

    asset_name = models.CharField(max_length=200, help_text="Name of asset being purchased")
    description = models.TextField()
    quantity = models.PositiveIntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="requested"
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True)
    requester = models.ForeignKey(
        "users.Users", on_delete=models.SET_NULL, null=True,
        related_name='purchase_requests'
    )
    approver = models.ForeignKey(
        "users.Users", on_delete=models.SET_NULL, null=True,
        related_name='approved_purchases'
    )
    purchase_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    invoice_number = models.CharField(max_length=100, blank=True)
    po_number = models.CharField(max_length=100, blank=True,
        help_text="Purchase Order Number", unique=True)
    budget_code = models.CharField(max_length=50, blank=True)
    priority = models.CharField(max_length=10, default="medium",
        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("urgent", "Urgent")]
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Purchase"
        verbose_name_plural = "Purchases"
        ordering = ["-created_at"]
        db_table = "assets_purchase"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["supplier"]),
            models.Index(fields=["po_number"]),
        ]

    def __str__(self):
        return f"{self.po_number} - {self.asset_name}"

    @property
    def is_overdue(self):
        if self.delivery_date and self.status not in ["received", "cancelled", "rejected"]:
            return timezone.now().date() > self.delivery_date
        return False


class Disposal(BaseEntity):
    """Retirement and disposal process"""
    DISPOSAL_METHOD_CHOICES = [
        ("donation", "Donation"),
        ("recycling", "Recycling"),
        ("destruction", "Destruction"),
        ("sale", "Sale"),
        ("transfer", "Internal Transfer"),
        ("write_off", "Write Off"),
        ("return_to_vendor", "Return to Vendor"),
    ]

    asset = models.OneToOneField(Asset, on_delete=models.CASCADE, related_name="disposal")
    disposal_method = models.CharField(
        max_length=20, choices=DISPOSAL_METHOD_CHOICES
    )
    disposal_date = models.DateField(default=timezone.now)
    reason = models.TextField(help_text="Reason for disposal")
    residual_value = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    disposal_cost = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    recipient = models.CharField(max_length=200, blank=True,
        help_text="Person/organization receiving the asset")
    certificate_number = models.CharField(max_length=100, blank=True)
    environmental_compliance = models.BooleanField(default=True)
    approved_by = models.ForeignKey(
        "users.Users", on_delete=models.SET_NULL, null=True,
        related_name='approved_disposals'
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Asset Disposal"
        verbose_name_plural = "Asset Disposals"
        ordering = ["-disposal_date"]
        db_table = "assets_disposal"

    def __str__(self):
        return f"Disposal: {self.asset.name}"

    @property
    def net_value_change(self):
        """Calculate net value after disposal"""
        residual = self.residual_value or 0
        cost = self.disposal_cost or 0
        return residual - cost


# =========================== USER AND RELATIONSHIP MODELS =============================

class AssetUserMapping(BaseEntity):
    """User assignments with roles - replaces old assigned_to field"""
    ASSIGNMENT_ROLE_CHOICES = [
        ("owner", "Asset Owner"),
        ("user", "Primary User"),
        ("administrator", "Administrator"),
        ("backup", "Backup/Secondary User"),
        ("shared", "Shared Access"),
        ("temporary", "Temporary Access"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="user_mappings")
    user = models.ForeignKey(
        "users.Users", on_delete=models.CASCADE, related_name="asset_assignments"
    )
    role = models.CharField(
        max_length=20, choices=ASSIGNMENT_ROLE_CHOICES, default="user"
    )
    assigned_date = models.DateTimeField(default=timezone.now)
    expected_return_date = models.DateTimeField(null=True, blank=True)
    returned_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Asset Assignment"
        verbose_name_plural = "Asset Assignments"
        ordering = ["-assigned_date"]
        db_table = "assets_assetusermapping"
        unique_together = ["asset", "user", "role"]
        indexes = [
            models.Index(fields=["asset", "user"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["role"]),
        ]

    def __str__(self):
        return f"{self.asset.name} - {self.user.get_full_name() or self.user.email} ({self.get_role_display()})"

    def save(self, *args, **kwargs):
        # Update the related TicketActivity if necessary
        super().save(*args, **kwargs)
        # TODO: Update asset status based on active assignments

    @property
    def is_overdue(self):
        if self.expected_return_date and not self.returned_date and self.is_active:
            return timezone.now() > self.expected_return_date
        return False

    @property
    def assignment_duration_days(self):
        end_date = self.returned_date or timezone.now()
        if self.assigned_date:
            return (end_date - self.assigned_date).days
        return None


class AssetTicket(BaseEntity):
    """Linking assets to tickets (incidents, problems, changes)"""
    RELATIONSHIP_TYPE_CHOICES = [
        ("affected", "Affected Asset"),
        ("resolved_by", "Resolved by Asset"),
        ("related", "Related Asset"),
        ("replaced", "Asset Replacement"),
        ("upgraded", "Asset Upgrade"),
        ("downgraded", "Asset Downgrade"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="ticket_links")
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="asset_links")
    relationship_type = models.CharField(
        max_length=20, choices=RELATIONSHIP_TYPE_CHOICES, default="affected"
    )
    impact_level = models.CharField(max_length=20, default="unknown",
        choices=[
            ("unknown", "Unknown"),
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
            ("critical", "Critical"),
        ]
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Asset-Ticket Relationship"
        verbose_name_plural = "Asset-Ticket Relationships"
        db_table = "assets_assetticket"
        unique_together = ["asset", "ticket"]
        indexes = [
            models.Index(fields=["asset"]),
            models.Index(fields=["ticket"]),
            models.Index(fields=["relationship_type"]),
        ]

    def __str__(self):
        return f"{self.asset.name} - Ticket #{self.ticket.ref_number}"

    def save(self, *args, **kwargs):
        # Update ticket impact based on linked assets
        if self.impact_level != "unknown":
            self.ticket.save(update_fields=['updated_at'])
        super().save(*args, **kwargs)


class AssetDependency(BaseEntity):
    """Configuration relationship mapping (CMDB-lite)"""
    DEPENDENCY_TYPE_CHOICES = [
        ("depends_on", "Depends On"),
        ("required_by", "Required By"),
        ("connects_to", "Connects To"),
        ("contained_in", "Contained In"),
        ("contains", "Contains"),
        ("related_to", "Related To"),
        ("runs_on", "Runs On"),
        ("hosts", "Hosts"),
        ("supports", "Supports"),
        ("managed_by", "Managed By"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="upstream_dependencies")
    dependent_asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="downstream_dependencies")
    dependency_type = models.CharField(
        max_length=20, choices=DEPENDENCY_TYPE_CHOICES, default="depends_on"
    )
    criticality_level = models.CharField(max_length=20, default="medium",
        choices=[
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
            ("critical", "Critical"),
        ]
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Asset Dependency"
        verbose_name_plural = "Asset Dependencies"
        db_table = "assets_assetdependency"
        unique_together = ["asset", "dependent_asset", "dependency_type"]
        indexes = [
            models.Index(fields=["asset"]),
            models.Index(fields=["dependent_asset"]),
            models.Index(fields=["dependency_type"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.dependent_asset.name} {self.get_dependency_type_display().lower()} {self.asset.name}"

    def get_reverse_dependency_type(self):
        """Get the reverse relationship type"""
        reverse_map = {
            "depends_on": "required_by",
            "required_by": "depends_on",
            "connects_to": "connects_to",
            "contained_in": "contains",
            "contains": "contained_in",
            "related_to": "related_to",
            "runs_on": "hosts",
            "hosts": "runs_on",
            "supports": "managed_by",
            "managed_by": "supports",
        }
        return reverse_map.get(self.dependency_type, self.dependency_type)


# =========================== DISCOVERY AND SECURITY MODELS =============================

class DiscoveryAgent(BaseEntity):
    """Network scanning and automatic detection agents"""
    AGENT_TYPE_CHOICES = [
        ("network_scan", "Network Scanner"),
        ("software_inventory", "Software Inventory"),
        ("cloud_discovery", "Cloud Discovery"),
        ("active_directory", "Active Directory"),
        ("manual_entry", "Manual Entry"),
        ("api_integration", "API Integration"),
    ]

    name = models.CharField(max_length=100)
    agent_type = models.CharField(
        max_length=20, choices=AGENT_TYPE_CHOICES, default="network_scan"
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_run = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField(null=True, blank=True)
    scan_interval_hours = models.PositiveIntegerField(default=24)
    ip_range = models.CharField(max_length=200, blank=True,
        help_text="IP ranges to scan (e.g., 192.168.1.0/24)")
    credentials = models.JSONField(null=True, blank=True, help_text="Secure credentials storage")
    configuration = models.JSONField(null=True, blank=True)
    success_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    last_success_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Discovery Agent"
        verbose_name_plural = "Discovery Agents"
        ordering = ["-last_run"]
        db_table = "assets_discoveryagent"

    def __str__(self):
        return f"{self.name} ({self.get_agent_type_display()})"

    @property
    def is_overdue_for_scan(self):
        if self.next_run:
            return timezone.now() > self.next_run
        return True


class DiscoveryResult(BaseEntity):
    """Results from asset discovery processes"""
    agent = models.ForeignKey(DiscoveryAgent, on_delete=models.CASCADE, related_name="results")
    discovered_ip = models.GenericIPAddressField(null=True, blank=True)
    discovered_hostname = models.CharField(max_length=255, blank=True)
    discovered_mac = models.CharField(max_length=17, blank=True,
        help_text="MAC address format: XX:XX:XX:XX:XX:XX")
    discovered_os = models.CharField(max_length=100, blank=True)
    discovered_software = models.JSONField(null=True, blank=True)
    raw_discovery_data = models.JSONField(null=True, blank=True)
    confidence_score = models.DecimalField(max_digits=3, decimal_places=2, default=0.5,
        validators=[MinValueValidator(0), MaxValueValidator(1)])
    matched_asset = models.ForeignKey(Asset, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="discovery_matches")
    disposition = models.CharField(max_length=20, default="pending",
        choices=[
            ("pending", "Pending Review"),
            ("matched", "Matched to Asset"),
            ("new_asset", "New Asset Created"),
            ("ignored", "Ignored"),
            ("false_positive", "False Positive"),
        ]
    )
    review_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Discovery Result"
        verbose_name_plural = "Discovery Results"
        ordering = ["-created_at"]
        db_table = "assets_discoveryresult"
        indexes = [
            models.Index(fields=["agent"]),
            models.Index(fields=["disposition"]),
            models.Index(fields=["confidence_score"]),
        ]

    def __str__(self):
        return f"Discovery: {self.discovered_hostname or self.discovered_ip} ({self.get_disposition_display()})"


class SecurityVulnerability(BaseEntity):
    """Security vulnerability tracking"""
    SEVERITY_CHOICES = [
        ("info", "Informational"),
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="vulnerabilities")
    cve_id = models.CharField(max_length=20, blank=True, help_text="CVE identifier")
    title = models.CharField(max_length=200)
    description = models.TextField()
    severity = models.CharField(
        max_length=20, choices=SEVERITY_CHOICES, default="medium"
    )
    cvss_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)])
    affected_component = models.CharField(max_length=100, blank=True)
    detection_date = models.DateTimeField(default=timezone.now)
    published_date = models.DateField(null=True, blank=True)
    patch_available = models.BooleanField(default=False)
    patch_date = models.DateField(null=True, blank=True)
    remediation_status = models.CharField(max_length=20, default="open",
        choices=[
            ("open", "Open"),
            ("mitigated", "Mitigated"),
            ("patched", "Patched"),
            ("accepted", "Risk Accepted"),
            ("false_positive", "False Positive"),
        ]
    )
    exploitability = models.CharField(max_length=20, default="unknown",
        choices=[
            ("unknown", "Unknown"),
            ("unproven", "Unproven"),
            ("proof_of_concept", "Proof of Concept"),
            ("functional", "Functional Exploit"),
            ("high", "High"),
        ]
    )
    remediation_deadline = models.DateField(null=True, blank=True)
    remediation_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Security Vulnerability"
        verbose_name_plural = "Security Vulnerabilities"
        ordering = ["-severity", "-cvss_score"]
        db_table = "assets_securityvulnerability"
        indexes = [
            models.Index(fields=["asset"]),
            models.Index(fields=["severity"]),
            models.Index(fields=["remediation_status"]),
        ]

    def __str__(self):
        return f"{self.asset.name} - {self.title}"

    @property
    def is_overdue_for_remediation(self):
        if self.remediation_deadline and self.remediation_status == "open":
            return timezone.now().date() > self.remediation_deadline
        return False


class PatchLevel(BaseEntity):
    """Patch management for assets"""
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="patch_levels")
    software_name = models.CharField(max_length=200)
    current_version = models.CharField(max_length=50, blank=True)
    latest_available_version = models.CharField(max_length=50, blank=True)
    patch_status = models.CharField(max_length=20, default="unknown",
        choices=[
            ("unknown", "Unknown"),
            ("current", "Current"),
            ("patch_available", "Patch Available"),
            ("outdated", "Outdated"),
            ("unsupported", "Unsupported"),
            ("end_of_life", "End of Life"),
        ]
    )
    last_check_date = models.DateTimeField(null=True, blank=True)
    last_patch_date = models.DateTimeField(null=True, blank=True)
    patch_source = models.CharField(max_length=100, blank=True,
        help_text="Where patches are sourced from")
    is_critical = models.BooleanField(default=False)
    auto_update_enabled = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Patch Level"
        verbose_name_plural = "Patch Levels"
        db_table = "assets_patchlevel"
        unique_together = ["asset", "software_name"]
        indexes = [
            models.Index(fields=["asset"]),
            models.Index(fields=["patch_status"]),
            models.Index(fields=["is_critical"]),
        ]

    def __str__(self):
        return f"{self.asset.name} - {self.software_name}: {self.current_version or 'Unknown'}"

    @property
    def needs_update(self):
        return self.patch_status in ["patch_available", "outdated", "unsupported"]


# =========================== MANAGEMENT AND COMPLIANCE MODELS =============================

class DepreciationRule(BaseEntity):
    """Depreciation calculation rules for financial management"""
    RULE_TYPE_CHOICES = [
        ("straight_line", "Straight Line Depreciation"),
        ("declining_balance", "Declining Balance"),
        ("units_of_production", "Units of Production"),
        ("custom", "Custom Rate"),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    rule_type = models.CharField(
        max_length=20, choices=RULE_TYPE_CHOICES, default="straight_line"
    )
    depreciation_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=0.2000,
        help_text="Percentage rate (e.g., 0.20 for 20%)"
    )
    useful_life_years = models.PositiveIntegerField(default=5)
    salvage_value_percentage = models.DecimalField(
        max_digits=3, decimal_places=2, default=0.10,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Salvage value as percentage (e.g., 0.10 for 10%)"
    )
    applicable_asset_types = models.ManyToManyField(
        AssetType, blank=True, related_name="depreciation_rules"
    )
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Depreciation Rule"
        verbose_name_plural = "Depreciation Rules"
        ordering = ["name"]
        db_table = "assets_depreciationrule"

    def __str__(self):
        return f"{self.name} ({self.get_rule_type_display()})"

    def calculate_depreciation(self, purchase_price, purchase_date, current_date=None):
        """Calculate current depreciated value"""
        if not purchase_price or not purchase_date:
            return None

        if not current_date:
            current_date = timezone.now().date()

        years_used = (current_date - purchase_date).days / 365.25

        if self.rule_type == "straight_line":
            annual_depreciation = purchase_price * float(self.depreciation_rate)
            return max(0, float(purchase_price) - (annual_depreciation * years_used))

        elif self.rule_type == "declining_balance":
            # Double declining balance (2x straight line rate)
            rate = float(self.depreciation_rate) * 2
            depreciated_value = float(purchase_price)
            for year in range(int(years_used) + 1):
                depreciated_value -= depreciated_value * rate
                if depreciated_value < purchase_price * float(self.salvage_value_percentage):
                    depreciated_value = purchase_price * float(self.salvage_value_percentage)
                    break
            return depreciated_value

        # Default to straight line for other types
        annual_depreciation = purchase_price * float(self.depreciation_rate)
        return max(0, float(purchase_price) - (annual_depreciation * years_used))


class Alert(BaseEntity):
    """Alerts and notifications system"""
    ALERT_TYPE_CHOICES = [
        ("warranty_expiring", "Warranty Expiring"),
        ("contract_expiring", "Contract Expiring"),
        ("license_expiring", "License Expiring"),
        ("maintenance_due", "Maintenance Due"),
        ("asset_retirement", "Asset Retirement"),
        ("security_patch", "Security Patch Available"),
        ("compliance_issue", "Compliance Issue"),
        ("assignment_overdue", "Assignment Overdue"),
        ("custom", "Custom Alert"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    alert_type = models.CharField(
        max_length=20, choices=ALERT_TYPE_CHOICES, default="custom"
    )
    priority = models.CharField(
        max_length=10, choices=PRIORITY_CHOICES, default="medium"
    )
    related_asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, null=True, blank=True,
        related_name="alerts"
    )
    related_contract = models.ForeignKey(
        Contract, on_delete=models.CASCADE, null=True, blank=True,
        related_name="alerts"
    )
    related_license = models.ForeignKey(
        SoftwareLicense, on_delete=models.CASCADE, null=True, blank=True,
        related_name="alerts"
    )
    expected_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    escalation_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        "users.Users", on_delete=models.SET_NULL, null=True, blank=True,
        related_name='acknowledged_alerts'
    )
    acknowledged_date = models.DateTimeField(null=True, blank=True)
    automated_action = models.CharField(max_length=100, blank=True,
        help_text="Automated action to take (optional)")
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=False)
    notification_recipients = models.JSONField(null=True, blank=True,
        help_text="Additional email recipients")
    recurrence_pattern = models.CharField(max_length=50, blank=True,
        help_text="e.g., 'daily', 'weekly', '30_days_before'")
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Alert"
        verbose_name_plural = "Alerts"
        ordering = ["-created_at"]
        db_table = "assets_alert"
        indexes = [
            models.Index(fields=["alert_type"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_priority_display()})"

    @property
    def is_overdue(self):
        if self.due_date:
            return timezone.now().date() > self.due_date
        return False

    @property
    def days_until_due(self):
        if self.due_date:
            return (self.due_date - timezone.now().date()).days
        return None

    def acknowledge(self, user):
        """Mark alert as acknowledged"""
        self.is_acknowledged = True
        self.acknowledged_by = user
        self.acknowledged_date = timezone.now()
        self.save()


class AuditLog(BaseEntity):
    """Comprehensive audit logging for compliance"""
    ACTION_TYPE_CHOICES = [
        ("created", "Created"),
        ("updated", "Updated"),
        ("deleted", "Deleted"),
        ("accessed", "Accessed"),
        ("assigned", "Assigned"),
        ("unassigned", "Unassigned"),
        ("transferred", "Transferred"),
        ("disposed", "Disposed"),
        ("maintenance", "Maintenance"),
        ("security", "Security"),
        ("login", "Login"),
        ("logout", "Logout"),
    ]

    user = models.ForeignKey(
        "users.Users", on_delete=models.SET_NULL, null=True, blank=True,
        related_name='asset_audit_logs'
    )
    action_type = models.CharField(
        max_length=20, choices=ACTION_TYPE_CHOICES, default="accessed"
    )
    model_name = models.CharField(max_length=50)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    object_name = models.CharField(max_length=200, blank=True)
    field_name = models.CharField(max_length=100, blank=True)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    asset = models.ForeignKey(
        Asset, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs"
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    session_id = models.CharField(max_length=100, blank=True)
    api_endpoint = models.CharField(max_length=200, blank=True)
    http_method = models.CharField(max_length=10, blank=True)
    response_status = models.PositiveIntegerField(null=True, blank=True)
    compliance_required = models.BooleanField(default=False)
    risk_level = models.CharField(max_length=10, default="low",
        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("critical", "Critical")]
    )
    notes = models.TextField(blank=True)
    audit_period = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ["-created_at"]
        db_table = "assets_auditlog"
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["action_type"]),
            models.Index(fields=["model_name"]),
            models.Index(fields=["asset"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["compliance_required"]),
        ]

    def __str__(self):
        return f"{self.action_type.title()}: {self.model_name} by {self.user.get_full_name() if self.user else 'System'}"
