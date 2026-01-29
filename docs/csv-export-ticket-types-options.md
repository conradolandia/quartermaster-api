# CSV export: handling trip-defined ticket types

## Problem

The CSV export shows duplicate-looking columns for what appears to be the same ticket type. For example, you see both:
- `adult Quantity`, `adult Price`, `adult Total`
- `adult_ticket Quantity`, `adult_ticket Price`, `adult_ticket Total`
- `child Quantity`, `child Price`, `child Total`
- `child_ticket Quantity`, `child_ticket Price`, `child_ticket Total`

**Why this happens:**

1. **Trips define their own ticket types.** Each trip's `TripPricing` records define arbitrary ticket type names (e.g. "VIP", "Standard", "Launch View", "adult_ticket", "child_ticket"). There is no fixed global set like adult/child.

2. **Legacy naming inconsistency.** Some booking items in the database have `item_type` stored as "adult", while others have "adult_ticket". This can happen because:
   - Different trips used different naming conventions
   - The system evolved over time (older bookings vs newer ones)
   - The booking creation code accepts both variants for backward compatibility (see `bookings.py` line 199-207)

3. **Current CSV export behavior.** The export collects all distinct `item_type` values from booking items and creates one set of columns (Quantity, Price, Total) per distinct value. So if both "adult" and "adult_ticket" exist in the data, you get both column sets.

**What we need to solve:**

How should the CSV export handle this? We want a solution that:
- Works with arbitrary trip-defined ticket type names (not just adult/child)
- Handles legacy data with inconsistent naming
- Produces a clean, usable CSV export
- Doesn't make incorrect assumptions about what ticket types mean

Below are options that do **not** assume adult/child are special categories.

---

## Option A: Require trip selection and derive columns from that trip (trip-required export)

**What:** The CSV export **requires** selecting a trip first (trip becomes mandatory). Ticket-type columns are not derived from booking items' `item_type`; they are taken from that trip's **TripPricing** records (the trip's canonical ticket types). So the CSV has exactly one set of columns per ticket type defined for the selected trip (e.g. VIP Quantity/Price/Total, Standard Quantity/Price/Total), in a stable order. When building each row, map booking items to those types (e.g. match `item_type` to `TripPricing.ticket_type`, including legacy variants like "adult" vs "adult_ticket" if the trip's type is "adult_ticket").

**Pros:**
- Columns are known in advance and match the trip's configuration; no duplicate or legacy-only columns.
- No global normalization rule; each export is tailored to one trip's ticket types.
- Reuses the same matching logic already used at booking creation (direct match or strip `_ticket`).

**Cons:**
- Export is always scoped to one trip (no "all trips" export with ticket-type columns, unless we add a separate mode).
- If a booking has items from multiple trips, only items for the selected trip would contribute to the ticket columns (or such bookings are excluded / only partially represented).

**Change:**
- API: Make `trip_id` required for the CSV export endpoint (or require it when ticket-type columns are requested). When `trip_id` is present, derive `sorted_ticket_types` from `TripPricing` for that trip instead of scanning booking items.
- When building each row, only consider booking items for that trip; aggregate by matching `item_type` to the trip's ticket types (e.g. `TripPricing.ticket_type` or normalized form for legacy).
- Frontend: Require trip selection before enabling export (or before enabling "include ticket types"); optionally preselect/hint ticket-type columns based on the selected trip.

---

## Option 1: Raw item_type, no normalization

**What:** One set of columns per distinct `item_type` in the exported data. No merging.

**Pros:** Accurate; reflects actual data; works for any trip-defined names.
**Cons:** You get both "adult" and "adult_ticket" (and similar pairs) as separate column sets when both exist in the DB.

**Change:** Remove `normalize_ticket_type()` in the CSV export and use `item.item_type` as-is for headers and aggregation.

---

## Option 2: Ticket types scoped by trip

