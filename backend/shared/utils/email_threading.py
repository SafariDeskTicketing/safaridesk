"""
Email Threading & Validation Utilities

Provides improved email threading header management and validation
to ensure consistency and prevent silent failures.
"""
import logging
import re
from typing import Optional, Dict, Tuple
from django.utils import timezone

logger = logging.getLogger(__name__)


class EmailThreadingValidator:
    """Validates and manages email threading headers."""
    
    @staticmethod
    def validate_message_id(message_id: Optional[str]) -> bool:
        """
        Validate Message-ID format per RFC 5322.
        Valid format: <local-part@domain>
        """
        if not message_id:
            return False
        
        # Strip angle brackets if present
        msg_id = message_id.strip('<>')
        
        # Check format
        if '@' not in msg_id:
            return False
            
        # Basic RFC 5322 validation
        pattern = r'^[a-zA-Z0-9!#$%&\'*+\-/=?^_`{|}~.]+@[a-zA-Z0-9.-]+$'
        return bool(re.match(pattern, msg_id))
    
    @staticmethod
    def validate_in_reply_to(in_reply_to: Optional[str]) -> bool:
        """Validate In-Reply-To header (should be a valid Message-ID)."""
        return EmailThreadingValidator.validate_message_id(in_reply_to)
    
    @staticmethod
    def validate_references(references: Optional[str]) -> bool:
        """
        Validate References header (space-separated list of Message-IDs).
        """
        if not references:
            return False
        
        refs = references.split()
        return all(EmailThreadingValidator.validate_message_id(ref) for ref in refs)
    
    @staticmethod
    def validate_threading_headers(headers: Dict[str, str]) -> Tuple[bool, str]:
        """
        Validate complete threading header set.
        
        Returns:
            (is_valid, reason)
        """
        if not headers:
            return False, "No headers provided"
        
        message_id = headers.get('Message-ID', '')
        if not message_id:
            return False, "Missing Message-ID header"
        
        if not EmailThreadingValidator.validate_message_id(message_id):
            return False, f"Invalid Message-ID format: {message_id}"
        
        # Optional but important headers
        in_reply_to = headers.get('In-Reply-To')
        if in_reply_to and not EmailThreadingValidator.validate_in_reply_to(in_reply_to):
            return False, f"Invalid In-Reply-To format: {in_reply_to}"
        
        references = headers.get('References')
        if references and not EmailThreadingValidator.validate_references(references):
            return False, f"Invalid References format: {references}"
        
        return True, "Valid threading headers"


class EmailThreadingBuilder:
    """Builds proper email threading headers."""
    
    @staticmethod
    def build_message_id(domain: str, ticket_id: Optional[str] = None) -> str:
        """
        Build a unique Message-ID.
        
        Format: <timestamp.uuid@domain>
        """
        import uuid
        timestamp = int(timezone.now().timestamp() * 1000)
        unique_id = uuid.uuid4().hex[:12]
        
        if ticket_id:
            return f"<ticket{ticket_id}.{timestamp}.{unique_id}@{domain}>"
        else:
            return f"<{timestamp}.{unique_id}@{domain}>"
    
    @staticmethod
    def build_threading_headers(
        original_message_id: Optional[str] = None,
        previous_references: Optional[str] = None,
        domain: str = 'safaridesk.io',
        ticket_id: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Build complete threading headers for an email response.
        
        Args:
            original_message_id: The Message-ID of the original email
            previous_references: References header from original email
            domain: Email domain for Message-ID generation
            ticket_id: Optional ticket ID for Message-ID
        
        Returns:
            Dictionary of threading headers
        """
        headers = {}
        
        # Always generate new Message-ID
        new_message_id = EmailThreadingBuilder.build_message_id(domain, ticket_id)
        headers['Message-ID'] = new_message_id
        
        # Set In-Reply-To if we have original message ID
        if original_message_id:
            if EmailThreadingValidator.validate_message_id(original_message_id):
                headers['In-Reply-To'] = original_message_id
            else:
                logger.warning(f"Invalid original Message-ID, skipping In-Reply-To: {original_message_id}")
        
        # Build References chain
        references = []
        if previous_references:
            # Add previous references
            prev_refs = previous_references.split()
            # Limit to reasonable number (RFC suggests not more than ~25)
            references.extend(prev_refs[:20])
        
        if original_message_id and EmailThreadingValidator.validate_message_id(original_message_id):
            # Add original message ID if not already present
            if original_message_id not in references:
                references.append(original_message_id)
        
        if references:
            headers['References'] = ' '.join(references)
        
        return headers


def extract_threading_headers_from_email(email_message) -> Dict[str, str]:
    """
    Extract threading headers from an email message.
    
    Args:
        email_message: Email message object from email library
    
    Returns:
        Dictionary with Message-ID, In-Reply-To, and References
    """
    headers = {}
    
    for header_name in ['Message-ID', 'In-Reply-To', 'References']:
        value = email_message.get(header_name)
        if value:
            headers[header_name] = value
    
    return headers


def log_threading_issue(ticket_id: str, issue: str, headers: Optional[Dict] = None):
    """Log threading-related issues for debugging."""
    context = {
        'ticket_id': ticket_id,
        'issue': issue,
    }
    if headers:
        context['headers'] = {
            'message_id_present': 'Message-ID' in headers,
            'in_reply_to_present': 'In-Reply-To' in headers,
            'references_present': 'References' in headers,
        }
    
    logger.warning(
        f"Email threading issue: {issue}",
        extra=context
    )
