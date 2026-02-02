# YAML Import Examples

This directory contains example YAML files for importing Launches, Missions, and Trips into Quartermaster.

## Usage

### Single-entity import

1. Navigate to the appropriate admin page (Launches, Missions, or Trips)
2. Click the "Import from YAML" button
3. Select or drag-and-drop your YAML file (single entity per file)
4. The system validates the file and creates the entity

### Multi-entity import

Use `POST /api/v1/import/yaml` with a YAML file whose root contains one or more of: `launches` (list), `missions` (list), `trips` (list). Creation order: launches, then missions, then trips. Within the same file, missions can reference launches by 0-based index (`launch_ref: 0`) instead of UUID; trips can reference missions by index (`mission_ref: 0`). See `import-multi.yaml` for an example.

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
| `refund_cutoff_hours` | integer | No | `12` | Hours before launch when refunds close (0-72) |

### Trip

Trips are specific departures within a Mission. Customers book seats on Trips. Check-in and boarding times are computed from departure time and minute offsets.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mission_id` | UUID | Yes (single) | - | Reference to an existing Mission (or use `mission_ref` in multi-doc) |
| `type` | string | Yes | - | `launch_viewing` or `pre_launch` |
| `departure_time` | datetime | Yes | - | When the trip departs (ISO 8601). Check-in and boarding are derived from this and the offset fields. |
| `boarding_minutes_before_departure` | integer | No | 30 (launch_viewing), 15 (pre_launch) | Minutes before departure when boarding starts |
| `checkin_minutes_before_boarding` | integer | No | 30 (launch_viewing), 15 (pre_launch) | Minutes before boarding when check-in opens |
| `name` | string | No | - | Optional label for the trip |
| `booking_mode` | string | No | `private` | Who can book: `private`, `early_bird`, or `public` |
| `sales_open_at` | datetime | No | - | When ticket sales open for this trip (ISO 8601). Trip is not bookable until this instant. |
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

## Multi-entity format

| Top-level key | Type | Description |
|---------------|------|-------------|
| `launches` | list | Launch objects (same schema as single launch YAML) |
| `missions` | list | Mission objects; use `launch_id` (UUID) or `launch_ref` (0-based index into `launches` in this file) |
| `trips` | list | Trip objects; use `mission_id` (UUID) or `mission_ref` (0-based index into `missions` in this file) |

At least one of the three keys must be present. Order of creation is always launches, then missions, then trips, so `launch_ref` and `mission_ref` refer to entities defined in the same file.