**What:** Column headers include trip, e.g. `Trip: Mars 2024 - VIP Quantity`, `Trip: Mars 2024 - Standard Quantity`, `Trip: Moon 2025 - Launch View Quantity`. Each (trip_id, item_type) gets its own column set.

**Pros:** No global merge rule; "adult" on Trip A and "adult_ticket" on Trip B stay distinct; respects trip-defined categories.
**Cons:** More columns; need trip id/name in the export; if a booking spans multiple trips, one row has several trip blocks.

**Change:** Collect all (trip_id, item_type) pairs (or trip name + item_type), build headers/rows from that; add trip identifier to each row if not already present.

---

## Option 3: Single structured “ticket breakdown” column

**What:** One column e.g. "Ticket breakdown" with a structured string per booking, e.g. `VIP: 2, Standard: 1` or `VIP (2 @ 50.00), Standard (1 @ 30.00)`.

**Pros:** Works for any trip-defined types; no column explosion; no normalization.
**Cons:** Harder to filter/pivot by ticket type in Excel/Sheets.

**Change:** Add a single column built from aggregating items (e.g. by item_type or by trip + item_type) and drop the per-type Quantity/Price/Total columns (or offer both layouts via a parameter).

---

## Option 4: Long format (one row per booking item)

**What:** One CSV row per booking **item** (ticket line). Columns: confirmation_code, customer_name, …, trip_id/trip_name, ticket_type (item_type), quantity, price, total.

**Pros:** Any number of trip-defined types; easy to pivot and filter by type in a spreadsheet.
**Cons:** One booking spans multiple rows; you must re-aggregate in the sheet if you want one row per booking.

**Change:** Iterate over items, output one row per item with booking + trip + item_type + qty/price/total.

---

## Option 5: Configurable display-name / merge mapping

**What:** Admin-defined mapping for CSV only, e.g. `adult_ticket -> adult`, `child_ticket -> child`, or custom labels. Used only when building CSV headers and when grouping for aggregation.

**Pros:** Flexible; you control legacy merges and labels without hardcoding adult/child.
**Cons:** Extra configuration (e.g. in DB or env); someone must maintain the mapping.

**Change:** Add a small config (e.g. key-value: raw item_type -> display/merge key), and in the export use the display key for headers and aggregation; unmapped types stay as-is.

---

## Option 6: Normalize at write time (single source of truth)

**What:** When creating/updating a booking, set `BookingItem.item_type` from the trip’s canonical value (e.g. `TripPricing.ticket_type` for that trip). Optionally backfill existing rows with a migration so all items use the trip’s current ticket_type.

**Pros:** DB has one string per logical type per trip; CSV export can use raw item_type with no export-time rules.
**Cons:** Requires migration and consistent write path (API always uses trip’s ticket_type when creating items).

**Change:** In booking creation, set `item_type` from the matched TripPricing row; add a migration to backfill existing BookingItems from their trip’s TripPricing.

---

## Option 7: Keep “_ticket” strip as legacy alias only

**What:** Keep current behavior: only strip the `_ticket` suffix for CSV (and maybe display). Trip-defined names that don’t end with `_ticket` (VIP, Standard, etc.) are unchanged.

**Pros:** Minimal change; cleans up the common adult/adult_ticket, child/child_ticket duplication.
**Cons:** Still special-cases one naming pattern; if a trip literally defines a type "something_ticket", it is merged with "something".

---

## Recommendation (short)

- **Trip-specific export, clean columns:** Option A (require trip selection; derive columns from that trip's TripPricing). Best fit when exports are usually per trip and you want columns that match the trip's configuration.
- **Minimal change, fewer columns:** Option 7 (keep _ticket strip, document as legacy alias).
- **No hardcoded naming:** Option 1 (raw) or Option 2 (trip-scoped) so only trip-defined names appear; Option 2 avoids cross-trip collisions.
- **Best for arbitrary trip types and analysis:** Option 4 (long format) or Option 3 (single breakdown column).
- **Clean data long-term:** Option 6 (normalize at write time) so export can stay simple (Option 1).
