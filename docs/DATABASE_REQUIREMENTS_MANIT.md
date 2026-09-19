# Database Requirements — MANIT Bhopal Hostel Data

This document extends the core schema in `ARCHITECTURE.md` with real,
institute-specific reference data for **MANIT Bhopal** (Maulana Azad
National Institute of Technology), so the `hostels`, `rooms`, `gates` and
`messes` tables can be seeded with actual campus structure instead of
generic placeholders.

> **Disclaimer on accuracy:** Hostel names below are MANIT's official
> Bhawan names (published on manit.ac.in and corroborated by student/alumni
> sources). Per-floor and per-room counts are **not publicly published**
> anywhere online, so the floor/room numbers in this document are a
> **worked example following the numbering convention the user specified**,
> not verified real capacity data. Before going live, the hostel office
> (Chairman, Council of Wardens) should supply the real floor/room counts
> and this seed data should be corrected to match — the schema is built so
> that correction is just an UPDATE to the `hostels`/`rooms` tables, no
> structural change needed.

---

## 1. Hostel Master Data

MANIT Bhopal has 12 residence hostels. Hostel No. 7 and Hostel No. 12 are
girls' hostels; all others are boys' hostels (Hostel No. 11 primarily
houses PhD/research scholars in single-seater rooms).

| hostel_id | Code | Official Name | Gender | Notes |
|---|---|---|---|---|
| 1 | H1 | Homi Jehangir Bhabha Bhawan | Boys | |
| 2 | H2 | Vikram Sarabhai Bhawan | Boys | |
| 3 | H3 | Hostel No. 3 | Boys | No separate scientist-name publicly listed for this Bhawan |
| 4 | H4 | Hostel No. 4 | Boys | No separate scientist-name publicly listed for this Bhawan |
| 5 | H5 | Mokshagundam Visvesvarayya Bhawan | Boys | |
| 6 | H6 | Jagadish Chandra Bose Bhawan | Boys | |
| 7 | H7 | Kalpana Chawla Bhawan | **Girls** | |
| 8 | H8 | Ramanujan Bhawan | Boys | Built in two phases: Block A (2013), Block B (2014) |
| 9 | H9 | Raja Ramanna Bhawan | Boys | |
| 10 | H10 | Dr. APJ Abdul Kalam Bhawan | Boys | First-year (fresher) hostel; organized into 4 blocks A–D (see §4) |
| 11 | H11 | Appu Bhavan | Boys | Primarily single-seater rooms for PhD/research scholars |
| 12 | H12 | Bhagini Nivedita Bhawan | **Girls** | Newest hostel on campus |

**Schema addition to `hostels` table** (extends the base spec):

```
hostels
  id            INT PK
  code          VARCHAR(10) UNIQUE   -- e.g. "H5"
  name          VARCHAR(120)         -- e.g. "Mokshagundam Visvesvarayya Bhawan"
  gender        ENUM('BOYS','GIRLS')
  has_blocks    BOOLEAN DEFAULT FALSE  -- true only for H10 currently
  location      VARCHAR(120)
  capacity      INT                    -- sum of room capacities, kept in sync
```

`gender` must be enforced at the application layer when assigning a
student to a hostel/room: `student.gender` (or the value on the `users`
record) must match `hostels.gender` for the target hostel. Add a check in
the admin "assign room" flow, and optionally a DB trigger for defense in
depth.

---

## 2. Room Numbering Convention

The convention specified for this project is a **5-digit room code**:

```
[HH][F][RR]
 |   |  |
 |   |  +-- 2-digit room sequence on that floor: 01-99
 |   +----- 1-digit floor number: 0 = Ground, 1 = First, 2 = Second, ...
 +--------- 2-digit hostel number (zero-padded): 01-12
```

Examples for **Hostel 1** (as given):

| Floor | Room range |
|---|---|
| Ground (0) | 01001 – 01099 |
| First (1) | 01101 – 01199 |
| Second (2) | 01201 – 01299 |

