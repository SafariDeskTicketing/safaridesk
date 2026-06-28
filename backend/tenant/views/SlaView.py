from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
from django.core.paginator import Paginator
from django.db import transaction, models
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.generics import (
    ListCreateAPIView, RetrieveUpdateDestroyAPIView,
    ListAPIView, CreateAPIView, UpdateAPIView
)
import json
import uuid
from datetime import datetime, timedelta
from tenant.services.audit import actor_name, log_audit_event

from tenant.models.SlaModel import *
from tenant.serializers.SlaSerializers import *
from rest_framework.pagination import PageNumberPagination


def json_response(data, status_code=200):
    """Helper function to return JSON responses"""
    return JsonResponse(data, status=status_code, safe=False)


# SLA Policy Views using Serializers
class SLAPolicyListCreateView(ListCreateAPIView):
    queryset = SLAPolicy.objects.all().order_by('-created_at')
    pagination_class = PageNumberPagination
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SLAPolicyCreateSerializer
        return SLAPolicySerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()

        # Optional filters
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        customer_tier = self.request.query_params.get('customer_tier')
        if customer_tier:
            queryset = queryset.filter(customer_tier=customer_tier)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset
    

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.context['request'] = request  # Ensure request is in context

        if serializer.is_valid():
            policy = serializer.save(
                created_by=request.user,
                business=request.user.business
            )
            return Response({
                'message': 'SLA Policy created successfully',
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'message': "Error creating SLA Policy",
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class SLAPolicyDetailView(RetrieveUpdateDestroyAPIView):
    queryset = SLAPolicy.objects.all()
    serializer_class = SLAPolicySerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'policy_id'
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'SLA Policy updated successfully',
                'data': serializer.data
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': 'SLA Policy deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)


# Business Hours Views using Serializers
class BusinessHoursListCreateView(ListCreateAPIView):
    queryset = BusinessHours.objects.all().order_by('weekday', 'start_time')
    serializer_class = BusinessHoursSerializer
    
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by name if provided
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(name__icontains=name)
        
        # Filter by weekday
        weekday = self.request.query_params.get('weekday')
        if weekday is not None:
            queryset = queryset.filter(weekday=int(weekday))
        
        return queryset.filter(business=self.request.user.business)
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        print(request.user.business)
        data = request.data.get("data", [])
        if not isinstance(data, list) or not data:
            return Response({'message': 'Data must be a non-empty list of business hours'}, status=status.HTTP_400_BAD_REQUEST)

        # Extract weekdays and names in the incoming payload
        incoming_weekdays = set()
        incoming_names = set()
        valid_items = []
        skipped_items = []

        existing_weekdays = set(
            BusinessHours.objects.values_list('weekday', flat=True)
        )
        existing_names = set(
            BusinessHours.objects.values_list('name', flat=True)
        )

        for item in data:
            weekday = item.get('weekday')
            name = item.get('name')

            if name in existing_names or name in incoming_names:
                item['skip_reason'] = 'Duplicate name'
                skipped_items.append(item)
                continue

            if weekday in existing_weekdays or weekday in incoming_weekdays:
                item['skip_reason'] = 'Business hour for this weekday already exists'
                skipped_items.append(item)
                continue

            incoming_weekdays.add(weekday)
            incoming_names.add(name)
            valid_items.append(item)

        if not valid_items:
            return Response({
                'success': False,
                'message': 'No valid business hours to create',
                'skipped': skipped_items
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=valid_items, many=True)
        if serializer.is_valid():
            serializer.save(
                created_by=request.user,
                business=request.user.business
            )
            return Response({ 'message': 'Business hours created successfully'}, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': "An error occurred while creating business hours",
            'skipped': skipped_items
        }, status=status.HTTP_400_BAD_REQUEST)



class BusinessHoursDetailView(RetrieveUpdateDestroyAPIView):
    queryset = BusinessHours.objects.all()
    serializer_class = BusinessHoursSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'hours_id'
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Business Hours updated successfully',
                'data': serializer.data
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': 'Business Hours deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)


