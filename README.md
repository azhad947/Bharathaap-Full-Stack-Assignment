# Nimba Stay

A front-desk booking screen for Nimba Nature Cure. Staff can check which rooms are free, pick dates, and book a guest — without ever double-booking a night.

## Stack

Next.js (App Router) + TypeScript, SQLite via `better-sqlite3`, Vitest for tests.

## Running it

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # runs the test suite
```

The database is created automatically at `data/nimba.db` on first run and seeded with 9 rooms across three categories. Room 104 is in maintenance. Delete `data/` to reset everything.

## What it does

- **Search** — pick check-in, check-out and an optional category, see all free rooms with per-night and total price
- **Book** — enter guest name and phone, confirm. Rejects bad dates, non-10-digit phones, clashing bookings (409) and maintenance rooms
- **Cancel** — any confirmed booking can be cancelled from the bookings list; cancelled bookings free the room immediately
- **14-day timeline** — a visual grid showing every room across the next two weeks so staff can see occupancy at a glance

## How double-booking is prevented

One SQL clause handles everything:

```sql
existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
```

Strict inequalities mean a guest leaving on the 20th never blocks one arriving on the 20th. The same clause is used for both the availability search and the booking insert, so they can never disagree. The insert runs inside a `BEGIN IMMEDIATE` transaction so two simultaneous requests for the same room are serialised — only one gets through.

## What I added beyond the brief

**Cancel + bookings list** — the brief mentions a `cancelled` status but gives no way to create one. Front-desk staff need to undo mistakes, so I added `GET /api/bookings` and `POST /api/bookings/:id/cancel`.

**14-day room timeline** — a visual grid showing all rooms and their bookings for the next two weeks. Makes the no-double-booking guarantee visible rather than just enforced.

**Past date rejection** — check-in dates in the past are rejected with a 400.

**Flexible phone input** — `+91` prefix and spaces/dashes are stripped before validation, so `+91 98765 43210` is accepted and stored as `9876543210`.

## What's not done

- No authentication — assumes a trusted internal network
- No admin screen to change room prices or status (seeded in code)

## Tools used

Amazon q  - To write readme and beautify the UI part and for some suggested optimization
