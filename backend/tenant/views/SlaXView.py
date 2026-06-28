from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import viewsets, status # Import status

from tenant.models import SLA, SLATarget, SLACondition, SLAReminder, SLAEscalations, Department, BusinessHoursx, \
    Holidays, SLAEscalation, SLAConfiguration
from tenant.serializers.SlaXSerializer import SLASerializer, BusinessHoursSerializer, HolidaySerializer, SLAConfigurationSerializer
from tenant.services.audit import actor_name, log_audit_event
from users.models import Users


class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holidays.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Holidays.objects.filter(business=self.request.user.business)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset

class SLAViewSet(viewsets.ModelViewSet):
    queryset = SLA.objects.all()
    serializer_class = SLASerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        queryset = SLA.objects.prefetch_related(
            'conditions',
            'targets__reminders__notify_groups',
            'targets__reminders__notify_agents',
            'targets__escalations__escalate_to_groups',
            'targets__escalations__escalate_to_agents'
        )

        # Filter by active status if requested
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.filter(business=self.request.user.business)

    @action(detail=False, methods=['get'])
    def choices(self, request):
        """Get all choice options for dropdowns"""
        return Response({
            'operational_hours': SLA.OPERATIONAL_HOURS_CHOICES,
            'evaluation_methods': SLA.EVALUATION_CHOICES,
            'priorities': SLATarget.PRIORITY_CHOICES,
            'time_units': SLATarget.TIME_UNITS,
            'condition_types': SLACondition.CONDITION_TYPES,
            'operators': SLACondition.OPERATORS,
            'reminder_types': SLAReminder.REMINDER_TYPES,
            'escalation_types': SLAEscalation.ESCALATION_TYPES,
        })
    @action(detail=False, methods=['get'])
    def users_and_groups(self, request):
        """Get available users and groups for assignment"""
        # Include admins in available recipients so admins can be selected for escalations
        staff_users = Users.objects.filter(
            is_active=True,
            status='A',
            business=request.user.business,
            role__name__in=['agent', 'manager', 'admin']
        )

        agents = staff_users.filter(role__name='agent').values('id', 'username', 'first_name', 'last_name', 'email', 'role__name')
        managers = staff_users.filter(role__name='manager').values('id', 'username', 'first_name', 'last_name', 'email', 'role__name')
        admins = staff_users.filter(role__name='admin').values('id', 'username', 'first_name', 'last_name', 'email', 'role__name')
        departments = Department.objects.filter(business=request.user.business).values('id', 'name')

        return Response({
            'agents': list(agents),
            'managers': list(managers),
            'admins': list(admins),
            'groups': list(departments)
        })

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate an SLA"""
        sla = self.get_object()
        sla.is_active = True
        sla.save()
        return Response({'status': 'SLA activated'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate an SLA"""
        sla = self.get_object()
        sla.is_active = False
        sla.save()
        return Response({'status': 'SLA deactivated'})

    @action(detail=False, methods=['get'])
    def business_hours(self, request):
        """
        Get all business hours configurations for the authenticated user's business.
        """
        try:
            business_hours_queryset = BusinessHoursx.objects.filter(business=request.user.business)
            serializer = BusinessHoursSerializer(business_hours_queryset, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "message": "Error retrieving business hours",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# SLA Configuration View
class SLAConfigurationView(APIView):
    """
    Get or update SLA configuration for the logged-in user's business
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get SLA configuration for the current business"""
        try:
            # Get or create SLA configuration for the current business
            config, created = SLAConfiguration.objects.get_or_create(
                business=request.user.business,
                defaults={'sla_enabled': False}
            )
            
            serializer = SLAConfigurationSerializer(config)
            return Response({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request):
        """Update SLA configuration for the current business"""
        try:
            # Get or create SLA configuration for the current business
            config, created = SLAConfiguration.objects.get_or_create(
                business=request.user.business,
                defaults={'sla_enabled': False}
            )
            
            serializer = SLAConfigurationSerializer(config, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save(updated_by=request.user)
                log_audit_event(
                    request,
                    event_type="SETTINGS_UPDATED",
                    entity_type="settings",
                    entity=config,
                    activity=f"{actor_name(request.user)} updated SLA settings",
                    metadata={"area": "SLA"},
                )
                return Response({
                    'success': True,
                    'message': 'SLA configuration updated successfully',
                    'data': serializer.data
                })
            
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
