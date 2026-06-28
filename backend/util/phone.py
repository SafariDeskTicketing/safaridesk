"""
Phone number validation and formatting utilities.
Handles international phone number formatting for SMS notifications.
"""
import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


# Common country codes with their expected phone number lengths (without country code)
COUNTRY_CODES = {
    '1': {'name': 'US/Canada', 'min_length': 10, 'max_length': 10},       # +1
    '44': {'name': 'UK', 'min_length': 10, 'max_length': 10},             # +44
    '254': {'name': 'Kenya', 'min_length': 9, 'max_length': 9},           # +254
    '255': {'name': 'Tanzania', 'min_length': 9, 'max_length': 9},        # +255
    '256': {'name': 'Uganda', 'min_length': 9, 'max_length': 9},          # +256
    '27': {'name': 'South Africa', 'min_length': 9, 'max_length': 9},     # +27
    '234': {'name': 'Nigeria', 'min_length': 10, 'max_length': 10},       # +234
    '233': {'name': 'Ghana', 'min_length': 9, 'max_length': 9},           # +233
    '91': {'name': 'India', 'min_length': 10, 'max_length': 10},          # +91
    '971': {'name': 'UAE', 'min_length': 9, 'max_length': 9},             # +971
    '966': {'name': 'Saudi Arabia', 'min_length': 9, 'max_length': 9},    # +966
}

# Default country code for numbers without one (Kenya)
DEFAULT_COUNTRY_CODE = '254'


def clean_phone_number(phone: str) -> str:
    """
    Remove all non-digit characters except leading +.
    
    Args:
        phone: Raw phone number string
        
    Returns:
        Cleaned phone number with only digits and optional leading +
    """
    if not phone:
        return ''
    
    phone = str(phone).strip()
    
    # Preserve leading + if present
    if phone.startswith('+'):
        return '+' + re.sub(r'[^\d]', '', phone[1:])
    else:
        return re.sub(r'[^\d]', '', phone)


def validate_phone(phone: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a phone number format.
    
    Args:
        phone: Phone number string
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not phone:
        return False, "Phone number is required"
    
    cleaned = clean_phone_number(phone)
    
    if not cleaned:
        return False, "Phone number contains no valid digits"
    
    # Remove leading + for length check
    digits_only = cleaned.lstrip('+')
    
    # Check minimum length (at least 7 digits for any valid number)
    if len(digits_only) < 7:
        return False, "Phone number is too short"
    
    # Check maximum length (ITU-T E.164 max is 15 digits)
    if len(digits_only) > 15:
        return False, "Phone number is too long"
    
    # Check for obviously invalid patterns
    if re.match(r'^0+$', digits_only):
        return False, "Invalid phone number format"
    
    return True, None


def format_phone_international(phone: str, default_country_code: str = DEFAULT_COUNTRY_CODE) -> Optional[str]:
    """
    Format a phone number to E.164 international format.
    
    Args:
        phone: Phone number string (can be local or international format)
        default_country_code: Country code to use if number doesn't have one
        
    Returns:
        Phone number in E.164 format (+XXXXXXXXXXX) or None if invalid
    """
    if not phone:
        return None
    
    cleaned = clean_phone_number(phone)
    
    if not cleaned:
        return None
    
    # If already in international format with +
    if cleaned.startswith('+'):
        digits = cleaned[1:]
        # Basic validation - should have enough digits
        if len(digits) >= 7 and len(digits) <= 15:
            return cleaned
        return None
    
    # Remove leading zeros (common in local formats)
    digits = cleaned.lstrip('0')
    
    if not digits:
        return None
    
    # Check if it already starts with a known country code
    for code in sorted(COUNTRY_CODES.keys(), key=len, reverse=True):
        if digits.startswith(code):
            # Number already has country code
            if len(digits) >= 7 and len(digits) <= 15:
                return f'+{digits}'
            return None
    
    # Add default country code
    result = f'+{default_country_code}{digits}'
    
    # Final validation
    if len(result) >= 8 and len(result) <= 16:  # +7 to +15 digits
        return result
    
    return None


def is_valid_international_phone(phone: str) -> bool:
    """
    Check if a phone number is valid for international SMS.
    
    Args:
        phone: Phone number string
        
    Returns:
        True if valid for international SMS, False otherwise
    """
    is_valid, _ = validate_phone(phone)
    if not is_valid:
        return False
    
    formatted = format_phone_international(phone)
    return formatted is not None


def get_phone_country_code(phone: str) -> Optional[str]:
    """
    Extract the country code from an international phone number.
    
    Args:
        phone: Phone number in international format
        
    Returns:
        Country code (without +) or None
    """
    if not phone:
        return None
    
    cleaned = clean_phone_number(phone)
    
    if not cleaned.startswith('+'):
        return None
    
    digits = cleaned[1:]
    
    # Check longest codes first
    for code in sorted(COUNTRY_CODES.keys(), key=len, reverse=True):
        if digits.startswith(code):
            return code
    
    # Return first 1-3 digits as best guess
    if len(digits) >= 1:
        return digits[:3] if len(digits) >= 10 else digits[:2] if len(digits) >= 9 else digits[:1]
    
    return None


def format_phone_for_display(phone: str) -> str:
    """
    Format a phone number for human-readable display.
    
    Args:
        phone: Phone number string
        
    Returns:
        Formatted phone number for display
    """
    formatted = format_phone_international(phone)
    if not formatted:
        return phone or ''
    
    # Example: +254712345678 -> +254 712 345 678
    digits = formatted[1:]
    country_code = get_phone_country_code(formatted)
    
    if country_code:
        local_number = digits[len(country_code):]
        # Format in groups of 3
        groups = [local_number[i:i+3] for i in range(0, len(local_number), 3)]
        return f'+{country_code} {" ".join(groups)}'
    
    return formatted


def get_agents_with_valid_phones(agents) -> list:
    """
    Filter agents to only those with valid phone numbers.
    
    Args:
        agents: QuerySet or list of agent/user objects with phone_number attribute
        
    Returns:
        List of tuples: (agent, formatted_phone)
    """
    valid_agents = []
    
    for agent in agents:
        phone = getattr(agent, 'phone_number', None)
        if not phone:
            logger.debug(f"Agent {getattr(agent, 'email', 'unknown')} has no phone number")
            continue
        
        formatted = format_phone_international(phone)
        if formatted:
            valid_agents.append((agent, formatted))
        else:
            logger.warning(f"Agent {getattr(agent, 'email', 'unknown')} has invalid phone: {phone}")
    
    return valid_agents
