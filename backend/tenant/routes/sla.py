from django.urls import path

from tenant.views.SlaView import (
    SLAPolicyListCreateView, SLAPolicyDetailView,
    BusinessHoursListCreateView, BusinessHoursDetailView,
    HolidayListCreateView, HolidayDetailView,
    SLATrackerListCreateView, SLATrackerDetailView,
    SLAEscalationListCreateView, SLAEscalationDetailView,
    pause_sla_tracker, resume_sla_tracker,
    SLAConfigurationView
)

urlpatterns = [
    # SLA Configuration URL
    path('config/', SLAConfigurationView.as_view(), name='sla_config'),
    
    # SLA Policy URLs
    path('policies/', SLAPolicyListCreateView.as_view(), name='sla_policies_list_create'),
    path('policies/<uuid:policy_id>/', SLAPolicyDetailView.as_view(), name='sla_policies_detail'),
    
    # Business Hours URLs
    path('business-hours/', BusinessHoursListCreateView.as_view(), name='business_hours_list_create'),
    path('business-hours/<uuid:hours_id>/', BusinessHoursDetailView.as_view(), name='business_hours_detail'),
    
    # Holiday URLs
    path('holidays/', HolidayListCreateView.as_view(), name='holidays_list_create'),
    path('holidays/<uuid:holiday_id>/', HolidayDetailView.as_view(), name='holidays_detail'),
    
    # SLA Tracker URLs
    path('trackers/', SLATrackerListCreateView.as_view(), name='sla_trackers_list_create'),
    path('trackers/<uuid:tracker_id>/', SLATrackerDetailView.as_view(), name='sla_trackers_detail'),
    path('trackers/<uuid:tracker_id>/pause/', pause_sla_tracker, name='sla_trackers_pause'),
    path('trackers/<uuid:tracker_id>/resume/', resume_sla_tracker, name='sla_trackers_resume'),
    
    # SLA Escalation URLs
    path('escalations/', SLAEscalationListCreateView.as_view(), name='sla_escalations_list_create'),
    path('escalations/<uuid:escalation_id>/', SLAEscalationDetailView.as_view(), name='sla_escalations_detail'),
]