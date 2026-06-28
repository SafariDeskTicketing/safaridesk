"""
Email Configuration Test Utility
Test SMTP and IMAP connectivity for SafariDesk Email-to-Ticket system

Usage:
    python manage.py shell
    >>> from util.test_email_config import EmailConfigTester
    >>> tester = EmailConfigTester()
    
    # Test SMTP (sending)
    >>> tester.test_smtp_connection('smtp.gmail.com', 587, 'your-email@gmail.com', 'your-app-password', use_tls=True)
    
    # Test IMAP (receiving)
    >>> tester.test_imap_connection('imap.gmail.com', 993, 'your-email@gmail.com', 'your-app-password')
    
    # Test business SMTP config
    >>> tester.test_business_smtp(business_id=1)
    
    # Test department email IMAP
    >>> tester.test_department_imap(department_email_id=1)
"""

import imaplib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


class EmailConfigTester:
    
    def __init__(self):
        self.results = []
        
    def test_smtp_connection(self, host, port, username, password, use_tls=True, use_ssl=False, test_email=None):
        """
        Test SMTP connection for sending emails
        
        Args:
            host (str): SMTP host (e.g., 'smtp.gmail.com')
            port (int): SMTP port (587 for TLS, 465 for SSL)
            username (str): SMTP username (usually email address)
            password (str): SMTP password (App Password for Gmail)
            use_tls (bool): Use TLS encryption (default True for port 587)
            use_ssl (bool): Use SSL encryption (default False, set True for port 465)
            test_email (str): Optional email address to send test email to
            
        Returns:
            dict: Test results with status and messages
        """
        result = {
            'test': 'SMTP Connection',
            'host': host,
            'port': port,
            'username': username,
            'use_tls': use_tls,
            'use_ssl': use_ssl,
            'status': 'PENDING',
            'messages': []
        }
        
        try:
            # Step 1: Connect to SMTP server
            result['messages'].append(f"Connecting to {host}:{port}...")
            
            if use_ssl:
                server = smtplib.SMTP_SSL(host, port, timeout=30)
                result['messages'].append("✅ Connected using SSL")
            else:
                server = smtplib.SMTP(host, port, timeout=30)
                result['messages'].append("✅ Connected to SMTP server")
                
                if use_tls:
                    server.starttls()
                    result['messages'].append("✅ TLS encryption enabled")
            
            # Step 2: Login
            result['messages'].append(f"Authenticating as {username}...")
            server.login(username, password)
            result['messages'].append("✅ Authentication successful")
            
            # Step 3: Send test email if requested
            if test_email:
                result['messages'].append(f"Sending test email to {test_email}...")
                
                msg = MIMEMultipart()
                msg['From'] = username
                msg['To'] = test_email
                msg['Subject'] = 'SafariDesk SMTP Test'
                
                body = f"""
                This is a test email from SafariDesk Email Configuration Tester.
                
                If you receive this email, your SMTP configuration is working correctly!
                
                Configuration Details:
                - SMTP Host: {host}
                - SMTP Port: {port}
                - Use TLS: {use_tls}
                - Use SSL: {use_ssl}
                - Username: {username}
                
                Test completed successfully.
                """
                
                msg.attach(MIMEText(body, 'plain'))
                server.send_message(msg)
                result['messages'].append(f"✅ Test email sent to {test_email}")
            
            # Step 4: Close connection
            server.quit()
            result['messages'].append("✅ Connection closed")
            
            result['status'] = 'SUCCESS'
            result['messages'].append("\n🎉 SMTP configuration is working correctly!")
            
        except smtplib.SMTPAuthenticationError as e:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Authentication failed: {str(e)}")
            result['messages'].append("\nPossible causes:")
            result['messages'].append("1. Wrong username or password")
            result['messages'].append("2. Using regular password instead of App Password (Gmail requires App Password)")
            result['messages'].append("3. 2FA enabled but no App Password generated")
            result['messages'].append("4. Account security settings blocking access")
            
        except smtplib.SMTPConnectError as e:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Connection failed: {str(e)}")
            result['messages'].append("\nPossible causes:")
            result['messages'].append("1. Wrong SMTP host or port")
            result['messages'].append("2. Firewall blocking connection")
            result['messages'].append("3. Network connectivity issues")
            
        except Exception as e:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Unexpected error: {str(e)}")
            
        self.results.append(result)
        self._print_result(result)
        return result
    
    def test_imap_connection(self, host, port, username, password, use_ssl=True):
        """
        Test IMAP connection for receiving emails
        
        Args:
            host (str): IMAP host (e.g., 'imap.gmail.com')
            port (int): IMAP port (993 for SSL, 143 for TLS)
            username (str): IMAP username (usually email address)
            password (str): IMAP password (App Password for Gmail)
            use_ssl (bool): Use SSL encryption (default True for port 993)
            
        Returns:
            dict: Test results with status and messages
        """
        result = {
            'test': 'IMAP Connection',
            'host': host,
            'port': port,
            'username': username,
            'use_ssl': use_ssl,
            'status': 'PENDING',
            'messages': []
        }
        
        try:
            # Step 1: Connect to IMAP server
            result['messages'].append(f"Connecting to {host}:{port}...")
            
            if use_ssl:
                mail = imaplib.IMAP4_SSL(host, port, timeout=30)
                result['messages'].append("✅ Connected using SSL")
            else:
                mail = imaplib.IMAP4(host, port, timeout=30)
                result['messages'].append("✅ Connected to IMAP server")
            
            # Step 2: Login
            result['messages'].append(f"Authenticating as {username}...")
            mail.login(username, password)
            result['messages'].append("✅ Authentication successful")
            
            # Step 3: List mailboxes
            result['messages'].append("Listing mailboxes...")
            status, mailboxes = mail.list()
            if status == 'OK':
                result['messages'].append(f"✅ Found {len(mailboxes)} mailboxes")
            
            # Step 4: Select INBOX
            result['messages'].append("Selecting INBOX...")
            status, messages = mail.select('INBOX')
            if status == 'OK':
                message_count = int(messages[0])
                result['messages'].append(f"✅ INBOX selected - {message_count} messages")
            
            # Step 5: Search for unread emails
            result['messages'].append("Searching for unread emails...")
            status, unread = mail.search(None, 'UNSEEN')
            if status == 'OK':
                unread_ids = unread[0].split()
                result['messages'].append(f"✅ Found {len(unread_ids)} unread emails")
            
            # Step 6: Close connection
            mail.close()
            mail.logout()
            result['messages'].append("✅ Connection closed")
            
            result['status'] = 'SUCCESS'
            result['messages'].append("\n🎉 IMAP configuration is working correctly!")
            
        except imaplib.IMAP4.error as e:
            result['status'] = 'FAILED'
            error_str = str(e)
            
            if 'AUTHENTICATIONFAILED' in error_str or 'LOGIN' in error_str:
                result['messages'].append(f"❌ Authentication failed: {error_str}")
                result['messages'].append("\nPossible causes:")
                result['messages'].append("1. Wrong username or password")
                result['messages'].append("2. Using regular password instead of App Password (Gmail requires App Password)")
                result['messages'].append("3. IMAP not enabled in email account settings")
                result['messages'].append("4. 2FA enabled but no App Password generated")
                
                if 'gmail' in host.lower():
                    result['messages'].append("\nFor Gmail:")
                    result['messages'].append("- Enable 2FA: https://myaccount.google.com/signinoptions/two-step-verification")
                    result['messages'].append("- Generate App Password: https://myaccount.google.com/apppasswords")
                    result['messages'].append("- Enable IMAP: Gmail Settings → Forwarding and POP/IMAP → Enable IMAP")
                    
            else:
                result['messages'].append(f"❌ IMAP error: {error_str}")
                
        except Exception as e:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Unexpected error: {str(e)}")
            result['messages'].append("\nPossible causes:")
            result['messages'].append("1. Wrong IMAP host or port")
            result['messages'].append("2. Firewall blocking connection")
            result['messages'].append("3. Network connectivity issues")
            
        self.results.append(result)
        self._print_result(result)
        return result
    
    def test_business_smtp(self, business_id):
        """
        Test SMTP configuration for a business
        
        Args:
            business_id (int): Business ID from database
            
        Returns:
            dict: Test results
        """
        from tenant.models import SettingSMTP
        from users.models import Business
        
        result = {
            'test': 'Business SMTP Configuration',
            'business_id': business_id,
            'status': 'PENDING',
            'messages': []
        }
        
        try:
            business = Business.objects.get(id=business_id)
            result['messages'].append(f"Testing SMTP for business: {business.name}")
            
            smtp = SettingSMTP.objects.filter(business=business).first()
            
            if not smtp:
                result['status'] = 'FAILED'
                result['messages'].append("❌ No SMTP configuration found for this business")
                result['messages'].append("Please configure SMTP in Django Admin: Tenant → Setting SMTP")
                self.results.append(result)
                self._print_result(result)
                return result
            
            result['messages'].append(f"Found SMTP config:")
            result['messages'].append(f"  - Host: {smtp.host}")
            result['messages'].append(f"  - Port: {smtp.port}")
            result['messages'].append(f"  - Username: {smtp.username}")
            result['messages'].append(f"  - Use TLS: {smtp.use_tls}")
            result['messages'].append(f"  - Use SSL: {smtp.use_ssl}")
            result['messages'].append(f"  - From Email: {smtp.default_from_email}")
            
            # Test connection
            result['messages'].append("\nTesting connection...")
            return self.test_smtp_connection(
                host=smtp.host,
                port=smtp.port,
                username=smtp.username,
                password=smtp.password,
                use_tls=smtp.use_tls,
                use_ssl=smtp.use_ssl
            )
            
        except Business.DoesNotExist:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Business with ID {business_id} not found")
            
        except Exception as e:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Error: {str(e)}")
            
        self.results.append(result)
        self._print_result(result)
        return result
    
    def test_department_imap(self, department_email_id):
        """
        Test IMAP configuration for a department email
        
        Args:
            department_email_id (int): DepartmentEmails ID from database
            
        Returns:
            dict: Test results
        """
        from tenant.models import DepartmentEmails
        
        result = {
            'test': 'Department Email IMAP Configuration',
            'department_email_id': department_email_id,
            'status': 'PENDING',
            'messages': []
        }
        
        try:
            dept_email = DepartmentEmails.objects.get(id=department_email_id)
            result['messages'].append(f"Testing IMAP for: {dept_email.email}")
            result['messages'].append(f"Department: {dept_email.department.name}")
            result['messages'].append(f"Business: {dept_email.department.business.name}")
            
            # Get IMAP settings (use IMAP fields if available, fallback to SMTP fields)
            imap_host = dept_email.imap_host or dept_email.host
            imap_port = dept_email.imap_port or 993
            imap_username = dept_email.imap_username or dept_email.username
            imap_password = dept_email.imap_password or dept_email.password
            use_ssl = dept_email.imap_use_ssl if dept_email.imap_use_ssl is not None else True
            
            if not imap_host or not imap_username or not imap_password:
                result['status'] = 'FAILED'
                result['messages'].append("❌ IMAP configuration incomplete")
                result['messages'].append("Missing: " + ", ".join([
                    "IMAP Host" if not imap_host else "",
                    "IMAP Username" if not imap_username else "",
                    "IMAP Password" if not imap_password else ""
                ]).strip(", "))
                self.results.append(result)
                self._print_result(result)
                return result
            
            result['messages'].append(f"\nFound IMAP config:")
            result['messages'].append(f"  - Host: {imap_host}")
            result['messages'].append(f"  - Port: {imap_port}")
            result['messages'].append(f"  - Username: {imap_username}")
            result['messages'].append(f"  - Use SSL: {use_ssl}")
            
            # Test connection
            result['messages'].append("\nTesting connection...")
            return self.test_imap_connection(
                host=imap_host,
                port=imap_port,
                username=imap_username,
                password=imap_password,
                use_ssl=use_ssl
            )
            
        except DepartmentEmails.DoesNotExist:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ DepartmentEmails with ID {department_email_id} not found")
            
        except Exception as e:
            result['status'] = 'FAILED'
            result['messages'].append(f"❌ Error: {str(e)}")
            
        self.results.append(result)
        self._print_result(result)
        return result
    
    def test_all_department_emails(self):
        """Test IMAP for all active department emails"""
        from tenant.models import DepartmentEmails
        
        dept_emails = DepartmentEmails.objects.filter(is_active=True)
        
        print(f"\n{'='*80}")
        print(f"Testing {dept_emails.count()} active department emails")
        print(f"{'='*80}\n")
        
        for dept_email in dept_emails:
            self.test_department_imap(dept_email.id)
            print()  # Empty line between tests
        
        self._print_summary()
    
    def _print_result(self, result):
        """Print test result in formatted way"""
        print(f"\n{'='*80}")
        print(f"TEST: {result['test']}")
        print(f"{'='*80}")
        
        for key, value in result.items():
            if key not in ['test', 'messages', 'status']:
                print(f"{key}: {value}")
        
        print(f"\n{'-'*80}")
        for message in result['messages']:
            print(message)
        print(f"{'-'*80}")
        
        if result['status'] == 'SUCCESS':
            print(f"\n✅ STATUS: {result['status']}")
        else:
            print(f"\n❌ STATUS: {result['status']}")
        
        print(f"{'='*80}\n")
    
    def _print_summary(self):
        """Print summary of all tests"""
        if not self.results:
            return
        
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY")
        print(f"{'='*80}")
        
        total = len(self.results)
        success = sum(1 for r in self.results if r['status'] == 'SUCCESS')
        failed = total - success
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {success}")
        print(f"❌ Failed: {failed}")
        print(f"{'='*80}\n")


