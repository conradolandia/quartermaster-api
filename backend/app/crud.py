"""
CRUD operations for the Quartermaster application.

This module provides database operations organized by domain.
For backward compatibility, all functions are re-exported from the crud package.
"""

# Import all CRUD functions to maintain backward compatibility
from .crud import *  # noqa: F403
