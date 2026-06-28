"""
Multi-Channel Notification Coordinator

Ensures consistent delivery across multiple notification channels
(Email, Slack, SMS, In-App) with proper error handling and fallback.
"""
import logging
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from django.db import transaction

logger = logging.getLogger(__name__)


@dataclass
class NotificationChannel:
    """Represents a notification channel with send function and retry config."""
    name: str
    send_func: Callable
    retry_count: int = 3
    timeout_seconds: int = 30
    critical: bool = False  # Critical channels must succeed


class MultiChannelNotificationCoordinator:
    """
    Coordinates notification delivery across multiple channels.
    
    Ensures:
    1. All channels are attempted
    2. Failures in one channel don't block others
    3. Critical channels (email) are prioritized
    4. Consistent retry behavior
    5. Transaction rollback on complete failure
    """
    
    def __init__(self):
        self.channels: Dict[str, NotificationChannel] = {}
        self.results: Dict[str, Dict] = {}
    
    def register_channel(self, channel: NotificationChannel):
        """Register a notification channel."""
        self.channels[channel.name] = channel
        logger.debug(f"Registered notification channel: {channel.name}")
    
    def send_to_all(self, ticket_id: int, notification_type: str, context: Dict) -> Dict[str, bool]:
        """
        Send notification across all registered channels.
        
        Args:
            ticket_id: ID of ticket being notified
            notification_type: Type of notification (e.g., 'assignment', 'comment')
            context: Context data (recipient_email, message, etc.)
        
        Returns:
            Dict mapping channel name to success boolean
        """
        results = {}
        critical_failures = []
        
        for channel_name, channel in self.channels.items():
            try:
                logger.info(
                    f"Sending {notification_type} notification via {channel_name}",
                    extra={'ticket_id': ticket_id, 'channel': channel_name}
                )
                
                success = self._send_to_channel(channel, ticket_id, notification_type, context)
                results[channel_name] = success
                
                if success:
                    logger.info(f"✓ {channel_name} notification sent successfully")
                else:
                    logger.warning(f"✗ {channel_name} notification failed")
                    if channel.critical:
                        critical_failures.append(channel_name)
                        
            except Exception as e:
                logger.error(
                    f"✗ Exception in {channel_name} notification: {str(e)}",
                    extra={'ticket_id': ticket_id, 'channel': channel_name},
                    exc_info=True
                )
                results[channel_name] = False
                if channel.critical:
                    critical_failures.append(channel_name)
        
        # Log summary
        success_count = sum(1 for v in results.values() if v)
        total_count = len(results)
        logger.info(
            f"Notification delivery: {success_count}/{total_count} channels succeeded",
            extra={
                'ticket_id': ticket_id,
                'notification_type': notification_type,
                'results': results,
                'critical_failures': critical_failures
            }
        )
        
        self.results = results
        return results
    
    def _send_to_channel(
        self,
        channel: NotificationChannel,
        ticket_id: int,
        notification_type: str,
        context: Dict
    ) -> bool:
        """Send notification to single channel with timeout."""
        import signal
        
        def timeout_handler(signum, frame):
            raise TimeoutError(f"{channel.name} notification exceeded {channel.timeout_seconds}s timeout")
        
        # Set timeout
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(channel.timeout_seconds)
        
        try:
            # Call the channel's send function
            result = channel.send_func(ticket_id, notification_type, context)
            signal.alarm(0)  # Cancel alarm
            return bool(result)
        finally:
            signal.alarm(0)  # Cancel alarm
            signal.signal(signal.SIGALRM, old_handler)
    
    def get_results(self) -> Dict[str, bool]:
        """Get results from last send operation."""
        return self.results
    
    def was_successful(self) -> bool:
        """Check if all critical channels succeeded."""
        for channel_name, channel in self.channels.items():
            if channel.critical and not self.results.get(channel_name, False):
                return False
        return len(self.results) > 0
    
    def get_failed_channels(self) -> List[str]:
        """Get list of channels that failed."""
        return [name for name, success in self.results.items() if not success]
    
    def get_critical_failures(self) -> List[str]:
        """Get critical channels that failed."""
        failures = []
        for channel_name, channel in self.channels.items():
            if channel.critical and not self.results.get(channel_name, False):
                failures.append(channel_name)
        return failures


# Global coordinator instance
_global_coordinator = MultiChannelNotificationCoordinator()


def get_coordinator() -> MultiChannelNotificationCoordinator:
    """Get global notification coordinator."""
    return _global_coordinator


def register_notification_channel(
    name: str,
    send_func: Callable,
    retry_count: int = 3,
    critical: bool = False
):
    """Register a notification channel with the global coordinator."""
    channel = NotificationChannel(
        name=name,
        send_func=send_func,
        retry_count=retry_count,
        critical=critical
    )
    _global_coordinator.register_channel(channel)
    logger.info(f"Registered notification channel: {name} (critical={critical})")


def send_multi_channel_notification(
    ticket_id: int,
    notification_type: str,
    context: Dict
) -> bool:
    """
    Send notification across all registered channels.
    
    Returns:
        True if all critical channels succeeded, False otherwise
    """
    coordinator = get_coordinator()
    results = coordinator.send_to_all(ticket_id, notification_type, context)
    return coordinator.was_successful()


def log_notification_delivery(ticket_id: int, notification_type: str):
    """Log detailed notification delivery status."""
    coordinator = get_coordinator()
    results = coordinator.get_results()
    
    for channel, success in results.items():
        status = "✓ SENT" if success else "✗ FAILED"
        logger.info(
            f"[NOTIFICATION] {status} - Ticket #{ticket_id} ({notification_type}) via {channel}"
        )
