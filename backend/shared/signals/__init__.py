"""
Initialize signal handlers for the application
"""
# Import signal handlers to register them
from .BusinessSignal import handle_business_creation
from . import notifications  # Import notification signal handlers
from . import ticketSignal  # Import ticket signal handlers
from . import DepartmentSignal  # Import department signal handlers

__all__ = ['handle_business_creation']
