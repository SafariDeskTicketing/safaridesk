
from django.utils import timezone
from datetime import datetime, timedelta, time
import pytz
from tenant.models.SlaModel import BusinessHours, Holiday
import logging

logger = logging.getLogger(__name__)
# The calc
class SLACalculator:
    """
    Utility class for SLA calculations
    """
    
    def __init__(self, timezone_name='UTC'):
        self.timezone = pytz.timezone(timezone_name)
    
    def calculate_due_date(self, start_time, duration_minutes, business_hours_only=True):
        """
        Calculate due date considering business hours and holidays
        
        Args:
            start_time: DateTime when SLA starts
            duration_minutes: SLA duration in minutes
            business_hours_only: Whether to consider only business hours
        
        Returns:
            DateTime when SLA is due
        """
        logger.info(f"Calculating due date: start_time={start_time}, duration={duration_minutes}, business_hours_only={business_hours_only}")
        
        if not business_hours_only:
            # Simple calculation - just add minutes
            result = start_time + timedelta(minutes=duration_minutes)
            logger.info(f"Non-business hours calculation result: {result}")
            return result
        
        # Check if we have any business hours configured
        if not self.has_business_hours():
            logger.warning("No business hours configured, falling back to simple calculation")
            return start_time + timedelta(minutes=duration_minutes)
        
        current_time = start_time
        remaining_minutes = duration_minutes
        max_iterations = 100  # Prevent infinite loops
        iteration_count = 0
        
        logger.info(f"Starting business hours calculation with {remaining_minutes} minutes remaining")
        
        while remaining_minutes > 0 and iteration_count < max_iterations:
            iteration_count += 1
            logger.debug(f"Iteration {iteration_count}: remaining_minutes={remaining_minutes}, current_time={current_time}")
            
            # Check if current day is a holiday
            if self.is_holiday(current_time.date()):
                logger.debug(f"Day {current_time.date()} is a holiday, moving to next business day")
                current_time = self.get_next_business_day(current_time)
                continue
            
            # Get business hours for current day
            business_hours = self.get_business_hours(current_time.weekday())
            
            if not business_hours or not business_hours.is_working_day:
                logger.debug(f"No business hours for weekday {current_time.weekday()}, moving to next day")
                current_time = self.get_next_business_day(current_time)
                continue
            
            # Work with the current timezone instead of converting
            current_local = current_time
            
            # If before business hours, move to start of business hours
            if current_local.time() < business_hours.start_time:
                logger.debug(f"Before business hours, moving to start time {business_hours.start_time}")
                current_local = current_local.replace(
                    hour=business_hours.start_time.hour,
                    minute=business_hours.start_time.minute,
                    second=0,
                    microsecond=0
                )
                current_time = current_local
            
            # If after business hours, move to next business day
            if current_local.time() >= business_hours.end_time:
                logger.debug(f"After business hours, moving to next business day")
                current_time = self.get_next_business_day(current_time)
                continue
            
            # Calculate available minutes in current business day
            end_of_business = current_local.replace(
                hour=business_hours.end_time.hour,
                minute=business_hours.end_time.minute,
                second=0,
                microsecond=0
            )
            
            available_minutes = int((end_of_business - current_local).total_seconds() / 60)
            logger.debug(f"Available minutes in current business day: {available_minutes}")
            
            if available_minutes <= 0:
                logger.debug("No available minutes, moving to next business day")
                current_time = self.get_next_business_day(current_time)
                continue
            
            if remaining_minutes <= available_minutes:
                # Can complete within current business day
                result = current_time + timedelta(minutes=remaining_minutes)
                logger.info(f"Calculation completed: {result}")
                return result
            else:
                # Use all available time today and continue tomorrow
                remaining_minutes -= available_minutes
                logger.debug(f"Used {available_minutes} minutes, {remaining_minutes} remaining")
                current_time = self.get_next_business_day(current_time)
        
        # If we hit max iterations, log warning and return fallback
        if iteration_count >= max_iterations:
            logger.error(f"Hit max iterations ({max_iterations}) in SLA calculation, using fallback")
            return start_time + timedelta(minutes=duration_minutes)
        
        logger.info(f"Final calculation result: {current_time}")
        return current_time
    
    def has_business_hours(self):
        """Check if any business hours are configured"""
        try:
            return BusinessHours.objects.exists()
        except Exception as e:
            logger.error(f"Error checking business hours: {e}")
            return False
    
    def get_business_hours(self, weekday):
        """Get business hours for a specific weekday"""
        try:
            business_hours = BusinessHours.objects.filter(
                weekday=weekday,
                is_working_day=True
            ).first()
            logger.debug(f"Business hours for weekday {weekday}: {business_hours}")
            return business_hours
        except Exception as e:
            logger.error(f"Error getting business hours for weekday {weekday}: {e}")
            return None
    
    def is_holiday(self, date):
        """Check if a date is a holiday"""
        try:
            # Check for exact date match
            if Holiday.objects.filter(date=date).exists():
                return True
            
            # Check for recurring holidays (same month/day)
            recurring_holidays = Holiday.objects.filter(
                is_recurring=True,
                date__month=date.month,
                date__day=date.day
            )
            
            return recurring_holidays.exists()
        except Exception as e:
            logger.error(f"Error checking holiday status for {date}: {e}")
            return False
    
    def get_next_business_day(self, current_time):
        """Get the start of the next business day"""
        try:
            next_day = current_time.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            
            # Find next working day (limit to 14 days to prevent infinite loops)
            for i in range(14):
                check_date = next_day + timedelta(days=i)
                business_hours = self.get_business_hours(check_date.weekday())
                
                if (business_hours and 
                    business_hours.is_working_day and 
                    not self.is_holiday(check_date.date())):
                    
                    result = check_date.replace(
                        hour=business_hours.start_time.hour,
                        minute=business_hours.start_time.minute,
                        second=0,
                        microsecond=0
                    )
                    logger.debug(f"Next business day: {result}")
                    return result
            
            # Fallback - return original next day if no business hours found
            logger.warning("No business days found in next 14 days, using fallback")
            return next_day
        except Exception as e:
            logger.error(f"Error getting next business day: {e}")
            return current_time + timedelta(days=1)
    
    def get_elapsed_business_time(self, start_time, end_time, business_hours_only=True):
        """
        Calculate elapsed business time between two datetime objects
        """
        if not business_hours_only:
            return (end_time - start_time).total_seconds() / 60  # Return minutes
        
        total_minutes = 0
        current_time = start_time
        max_iterations = 100
        iteration_count = 0
        
        while current_time.date() <= end_time.date() and iteration_count < max_iterations:
            iteration_count += 1
            
            if self.is_holiday(current_time.date()):
                current_time = self.get_next_business_day(current_time)
                continue
            
            business_hours = self.get_business_hours(current_time.weekday())
            
            if not business_hours or not business_hours.is_working_day:
                current_time = self.get_next_business_day(current_time)
                continue
            
            # Calculate business time for current day
            day_start = max(
                current_time,
                current_time.replace(
                    hour=business_hours.start_time.hour,
                    minute=business_hours.start_time.minute,
                    second=0,
                    microsecond=0
                )
            )
            
            day_end = min(
                end_time,
                current_time.replace(
                    hour=business_hours.end_time.hour,
                    minute=business_hours.end_time.minute,
                    second=0,
                    microsecond=0
                )
            )
            
            if day_start < day_end:
                total_minutes += (day_end - day_start).total_seconds() / 60
            
            # Move to next day
            current_time = current_time.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        if iteration_count >= max_iterations:
            logger.error("Hit max iterations in elapsed business time calculation")
            
        return total_minutes



