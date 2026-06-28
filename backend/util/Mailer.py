import logging

from django.core.mail import get_connection, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import linebreaks
from django.conf import settings
from html import escape
from tenant.models import SettingSMTP, MailIntegration, EmailSettings
from django.template import Template, Context
from util.mail.mailgun import send_mailgun_message

logger = logging.getLogger(__name__)

EMAIL_BRAND_THEME_MAP = {
    'default': {'primary': '#13343B', 'surface': '#F4F7F8', 'accent': '#2B6F77'},
    'indigo': {'primary': '#4F46E5', 'surface': '#F5F4FF', 'accent': '#6366F1'},
    'microsoft': {'primary': '#2563EB', 'surface': '#EFF6FF', 'accent': '#0EA5E9'},
    'forest': {'primary': '#15803D', 'surface': '#F0FDF4', 'accent': '#22C55E'},
    'red': {'primary': '#DC2626', 'surface': '#FEF2F2', 'accent': '#EF4444'},
    'gray': {'primary': '#475569', 'surface': '#F8FAFC', 'accent': '#64748B'},
}


class Mailer:
    def get_email_brand_context(self, business=None) -> dict:
        """Return consistent brand values for Django email templates."""
        business_name = getattr(business, 'name', None) or 'SafariDesk'
        color_theme = getattr(business, 'color_theme', None) or 'default'
        theme = EMAIL_BRAND_THEME_MAP.get(color_theme, EMAIL_BRAND_THEME_MAP['default'])
        logo = getattr(business, 'logo_url', None) or getattr(business, 'favicon_url', None)

        if not logo:
            business_logo = getattr(business, 'logo', None)
            logo = getattr(business_logo, 'url', None)

        return {
            'business_name': business_name,
            'organization_name': business_name,
            'company_name': business_name,
            'business_logo': logo,
            'business_logo_url': logo,
            'brand_primary': theme['primary'],
            'brand_surface': theme['surface'],
            'brand_accent': theme['accent'],
            'product_name': 'SafariDesk',
        }

    def get_smtp_connection_for_business(self, business):
        """
            Returns a tuple: (
                SMTP connection,
                from_email string
                )
            Priority:
            1. Business-specific SMTP settings from the database.
            2. Django default EMAIL_* settings and DEFAULT_FROM_NAME.
        """
        smtp = SettingSMTP.objects.filter(business=business).first()
        if smtp:
            try:
                connection = get_connection(
                    host=smtp.host,
                    port=smtp.port,
                    username=smtp.username,
                    password=smtp.password,
                    use_tls=smtp.use_tls,
                    use_ssl=smtp.use_ssl
                )
                from_email = (
                    f"{smtp.sender_name} <{smtp.default_from_email}>"
                    if smtp.sender_name else smtp.default_from_email
                )
                return connection, from_email
            except Exception as e:
                logger.warning(f"[Mailer] Failed to use custom SMTP config for business {business}: {e}")

        # Fallback to default Django settings
        try:
            connection = get_connection(
                host=settings.EMAIL_HOST,
                port=settings.EMAIL_PORT,
                username=settings.EMAIL_HOST_USER,
                password=settings.EMAIL_HOST_PASSWORD,
                use_tls=getattr(settings, 'EMAIL_USE_TLS', False),
                use_ssl=getattr(settings, 'EMAIL_USE_SSL', True),
            )
            default_name = getattr(settings, 'DEFAULT_FROM_NAME', None)
            default_email = settings.DEFAULT_FROM_EMAIL
            from_email = f"{default_name} <{default_email}>" if default_name else default_email
            return connection, from_email
        except Exception as e:
            logger.error(f"[Mailer] Failed to load fallback SMTP config: {e}")
            return get_connection(), settings.DEFAULT_FROM_EMAIL

    def render_templated_email(
        self,
        template,
        context: dict,
        business,
        receiver_email: str,
        *,
        from_email_override: str | None = None,
    ) -> dict | None:
        """Render a template into a send-ready payload without dispatching it."""
        connection, from_email = self.get_smtp_connection_for_business(business)
        if from_email_override:
            from_email = from_email_override

        try:
            class SafeDict(dict):
                def __missing__(self, key):
                    return ''

            safe_context = SafeDict(context)

            subject_template = Template(template.subject)
            body_template = Template(template.body)

            subject = subject_template.render(Context(safe_context))
            body_text = body_template.render(Context(safe_context))
            plain_text_body = body_text.strip() or subject

            body_html = linebreaks(body_text)

            cta_url = (
                safe_context.get('cta_url')
                or safe_context.get('ticket_url')
                or safe_context.get('link')
                or safe_context.get('url')
            )
            cta_label = safe_context.get('cta_label') or ('View Ticket' if cta_url else None)
            support_text = safe_context.get('support_text')

            # Fetch email settings for signature
            email_settings = EmailSettings.objects.filter(business=business).first()

            html_body = render_to_string('email/base.html', {
                **self.get_email_brand_context(business),
                'headline': safe_context.get('email_headline') or subject,
                'eyebrow': safe_context.get('eyebrow') or safe_context.get('email_eyebrow'),
                'preheader': safe_context.get('preheader') or safe_context.get('email_preheader') or subject,
                'body_html': body_html,
                'cta_url': cta_url,
                'cta_label': cta_label,
                'support_text': support_text,
                'signature_name': email_settings.get_signature_name() if email_settings else getattr(business, 'name', 'Support Team'),
                'signature_greeting': email_settings.signature_greeting if email_settings else 'Regards,',
            })
        except Exception as e:
            logger.error(f"[Mailer] Failed rendering email template {template.name}: {e}")
            return None

        return {
            "connection": connection,
            "from_email": from_email,
            "receiver_email": receiver_email,
            "subject": subject,
            "plain_text_body": plain_text_body,
            "html_body": html_body,
        }

    def send_rendered_email(
        self,
        *,
        template_name: str,
        business,
        connection,
        from_email: str,
        receiver_email: str,
        subject: str,
        plain_text_body: str,
        html_body: str,
        extra_headers: dict | None = None,
    ) -> bool:
        """Send an already-rendered email payload."""

        # Attempt Mailgun for safaridesk aliases if available
        mg_integration = MailIntegration.objects.filter(
            business=business,
            provider=MailIntegration.Provider.SAFARIDESK,
            connection_status=MailIntegration.ConnectionStatus.CONNECTED,
        ).first()

        if mg_integration and settings.MAILGUN_API_KEY and settings.MAILGUN_DOMAIN:
            mg_from = from_email or f"support <{mg_integration.forwarding_address or mg_integration.email_address}>"
            sent = send_mailgun_message(
                to=receiver_email,
                subject=subject,
                text=plain_text_body,
                html=html_body,
                from_email=mg_from,
                headers=extra_headers or {},
            )
            if sent:
                logger.info(
                    "[Mailer] Sent via Mailgun (safaridesk alias) '%s' to %s for business %s",
                    template_name,
                    receiver_email,
                    business,
                )
                return True
            logger.warning("[Mailer] Mailgun send failed, falling back to SMTP for %s", receiver_email)

        try:
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_body,
                from_email=from_email,
                to=[receiver_email],
                connection=connection,
                headers=extra_headers or {},
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=False)
            logger.info(f"[Mailer] Sent email '{template_name}' to {receiver_email} for business {business}")
            return True
        except Exception as e:
            logger.error(f"[Mailer] Failed to send email '{template_name}' to {receiver_email}: {e}")
            return False

    def send_templated_email(
        self,
        template,
        context: dict,
        business,
        receiver_email: str,
        *,
        from_email_override: str | None = None,
        extra_headers: dict | None = None,
    ):
        """
        Sends an email using a given template, business SMTP settings, and receiver.

        Args:
            template (EmailTemplate): The EmailTemplate instance.
            context (dict): Context values to replace placeholders in subject/body.
            business (Business): The business object for SMTP settings.
            receiver_email (str): The recipient email.
        """
        payload = self.render_templated_email(
            template=template,
            context=context,
            business=business,
            receiver_email=receiver_email,
            from_email_override=from_email_override,
        )
        if not payload:
            return False

        return self.send_rendered_email(
            template_name=template.name,
            business=business,
            connection=payload["connection"],
            from_email=payload["from_email"],
            receiver_email=payload["receiver_email"],
            subject=payload["subject"],
            plain_text_body=payload["plain_text_body"],
            html_body=payload["html_body"],
            extra_headers=extra_headers,
        )


    def send_otp(self, otp, user_email):
        try:
            from users.models import Users

            logger.info(f"Sending OTP: {otp} to {user_email}")

            # Validate inputs
            if not otp or not user_email:
                logger.error("OTP or user email is missing")
                return False

            # Get user from database
            try:
                user = Users.objects.filter(email=user_email).first()

                if not user:
                    logger.error(f"User with email {user_email} not found")
                    return False
            except Exception as e:
                logger.error(f"Database error when fetching user {user_email}: {str(e)}")
                return False

            # Prepare email context
            try:
                business = getattr(user, 'business', None)
                context = {
                    **self.get_email_brand_context(business),
                    'name': user.full_name() if hasattr(user, 'full_name') and callable(user.full_name) else 'User',
                    'otp': otp,
                }
            except Exception as e:
                logger.error(f"Error preparing email context: {str(e)}")
                context = {
                    **self.get_email_brand_context(getattr(user, 'business', None)),
                    'name': 'User',
                    'otp': otp,
                }

            subject = "Your verification OTP"

            # Create plain text content
            plain_text_content = f"""
            Hi {context['name']},

            Your verification OTP is: {otp}

            This OTP will expire in a few minutes. Please use it to complete your verification.

            If you didn't request this OTP, please ignore this email.

            Best regards,
            {context['company_name']} Team
            """

            # Render HTML template
            try:
                html_content = render_to_string('otp.html', context)
            except Exception as e:
                logger.error(f"Error rendering HTML template: {str(e)}")
                # Fallback to plain text only
                html_content = None

            try:
                connection, from_email = self.get_smtp_connection_for_business(user.business)

                # Create email message
                email_message = EmailMultiAlternatives(
                    subject=subject,
                    body=plain_text_content,
                    from_email=from_email,
                    to=[user_email],
                    connection=connection
                )

                # Attach HTML version if available
                if html_content:
                    email_message.attach_alternative(html_content, "text/html")

                # Send email
                email_message.send()

                logger.info(f"OTP email sent successfully to {user_email}")
                return True

            except Exception as e:
                logger.error(f"Failed to send OTP email to {user_email}: {str(e)}")
                return False

        except ImportError as e:
            logger.error(f"Import error in send_otp: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error in send_otp: {str(e)}")
            return False

    def send_password_reset_link(self, link, user_email):
        try:
            from users.models import Users

            logger.info(f"Sending password reset link to {user_email}")

            # Validate inputs
            if not link or not user_email:
                logger.error("Reset link or user email is missing")
                return False

            # Get user from database
            try:
                user = Users.objects.filter(email__iexact=user_email.strip()).first()

                if not user:
                    logger.error(f"User with email {user_email} not found")
                    return False
            except Exception as e:
                logger.error(f"Database error when fetching user {user_email}: {str(e)}")
                return False

            # Prepare email context
            try:
                business = getattr(user, 'business', None)
                context = {
                    **self.get_email_brand_context(business),
                    'name': user.full_name() if hasattr(user, 'full_name') and callable(user.full_name) else 'User',
                    'reset_link': link,
                }
            except Exception as e:
                logger.error(f"Error preparing email context: {str(e)}")
                context = {
                    **self.get_email_brand_context(getattr(user, 'business', None)),
                    'name': 'User',
                    'reset_link': link,
                }

            subject = "Password Reset Request"

            # Create plain text content
            plain_text_content = f"""
            Hi {context['name']},

            We received a request to reset your password. Click the link below to reset your password:

            {link}

            This link will expire in 15 minutes for security reasons.

            If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.

            Best regards,
            {context['company_name']} Team
            """

            # Render HTML template
            try:
                html_content = render_to_string('password-reset.html', context)
            except Exception as e:
                logger.error(f"Error rendering HTML template: {str(e)}")
                # Fallback to plain text only
                html_content = None

            try:
                connection, from_email = self.get_smtp_connection_for_business(user.business)

                return self.send_rendered_email(
                    template_name="password_reset_link",
                    business=user.business,
                    connection=connection,
                    from_email=from_email,
                    receiver_email=user_email.strip(),
                    subject=subject,
                    plain_text_body=plain_text_content.strip(),
                    html_body=html_content or linebreaks(plain_text_content),
                )

            except Exception as e:
                logger.error(f"Failed to send password reset email to {user_email}: {str(e)}")
                return False

        except ImportError as e:
            logger.error(f"Import error in send_password_reset_link: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error in send_password_reset_link: {str(e)}")
            return False

    def send_role_changed_notice(self, user):
        try:
            if not user:
                logger.error("User not provided for role change notice")
                return False

            business = getattr(user, 'business', None)
            user_email = user.email
            user_name = user.full_name().strip() if hasattr(user, 'full_name') else user.email
            company_name = getattr(business, 'name', 'SafariDesk')
            subject = "Your SafariDesk role has changed"
            plain_text_content = f"""
Hi {user_name},

Your role has changed. Please sign in again to continue securely.

Best regards,
{company_name} Team
"""
            html_content = render_to_string('email/base.html', {
                **self.get_email_brand_context(business),
                'eyebrow': 'Security notice',
                'headline': 'Your role has changed',
                'preheader': 'Your SafariDesk role was updated.',
                'body_html': (
                    f"<p>Hi {escape(user_name)},</p>"
                    "<p>Your role has changed. Please sign in again to continue securely.</p>"
                ),
                'signature_name': f"{company_name} Team",
            })

            connection, from_email = self.get_smtp_connection_for_business(business)
            email_message = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_content.strip(),
                from_email=from_email,
                to=[user_email],
                connection=connection
            )
            email_message.attach_alternative(html_content, "text/html")
            email_message.send()

            logger.info("Role change notice sent successfully to %s", user_email)
            return True
        except Exception as e:
            logger.error("Failed to send role change notice to %s: %s", getattr(user, "email", None), str(e))
            return False

    def send_customer_magic_link(self, link, customer_email, *, business=None, customer_name=None, expires_minutes: int = 15):
        try:
            from users.models import Customer

            logger.info("Sending customer magic link to %s", customer_email)

            if not link or not customer_email:
                logger.error("Magic link or customer email is missing")
                return False

            customer = Customer.objects.filter(email__iexact=customer_email.strip()).select_related('business').first()
            if not customer and business is None:
                logger.error("Customer with email %s not found and no business context available", customer_email)
                return False

            business = business or getattr(customer, 'business', None)
            if not customer_name:
                if customer and hasattr(customer, 'full_name') and callable(customer.full_name):
                    customer_name = customer.full_name().strip() or customer.email
                else:
                    customer_name = customer_email

            subject = "Your SafariDesk login link"
            plain_text_content = f"""
Hi {customer_name},

Use the link below to sign in to the SafariDesk help center:

{link}

This link expires in {expires_minutes} minutes and can only be used once.

If you did not request this link, you can safely ignore this email.

Best regards,
{getattr(business, 'name', 'SafariDesk')} Support Team
"""

            html_content = render_to_string('email/base.html', {
                **self.get_email_brand_context(business),
                'eyebrow': 'Help center access',
                'headline': 'Your login link is ready',
                'preheader': f"Use this secure link to sign in. It expires in {expires_minutes} minutes.",
                'body_html': (
                    f"<p>Hi {escape(customer_name)},</p>"
                    "<p>Use the secure link below to sign in to the help center.</p>"
                    f"<p class=\"text-muted\">This link expires in {expires_minutes} minutes and can only be used once.</p>"
                    "<p class=\"text-muted\">If you did not request this link, you can safely ignore this email.</p>"
                ),
                'cta_url': link,
                'cta_label': 'Sign in to help center',
                'signature_name': f"{getattr(business, 'name', 'SafariDesk')} Support Team",
            })

            try:
                connection, from_email = self.get_smtp_connection_for_business(business)
            except Exception as e:
                logger.error("Error getting SMTP config for magic link email: %s", e)
                return False

            return self.send_rendered_email(
                template_name="customer_magic_link",
                business=business,
                connection=connection,
                from_email=from_email,
                receiver_email=customer_email.strip(),
                subject=subject,
                plain_text_body=plain_text_content.strip(),
                html_body=html_content,
            )

        except Exception as e:
            logger.error("Failed to send magic link to %s: %s", customer_email, e)
            return False