# Quick test functions for common scenarios
def quick_test_gmail(email, app_password, send_test_to=None):
    """Quick test for Gmail configuration"""
    tester = EmailConfigTester()
    
    print("Testing Gmail SMTP (sending)...")
    tester.test_smtp_connection(
        host='smtp.gmail.com',
        port=587,
        username=email,
        password=app_password,
        use_tls=True,
        test_email=send_test_to
    )
    
    print("\nTesting Gmail IMAP (receiving)...")
    tester.test_imap_connection(
        host='imap.gmail.com',
        port=993,
        username=email,
        password=app_password,
        use_ssl=True
    )
    
    return tester


def quick_test_outlook(email, password, send_test_to=None):
    """Quick test for Outlook/Office 365 configuration"""
    tester = EmailConfigTester()
    
    print("Testing Outlook SMTP (sending)...")
    tester.test_smtp_connection(
        host='smtp-mail.outlook.com',
        port=587,
        username=email,
        password=password,
        use_tls=True,
        test_email=send_test_to
    )
    
    print("\nTesting Outlook IMAP (receiving)...")
    tester.test_imap_connection(
        host='outlook.office365.com',
        port=993,
        username=email,
        password=password,
        use_ssl=True
    )
    
    return tester


# Example usage in comments
"""
# Test Gmail configuration
from util.test_email_config import quick_test_gmail
tester = quick_test_gmail('your-email@gmail.com', 'your-16-char-app-password', 'test-recipient@example.com')

# Test Outlook configuration
from util.test_email_config import quick_test_outlook
tester = quick_test_outlook('your-email@outlook.com', 'your-password', 'test-recipient@example.com')

# Test business SMTP from database
from util.test_email_config import EmailConfigTester
tester = EmailConfigTester()
tester.test_business_smtp(business_id=1)

# Test specific department email from database
tester.test_department_imap(department_email_id=1)

# Test all department emails
tester.test_all_department_emails()
"""