# Holiday Views using Serializers
class HolidayListCreateView(ListCreateAPIView):
    queryset = Holiday.objects.all().order_by('-created_at')
    serializer_class = HolidaySerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Optional filter by year
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(date__year=int(year)).filter(business=self.request.user.business)
        
        # Optional filter by recurring
        is_recurring = self.request.query_params.get('is_recurring')
        if is_recurring is not None:
            queryset = queryset.filter(is_recurring=is_recurring.lower() == 'true')
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                created_by=request.user,
                business=request.user.business
            )
            return Response({
                'message': 'Holiday created successfully',
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class HolidayDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'holiday_id'
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Holiday updated successfully',
                'data': serializer.data
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': 'Holiday deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)


# SLA Tracker Views using Serializers
class SLATrackerListCreateView(ListCreateAPIView):
    queryset = SLATracker.objects.select_related('ticket', 'sla_policy').all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SLATrackerCreateSerializer
        return SLATrackerSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        first_response_status = self.request.query_params.get('first_response_status')
        if first_response_status:
            queryset = queryset.filter(first_response_status=first_response_status)
        
        resolution_status = self.request.query_params.get('resolution_status')
        if resolution_status:
            queryset = queryset.filter(resolution_status=resolution_status)
        
        # Filter by ticket ID
        ticket_id = self.request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(ticket_id=ticket_id)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Pagination
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 10))
        paginator = Paginator(queryset, per_page)
        trackers_page = paginator.get_page(page)
        
        serializer = self.get_serializer(trackers_page, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data,
            'pagination': {
                'current_page': page,
                'total_pages': paginator.num_pages,
                'total_items': paginator.count,
                'per_page': per_page,
                'has_next': trackers_page.has_next(),
                'has_previous': trackers_page.has_previous(),
            }
        })
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            tracker = serializer.save()
            response_serializer = SLATrackerSerializer(tracker)
            return Response({
                'success': True,
                'message': 'SLA Tracker created successfully',
                'data': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class SLATrackerDetailView(RetrieveUpdateDestroyAPIView):
    queryset = SLATracker.objects.select_related('ticket', 'sla_policy').all()
    lookup_field = 'id'
    lookup_url_kwarg = 'tracker_id'
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SLATrackerUpdateSerializer
        return SLATrackerSerializer
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SLATrackerSerializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            response_serializer = SLATrackerSerializer(instance)
            return Response({
                'success': True,
                'message': 'SLA Tracker updated successfully',
                'data': response_serializer.data
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# SLA Tracker Action Views using Serializers
@api_view(['POST'])
def pause_sla_tracker(request, tracker_id):
    try:
        tracker = get_object_or_404(SLATracker, id=tracker_id)
        serializer = SLATrackerPauseSerializer(data=request.data)
        
        if serializer.is_valid():
            reason = serializer.validated_data['reason']
            tracker.pause_sla(reason)
            
            response_serializer = SLATrackerSerializer(tracker)
            return Response({
                'success': True,
                'message': 'SLA Tracker paused successfully',
                'data': response_serializer.data
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def resume_sla_tracker(request, tracker_id):
    try:
        tracker = get_object_or_404(SLATracker, id=tracker_id)
        tracker.resume_sla()
        
        serializer = SLATrackerSerializer(tracker)
        return Response({
            'success': True,
            'message': 'SLA Tracker resumed successfully',
            'data': serializer.data
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


# SLA Escalation Views using Serializers
class SLAEscalationListCreateView(ListCreateAPIView):
    queryset = SLAEscalation.objects.select_related('sla_policy').all().order_by('trigger_percentage')
    serializer_class = SLAEscalationSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by SLA policy
        sla_policy_id = self.request.query_params.get('sla_policy_id')
        if sla_policy_id:
            queryset = queryset.filter(sla_policy_id=sla_policy_id)
        
        # Filter by escalation type
        escalation_type = self.request.query_params.get('escalation_type')
        if escalation_type:
            queryset = queryset.filter(escalation_type=escalation_type)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            escalation = serializer.save()
            return Response({
                'success': True,
                'message': 'SLA Escalation created successfully',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class SLAEscalationDetailView(RetrieveUpdateDestroyAPIView):
    queryset = SLAEscalation.objects.select_related('sla_policy').all()
    serializer_class = SLAEscalationSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'escalation_id'
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'SLA Escalation updated successfully',
                'data': serializer.data
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': 'SLA Escalation deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)


# SLA Configuration Views
class SLAConfigurationView(APIView):
    """
    Get or update SLA configuration for the logged-in user's business
    """
    
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