class SLAMonitor:
    """
    Monitor SLA compliance and trigger escalations
    """
    
    def __init__(self):
        self.calculator = SLACalculator()
    
    def check_sla_status(self, sla_tracker):
        """
        Check and update SLA status for a tracker
        """
        from tenant.models.SlaModel import SLATracker
        
        current_time = timezone.now()
        
        # Check first response SLA
        if not sla_tracker.first_response_completed:
            if current_time > sla_tracker.effective_first_response_due:
                sla_tracker.first_response_status = 'breached'
                sla_tracker.first_response_breach_time = current_time
            elif self.is_approaching_breach(current_time, sla_tracker.effective_first_response_due):
                sla_tracker.first_response_status = 'approaching_breach'
        
        # Check resolution SLA
        if not sla_tracker.resolution_completed:
            if current_time > sla_tracker.effective_resolution_due:
                sla_tracker.resolution_status = 'breached'
                sla_tracker.resolution_breach_time = current_time
            elif self.is_approaching_breach(current_time, sla_tracker.effective_resolution_due):
                sla_tracker.resolution_status = 'approaching_breach'
        
        sla_tracker.save()
        return sla_tracker
    
    def is_approaching_breach(self, current_time, due_time, threshold_percentage=80):
        """
        Check if SLA is approaching breach (default: 80% of time elapsed)
        """
        if current_time >= due_time:
            return False
        
        # This is a simplified approach - you might want to make this more sophisticated
        time_remaining = (due_time - current_time).total_seconds()
        total_time = (due_time - timezone.now()).total_seconds()  # Simplified
        
        if total_time <= 0:
            return True
        
        elapsed_percentage = ((total_time - time_remaining) / total_time) * 100
        return elapsed_percentage >= threshold_percentage
    
    def check_all_sla_trackers(self):
        """
        Check all active SLA trackers and update their status
        """
        from tenant.models.SlaModel import SLATracker
        
        active_trackers = SLATracker.objects.filter(
            resolution_status__in=['within_sla', 'approaching_breach'],
            ticket__status__in=['unassigned', 'assigned', 'in_progress']
        )
        
        updated_trackers = []
        for tracker in active_trackers:
            updated_tracker = self.check_sla_status(tracker)
            updated_trackers.append(updated_tracker)
        
        return updated_trackers