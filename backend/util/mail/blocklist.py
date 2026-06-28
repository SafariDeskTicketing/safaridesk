"""
Email blocklist helper - checks sender emails against patterns from text file.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Pattern

logger = logging.getLogger(__name__)

# Path to blocklist file relative to project root
BLOCKLIST_FILE = Path(__file__).parent.parent.parent / "config" / "email_blocklist.txt"

# Cached compiled patterns
_compiled_patterns: List[Pattern] = []
_patterns_loaded = False


def _load_patterns() -> List[Pattern]:
    """Load and compile regex patterns from blocklist file."""
    global _compiled_patterns, _patterns_loaded
    
    if _patterns_loaded:
        return _compiled_patterns
    
    patterns = []
    
    if not BLOCKLIST_FILE.exists():
        logger.warning("email_blocklist_file_not_found", extra={"path": str(BLOCKLIST_FILE)})
        _patterns_loaded = True
        return patterns
    
    try:
        with open(BLOCKLIST_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if not line or line.startswith("#"):
                    continue
                try:
                    pattern = re.compile(line, re.IGNORECASE)
                    patterns.append(pattern)
                except re.error as e:
                    logger.warning(
                        "email_blocklist_invalid_pattern",
                        extra={"pattern": line, "error": str(e)},
                    )
        
        logger.info("email_blocklist_loaded", extra={"pattern_count": len(patterns)})
        _compiled_patterns = patterns
        _patterns_loaded = True
        
    except Exception as e:
        logger.error("email_blocklist_load_failed", extra={"error": str(e)})
    
    return _compiled_patterns


def is_email_blocked(email: str) -> bool:
    """
    Check if an email address matches any blocklist pattern.
    
    Args:
        email: The sender email address to check
    
    Returns:
        True if the email should be blocked, False otherwise
    """
    if not email:
        return False
    
    email = email.lower().strip()
    patterns = _load_patterns()
    
    for pattern in patterns:
        if pattern.search(email):
            logger.info(
                "email_blocked",
                extra={"email": email, "pattern": pattern.pattern},
            )
            return True
    
    return False


def reload_patterns() -> int:
    """
    Force reload patterns from file.
    Call this if you update the blocklist file while the server is running.
    
    Returns:
        Number of patterns loaded
    """
    global _patterns_loaded
    _patterns_loaded = False
    patterns = _load_patterns()
    return len(patterns)
