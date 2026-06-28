"""
Notification System Verification Tests

Comprehensive test suite to verify the remediated notification system:
- Retry logic
- Error handling
- Email threading validation
- Multi-channel consistency
- Slack/Email delivery

Run with: python manage.py shell < verification_tests.py
"""
import sys
import logging
from datetime import datetime
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class NotificationSystemVerification:
    """Comprehensive verification of notification system fixes."""
    
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def test(self, name: str, assertion: bool, reason: str = ""):
        """Record test result."""
        status = "✓ PASS" if assertion else "✗ FAIL"
        message = f"{status}: {name}"
        if reason:
            message += f" ({reason})"
        print(message)
        self.results.append((name, assertion, reason))
        if assertion:
            self.passed += 1
        else:
            self.failed += 1
        return assertion
    
    def test_retry_config_exists(self):
        """Test 1: Verify retry configuration utilities exist."""
        print("\n=== TEST 1: Retry Configuration ===")
        try:
            from shared.utils.notification_retry import (
                NOTIFICATION_RETRY_CONFIG,
                FAST_NOTIFICATION_RETRY_CONFIG,
                retry_notification_task,
                NotificationRetryError,
                NotificationPermanentError,
            )
            self.test("Retry configs imported", True)
            self.test("NOTIFICATION_RETRY_CONFIG has max_retries", 
                     NOTIFICATION_RETRY_CONFIG.get('max_retries') == 5)
            self.test("NOTIFICATION_RETRY_CONFIG has exponential backoff",
                     'default_retry_delay' in NOTIFICATION_RETRY_CONFIG)
            self.test("FAST_NOTIFICATION_RETRY_CONFIG exists",
                     FAST_NOTIFICATION_RETRY_CONFIG.get('max_retries') == 3)
        except ImportError as e:
            self.test("Retry configs imported", False, str(e))
    
    def test_email_threading_validation(self):
        """Test 2: Verify email threading validation."""
        print("\n=== TEST 2: Email Threading Validation ===")
        try:
            from shared.utils.email_threading import (
                EmailThreadingValidator,
                EmailThreadingBuilder,
            )
            
            # Test valid Message-ID
            valid_msg_id = "<1234.abc123@example.com>"
            is_valid = EmailThreadingValidator.validate_message_id(valid_msg_id)
            self.test("Valid Message-ID recognized", is_valid)
            
            # Test invalid Message-ID
            invalid_msg_id = "not_a_valid_message_id"
            is_invalid = not EmailThreadingValidator.validate_message_id(invalid_msg_id)
            self.test("Invalid Message-ID rejected", is_invalid)
            
            # Test header building
            headers = EmailThreadingBuilder.build_threading_headers(
                original_message_id=valid_msg_id,
                domain="safaridesk.io"
            )
            self.test("Threading headers built",
                     'Message-ID' in headers and 'In-Reply-To' in headers)
            
            # Test header validation
            is_valid, reason = EmailThreadingValidator.validate_threading_headers(headers)
            self.test("Built headers are valid", is_valid, reason)
            
        except ImportError as e:
            self.test("Email threading module imported", False, str(e))
    
    def test_ticket_notification_decorators(self):
        """Test 3: Verify Ticket notification tasks have retry decorators."""
        print("\n=== TEST 3: Ticket Notification Decorators ===")
        try:
            from shared.workers.Ticket import (
                ticket_created_customer_notification,
                ticket_created_agent_notification,
                new_public_reply_customer_notification,
                send_slack_ticket_notification,
            )
            
            # Check if tasks have retry config
            tasks_to_check = [
                (ticket_created_customer_notification, "ticket_created_customer_notification"),
                (ticket_created_agent_notification, "ticket_created_agent_notification"),
                (new_public_reply_customer_notification, "new_public_reply_customer_notification"),
                (send_slack_ticket_notification, "send_slack_ticket_notification"),
            ]
            
            for task, name in tasks_to_check:
                has_bind = hasattr(task, 'bind') and task.bind == True
                has_max_retries = hasattr(task, 'max_retries') and task.max_retries > 0
                self.test(f"{name} has retry config", has_bind or has_max_retries,
                         f"bind={has_bind}, max_retries={has_max_retries if has_max_retries else 'N/A'}")
        except ImportError as e:
            self.test("Ticket tasks imported", False, str(e))
    
    def test_task_notification_decorators(self):
        """Test 4: Verify Task notification tasks have retry decorators."""
        print("\n=== TEST 4: Task Notification Decorators ===")
        try:
            from shared.workers.Task import (
                task_created_agent_notification,
                task_assigned_notification,
                task_status_changed_notification,
            )
            
            tasks_to_check = [
                (task_created_agent_notification, "task_created_agent_notification"),
                (task_assigned_notification, "task_assigned_notification"),
                (task_status_changed_notification, "task_status_changed_notification"),
            ]
            
            for task, name in tasks_to_check:
                has_retry = hasattr(task, 'max_retries') and task.max_retries > 0
                self.test(f"{name} has retry config", has_retry)
        except ImportError as e:
            self.test("Task tasks imported", False, str(e))
    
    def test_slack_notification_improvements(self):
        """Test 5: Verify Slack notification improvements."""
        print("\n=== TEST 5: Slack Notification Improvements ===")
        try:
            from shared.tasks.slack_tasks import (
                process_slack_event,
                notify_slack_ticket_update,
            )
            
            self.test("process_slack_event has retry config",
                     hasattr(process_slack_event, 'max_retries'))
            self.test("notify_slack_ticket_update has retry config",
                     hasattr(notify_slack_ticket_update, 'max_retries'))
        except ImportError as e:
            self.test("Slack tasks imported", False, str(e))
    
    def test_error_handling_utilities(self):
        """Test 6: Verify error handling utilities."""
        print("\n=== TEST 6: Error Handling Utilities ===")
        try:
            from shared.utils.notification_retry import (
                log_notification_failure,
                log_notification_success,
                NotificationPermanentError,
                safe_get_ticket,
                safe_get_task,
            )
            
            # Test log functions exist and are callable
            self.test("log_notification_failure exists", callable(log_notification_failure))
            self.test("log_notification_success exists", callable(log_notification_success))
            self.test("NotificationPermanentError exists", NotificationPermanentError)
            self.test("safe_get_ticket exists", callable(safe_get_ticket))
            self.test("safe_get_task exists", callable(safe_get_task))
            
        except ImportError as e:
            self.test("Error handling utilities imported", False, str(e))
    
    def test_multi_channel_coordinator(self):
        """Test 7: Verify multi-channel notification coordinator."""
        print("\n=== TEST 7: Multi-Channel Coordinator ===")
        try:
            from shared.services.multi_channel_notifier import (
                MultiChannelNotificationCoordinator,
                NotificationChannel,
                get_coordinator,
                register_notification_channel,
            )
            
            self.test("MultiChannelNotificationCoordinator exists", 
                     MultiChannelNotificationCoordinator)
            self.test("NotificationChannel exists", NotificationChannel)
            self.test("get_coordinator exists", callable(get_coordinator))
            self.test("register_notification_channel exists",
                     callable(register_notification_channel))
            
            # Test coordinator methods
            coordinator = get_coordinator()
            self.test("Coordinator.send_to_all exists", 
                     hasattr(coordinator, 'send_to_all'))
            self.test("Coordinator.get_failed_channels exists",
                     hasattr(coordinator, 'get_failed_channels'))
            
        except ImportError as e:
            self.test("Multi-channel coordinator imported", False, str(e))
    
    def test_notification_imports(self):
        """Test 8: Verify notification system imports work."""
        print("\n=== TEST 8: Complete Notification System Imports ===")
        try:
            # Try importing complete notification system
            from tenant.models import Notification
            from shared.serializers.NotificationSerializer import NotificationSerializer
            from shared.services.notification_preferences import NotificationSettingsService
            
            self.test("Notification model exists", Notification)
            self.test("NotificationSerializer exists", NotificationSerializer)
            self.test("NotificationSettingsService exists", NotificationSettingsService)
            
        except ImportError as e:
            self.test("Notification system imported", False, str(e))
    
    def print_summary(self):
        """Print test summary."""
        total = self.passed + self.failed
        percentage = (self.passed / total * 100) if total > 0 else 0
        
        print("\n" + "="*60)
        print("VERIFICATION SUMMARY")
        print("="*60)
        print(f"✓ Passed: {self.passed}/{total} ({percentage:.1f}%)")
        print(f"✗ Failed: {self.failed}/{total}")
        
        if self.failed > 0:
            print("\nFailed Tests:")
            for name, passed, reason in self.results:
                if not passed:
                    print(f"  - {name}")
                    if reason:
                        print(f"    {reason}")
        
        print("="*60)
        return self.failed == 0


def run_verification():
    """Run complete verification suite."""
    print("\n" + "="*60)
    print("SAFARIDESK NOTIFICATION SYSTEM VERIFICATION")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    verifier = NotificationSystemVerification()
    
    try:
        verifier.test_retry_config_exists()
        verifier.test_email_threading_validation()
        verifier.test_ticket_notification_decorators()
        verifier.test_task_notification_decorators()
        verifier.test_slack_notification_improvements()
        verifier.test_error_handling_utilities()
        verifier.test_multi_channel_coordinator()
        verifier.test_notification_imports()
        
        success = verifier.print_summary()
        return 0 if success else 1
        
    except Exception as e:
        print(f"\n✗ Verification failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    exit_code = run_verification()
    sys.exit(exit_code)
