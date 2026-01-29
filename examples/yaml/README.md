# YAML Import Examples

This directory contains example YAML files for importing Launches, Missions, and Trips into Quartermaster.

## Usage

1. Navigate to the appropriate admin page (Launches, Missions, or Trips)
2. Click the "Import from YAML" button
3. Select or drag-and-drop your YAML file
4. The system validates the file and creates the entity

**Note:** All import endpoints require superuser authentication.

## Schema Reference

### Launch

Launches represent rocket launch events at a specific location.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Launch name (e.g., "SpaceX Falcon 9 - Starlink Group 6-1") |
| `launch_timestamp` | datetime | Yes | ISO 8601 format (e.g., "2024-03-15T14:30:00Z") |
| `summary` | string | Yes | Brief description of the launch |
| `location_id` | UUID | Yes | Reference to an existing Location |

### Mission

Missions are bookable events tied to a Launch. A single Launch can have multiple Missions (e.g., different viewing experiences).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | - | Mission name |
| `launch_id` | UUID | Yes | - | Reference to an existing Launch |
| `active` | boolean | No | `true` | Whether the mission is active |
| `booking_mode` | string | No | `private` | Who can book: `private`, `early_bird`, or `public` |
| `sales_open_at` | datetime | No | - | When ticket sales open (ISO 8601) |
| `refund_cutoff_hours` | integer | No | `12` | Hours before launch when refunds close (0-72) |

### Trip

Trips are specific departures within a Mission. Customers book seats on Trips.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mission_id` | UUID | Yes | - | Reference to an existing Mission |
| `type` | string | Yes | - | Trip type (max 50 chars, e.g., "boat", "bus") |
| `check_in_time` | datetime | Yes | - | When passengers should check in (ISO 8601) |
| `boarding_time` | datetime | Yes | - | When boarding begins (ISO 8601) |
| `departure_time` | datetime | Yes | - | When the trip departs (ISO 8601) |
| `active` | boolean | No | `true` | Whether the trip is active |

## Datetime Format

All datetime fields use ISO 8601 format with timezone:

```
YYYY-MM-DDTHH:MM:SSZ        # UTC
YYYY-MM-DDTHH:MM:SS+00:00   # With offset
YYYY-MM-DDTHH:MM:SS-05:00   # Eastern time
```

Examples:
- `"2024-03-15T14:30:00Z"` - March 15, 2024 at 2:30 PM UTC
- `"2024-12-01T09:00:00-05:00"` - December 1, 2024 at 9:00 AM EST

## UUID Format

UUID fields reference existing entities in the database. Use the admin interface to find the UUID of Locations, Launches, or Missions.

Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Example: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`

## File Requirements

- Extension: `.yaml` or `.yml`
- Max size: 5 MB
- Encoding: UTF-8

## Validation

The import validates:
- Required fields are present
- Field types match the schema
- UUIDs reference existing entities
- Datetime strings are valid ISO 8601 format

Validation errors return a descriptive message indicating what failed.
