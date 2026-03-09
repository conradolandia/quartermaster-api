import enum


# --- Booking Mode Enum ---
class BookingMode(str, enum.Enum):
    private = "private"  # Admin only, no public access
    early_bird = "early_bird"  # Requires access code
    public = "public"  # Open to everyone


# --- BookingItem models ---
class BookingItemStatus(str, enum.Enum):
    active = "active"
    refunded = "refunded"
    fulfilled = "fulfilled"


# --- Booking models ---
class PaymentStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    paid = "paid"
    free = "free"
    failed = "failed"
    refunded = "refunded"
    partially_refunded = "partially_refunded"


class BookingStatus(str, enum.Enum):
    """Booking lifecycle: draft, confirmed, checked_in, completed, cancelled."""

    draft = "draft"
    confirmed = "confirmed"
    checked_in = "checked_in"
    completed = "completed"
    cancelled = "cancelled"


# Discount Code Models
class DiscountCodeType(str, enum.Enum):
    percentage = "percentage"
    fixed_amount = "fixed_amount"
