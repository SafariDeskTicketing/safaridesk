from django.contrib import admin

from tenant.models import Asset
from tenant.models.SlaModel import SLAPolicy
from tenant.models.SlaXModel import SLA, SLATarget, SLAReminder, SLAEscalations, SLAEscalationNotificationLog, SLAConfiguration
# Register your models here.
admin.site.register(Asset)
@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at', 'updated_at')
    search_fields = ('name', 'description')


@admin.register(SLA)
class SLAAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'auto_apply', 'created_at', 'updated_at')
    search_fields = ('name', 'description')


@admin.register(SLATarget)
class SLATargetAdmin(admin.ModelAdmin):
    list_display = ('sla', 'priority', 'escalation_enabled', 'reminder_enabled')
    list_filter = ('priority', 'operational_hours', 'escalation_enabled', 'reminder_enabled')


@admin.register(SLAReminder)
class SLAReminderAdmin(admin.ModelAdmin):
    list_display = ('sla_target', 'reminder_type', 'time_before', 'time_unit', 'is_active')
    filter_horizontal = ('notify_groups', 'notify_agents')


@admin.register(SLAEscalations)
class SLAEscalationsAdmin(admin.ModelAdmin):
    list_display = ('sla_target', 'escalation_type', 'level', 'is_active')
    list_filter = ('escalation_type', 'level', 'is_active')
    filter_horizontal = ('escalate_to_groups', 'escalate_to_agents')


@admin.register(SLAEscalationNotificationLog)
class SLAEscalationNotificationLogAdmin(admin.ModelAdmin):
    list_display = ('sla_target', 'violation_type', 'email_sent', 'breach_time')
    list_filter = ('violation_type', 'email_sent')


@admin.register(SLAConfiguration)
class SLAConfigurationAdmin(admin.ModelAdmin):
    list_display = ('business', 'sla_enabled')