The same pattern applies to every hostel by substituting its 2-digit
hostel number, e.g. Hostel 5, first floor → `05101`–`05199`; Hostel 12,
ground floor → `12001`–`12099`.

**Schema addition to `rooms` table:**

```
rooms
  id            INT PK
  hostel_id     INT FK -> hostels.id
  block         VARCHAR(2) NULL       -- only used when hostels.has_blocks = TRUE (e.g. "A")
  floor         SMALLINT              -- 0 = Ground, 1 = First, ...
  room_number   CHAR(5) UNIQUE        -- the [HH][F][RR] code, e.g. "01001"
  capacity      SMALLINT              -- seats in the room (2 or 3 typically)
  status        ENUM('ACTIVE','MAINTENANCE','CLOSED') DEFAULT 'ACTIVE'
```

`room_number` is generated as `LPAD(hostel_no,2,'0') || floor || LPAD(seq,2,'0')`
at seed/insert time; keep it as a stored, unique, indexed column rather
than computing it on every read.

---

## 3. Example Floor / Room Plan (worked example — verify against real data)

The counts below are an illustrative example only (see disclaimer above).
They assume each single-block hostel is Ground + 3 floors, ~24 rooms per
floor, double-occupancy (capacity 2), except the two girls' hostels and
Hostel 11 which are given different example counts to reflect the user's
requirement that "every hostel has different numbers of rooms."

| hostel_id | Code | Floors (assumed) | Rooms/floor (assumed) | Total rooms | Capacity/room | Approx. total beds |
|---|---|---|---|---|---|---|
| 1 | H1 | G,1,2,3 (4) | 24 | 96 | 2 | 192 |
| 2 | H2 | G,1,2,3 (4) | 22 | 88 | 2 | 176 |
| 3 | H3 | G,1,2 (3) | 20 | 60 | 2 | 120 |
| 4 | H4 | G,1,2 (3) | 20 | 60 | 2 | 120 |
| 5 | H5 | G,1,2,3 (4) | 20 | 80 | 1 | 80 |
| 6 | H6 | G,1,2,3 (4) | 20 | 80 | 1 | 80 |
| 7 | H7 | G,1,2,3 (4) | 18 | 72 | 2 | 144 |
| 8 | H8 | G,1,2,3,4 (5) | 26 | 130 | 2 | 260 |
| 9 | H9 | G,1,2,3 (4) | 22 | 88 | 2 | 176 |
| 10 | H10 | see block table §4 | — | 512 | 2 | 1024 |
| 11 | H11 | G,1,2 (3) | 16 | 48 | 1 | 48 |
| 12 | H12 | G,1,2,3,4 (5) | 20 | 100 | 2 | 200 |

Replace this table with actual per-hostel figures from the hostel office
before production seeding — the numbers above only exist to demonstrate
that the schema and numbering scheme support differing room/floor counts
per hostel.

---

## 4. Special Case — Hostel 10 (Block Structure)

Hostel 10 (Dr. APJ Abdul Kalam Bhawan) is documented as organized into
**4 blocks (A–D)**, each with **4 floors** and **32 rooms per floor**
(double-occupancy), unlike the other hostels which are single buildings.
For this hostel only, use the `block` column and extend the room code
with the block letter so codes stay unique and sortable:

```
Room code format for H10: [HH][BLOCK][F][RR]   e.g. "10A001", "10B203"
```

| Block | Floors | Rooms/floor | Total rooms |
|---|---|---|---|
| A | 0-3 | 32 | 128 |
| B | 0-3 | 32 | 128 |
| C | 0-3 | 32 | 128 |
| D | 0-3 | 32 | 128 |

`hostels.has_blocks = TRUE` for hostel_id = 10 only; the seed script
should branch on this flag when generating `rooms` rows.

---

## 5. Gates and Messes per Hostel

Each hostel gets one primary entry/exit gate and, where the hostel has
its own dining hall, one mess. Device IDs follow the pattern
`H<hostel_no>_GATE_1` and `H<hostel_no>_MESS` to match the QR
purpose/location binding described in `ARCHITECTURE.md` §10–11.

