# Dates and times: location, launches, missions, trips

## Rule

**All event dates and times are in the timezone of the location.**

- A **launch** happens at a place (location). Its `launch_timestamp` is that moment in the **location’s timezone**.
- A **mission** belongs to a launch, so it uses the same location timezone (e.g. `sales_open_at`).
- A **trip** belongs to a mission → launch → location, so its `check_in_time`, `boarding_time`, `departure_time` are in that **location’s timezone**.

Example: “Launch on Dec 31, 2027 at 23:00 at Kennedy Space Center (Florida)” means **23:00 in America/New_York** on that date. The system stores one instant in time; the location’s timezone defines how that instant is written and read for that event.

---

## Storage and API

- **Database**: Event datetimes are stored as **UTC** (PostgreSQL `TIMESTAMP WITH TIME ZONE`). One instant worldwide.
- **Location**: Each location has a `timezone` (IANA, e.g. `America/New_York`). Default is `UTC`.
- **API**: Datetimes are sent as **ISO 8601 with UTC** (e.g. `2028-01-01T04:00:00+00:00`). Launch/Mission/Trip responses also include a `timezone` field (the location’s IANA zone) so clients can show “location time”.

So:
- **Store**: UTC instant.
- **Meaning**: “This event at this location at this *local* date/time” → that local time is in `location.timezone`.
- **Read/Write**: Clients can show and collect times in the location’s timezone using the returned `timezone` and convert to/from UTC for the API.

---

## Examples

**Location**: Kennedy Space Center, Florida → `timezone = "America/New_York"`.

**Event**: Launch on Dec 31, 2027 at 23:00 Eastern (America/New_York).

- That instant in UTC is: 2028-01-01 04:00 UTC (EST = UTC−5).
- **Stored in DB**: `2028-01-01 04:00:00+00` (UTC).
- **API returns**: e.g. `launch_timestamp: "2028-01-01T04:00:00+00:00"`, `timezone: "America/New_York"`.

**How people see it**

1. **Admin in Florida (America/New_York)**
   - Reads: “Dec 31, 2027, 11:00 PM” (location time = their time).
   - Writes: enters “Dec 31, 2027 23:00”; app sends the corresponding UTC instant.

2. **Admin in Berlin (Europe/Berlin)**
   - Reads: “Jan 1, 2028, 5:00 AM” (if UI shows in their local time) or “Dec 31, 2027, 11:00 PM” (if UI shows in location time).
   - Writes: should enter the time **in the location’s timezone** (23:00 Eastern), not Berlin time. The UI can use `timezone` to show “Enter time in America/New_York” and format in that zone.

3. **Customer in Tokyo (Asia/Tokyo)**
   - Reads: “Jan 1, 2028, 1:00 PM” (if shown in their time) or “Dec 31, 2027, 11:00 PM Eastern” (if shown in location time).
   - Same instant; only the displayed timezone changes.

**Another example: same UTC instant, two locations**

- **Florida (America/New_York)**: Dec 31, 2027, 23:00.
- **UTC**: Jan 1, 2028, 04:00.
- **Tokyo (Asia/Tokyo)**: Jan 1, 2028, 13:00.

All refer to the same moment. For a **launch at Kennedy**, we always *describe* it as “Dec 31, 2027, 23:00” in America/New_York; for a launch at a Tokyo location we’d use that location’s timezone instead.

---

## Summary

| Layer        | What happens |
|-------------|----------------|
| **Location** | Has `timezone` (IANA). Events at that location are *expressed* in this zone. |
| **Storage**  | All datetimes stored in UTC (`TIMESTAMP WITH TIME ZONE`). |
| **API**      | Sends UTC ISO; responses include `timezone` for the event’s location. |
| **Display**  | Should show (and, for admins, collect) times in the **location’s timezone** so “Dec 31, 2027 23:00” at Florida is always 23:00 Eastern, regardless of viewer’s place. |

So: one instant in UTC; the location’s timezone defines how that instant is read and written for launches, missions, and trips at that location.