| hostel_id | Gate device_id | Mess device_id | Notes |
|---|---|---|---|
| 1 | H1_GATE_1 | H1_MESS | |
| 2 | H2_GATE_1 | H2_MESS | |
| 3 | H3_GATE_1 | H3_MESS | |
| 4 | H4_GATE_1 | H4_MESS | |
| 5 | H5_GATE_1 | H5_MESS | |
| 6 | H6_GATE_1 | H6_MESS | |
| 7 | H7_GATE_1 | H7_MESS | Girls hostel — gate access logs should respect institute privacy rules for girls' hostel entry data |
| 8 | H8_GATE_1, H8_GATE_2 | H8_MESS | Two gates — Block A and Block B have separate access points |
| 9 | H9_GATE_1 | H9_MESS | |
| 10 | H10_GATE_A, H10_GATE_B, H10_GATE_C, H10_GATE_D | H10_MESS | One gate per block |
| 11 | H11_GATE_1 | H11_MESS | |
| 12 | H12_GATE_1 | H12_MESS | Girls hostel — same privacy note as H7 |

Confirm actual gate counts on-site during Phase 1 (project scaffold) —
some hostels may have a second/back gate not reflected here.

---

## 6. Example Seed Data (Hostel 1, illustrative)

```json
{
  "hostel": {
    "id": 1, "code": "H1", "name": "Homi Jehangir Bhabha Bhawan",
    "gender": "BOYS", "has_blocks": false, "location": "MANIT Campus, Bhopal"
  },
  "rooms_sample": [
    { "room_number": "01001", "floor": 0, "capacity": 2, "status": "ACTIVE" },
    { "room_number": "01002", "floor": 0, "capacity": 2, "status": "ACTIVE" },
    { "room_number": "01024", "floor": 0, "capacity": 2, "status": "ACTIVE" },
    { "room_number": "01101", "floor": 1, "capacity": 2, "status": "ACTIVE" },
    { "room_number": "01124", "floor": 1, "capacity": 2, "status": "ACTIVE" }
  ],
  "gate": { "device_id": "H1_GATE_1", "type": "GATE_DISPLAY" },
  "mess": { "device_id": "H1_MESS", "type": "MESS_DISPLAY" }
}
```

Generate the full 96-row `rooms` set (or the corrected real count) for
each hostel with a small seed script rather than hand-writing every row —
loop hostel_id 1–12, floor 0..N, room seq 01..M, applying the block
exception for hostel_id = 10.

---

## 7. Validation Rules to Enforce in the Application Layer

- A student can only be assigned to a room whose `hostels.gender` matches
  the student's recorded gender.
- `room_number` uniqueness is global (not just per hostel), since the
  hostel number is embedded in the code itself — a duplicate would
  indicate a seeding bug.
- A room's current occupant count (from `students.room_id` foreign key)
  must never exceed `rooms.capacity`; enforce with an application check
  before assignment, and optionally a DB trigger for defense in depth.
- Girls' hostels (H7, H12) should have their live occupancy/entry data
  visible only to Wardens and Admins assigned to those hostels, not to
  all wardens system-wide — add a `warden_hostel_assignments` join table
  if RBAC needs to be scoped per hostel rather than global per role.

---

## 8. Sources

- MANIT Bhopal official hostels page (manit.ac.in/content/hostels) — hostel
  names for H1, H2, H5, H6, H7, H8, H9, H12.
- MANIT Bhopal official hostel page for Hostel 10 (Dr. APJ Abdul Kalam
  Bhawan) and multiple alumni sources confirming its 4-block (A–D)
  structure with 32 rooms per floor.
- Alumni/forum sources confirming Hostel 11 is named Appu Bhavan and
  houses PhD/research scholars.
- Wikipedia entry for Maulana Azad National Institute of Technology —
  confirms 12 hostels, with No. 7 and No. 12 as the two girls' hostels.

None of these sources publish exact per-floor or per-room counts, which
is why §3's numbers are marked as a worked example rather than verified
data.
