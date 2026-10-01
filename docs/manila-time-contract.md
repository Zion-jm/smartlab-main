# SmartLab Manila date and time contract

All laboratory dates and clock times mean Asia/Manila (UTC+08:00, no daylight saving time), regardless of the computer, browser, or hosting server's time zone.

## Three different values

1. Calendar date: YYYY-MM-DD, such as 2026-09-30. This identifies a booking day, not a clock instant.
2. Manila wall-clock time: HH:mm, such as 07:30. Combine it with the selected calendar date and +08:00 before sending it to the API.
3. Instant: an ISO timestamp with Z or an explicit offset, used for actual start/end times and audit timestamps. Store and transport the instant; display it in Manila time.

Example: 30 September 2026 at 07:30 Manila is 2026-09-29T23:30:00.000Z. The UTC date being the previous day is correct. Extracting the booking date by blindly slicing this timestamp is incorrect.

## Calendar storage and day filters

The existing schema uses DateTime columns for dateNeeded and scheduleDate. New date-only input is interpreted as Manila midnight. Existing UTC-midnight and Manila-midnight records are both read as the appropriate Manila calendar day. No historical rows are rewritten in this fix.

Query each business day with start inclusive and next midnight exclusive: gte start, lt end. For 2026-09-30 this is [2026-09-29T16:00:00.000Z, 2026-09-30T16:00:00.000Z). Do not use the server's local setHours or a 23:59:59.999 upper bound. Audit to=YYYY-MM-DD includes that whole Manila day; an explicit timestamp upper bound is exclusive.

Backend helpers live in backend/src/utils/manilaTime.ts. They handle parsing, date keys, day boundaries, weekday indexes, and formatting. Existing approval, scheduling, and time-block helpers delegate to them. Date-only values are validated against the real calendar. For compatibility, an ISO datetime with no offset is explicitly treated as Manila wall time; clients should send an explicit offset or Z.

## Frontend and date pickers

Frontend helpers live in frontend/src/utils/dateTime.ts. combineManilaDateTime is used by the student/faculty booking forms, the admin schedule modal, and the conflict preview. Editing an existing booking extracts Manila date/time fields before showing the form.

Calendar grids and React date pickers use a local Date only as a date-only UI adapter. Convert date keys with dateKeyToPickerDate, and serialize their displayed fields with pickerDateToDateKey. Never call toISOString on a picker Date to obtain the selected calendar day. Local getters on these adapters are intentional; they are not used to interpret stored event timestamps.

Today, date restrictions, presets, schedule charts, report date grouping, email dates/times, audit displays, and refresh timestamps use Manila business dates/times. Relative elapsed-time labels can remain timezone independent.

## Weekdays and limits

Weekday indexes are 0=Sunday through 6=Saturday. The Prisma schema comment now matches the existing enum-free integer convention. No database schema migration is required.

Same-day booking rules remain in effect; this fix does not introduce overnight or multi-day reservations. If an old browser previously saved the wrong instant, its intended wall time cannot be inferred safely. This fix prevents new host-timezone shifts; historical booking corrections require record review.

## Verification

Build both applications. The focused tests are backend/tests/manilaTime.test.js and backend/tests/manilaApi.test.js.

The first executes actual frontend date utilities and backend helpers in separate Node processes configured for UTC, Asia/Manila, America/Los_Angeles, and Asia/Tokyo. It checks midnight, date-picker round trips, leap-day presets, invalid input, email output, and 07:30–10:00 versus 08:00–09:00 overlaps. These are frontend utility tests, not full browser automation.

The API suite exercises a real local test database and server: audit filters, schedule date/range filters, request filters, duplicate detection, equipment preview, and daily statistics. It was run with the API server in UTC, Manila, and Los Angeles. It refuses a nonlocal API/database and requires the database name smartlab_test; fixtures are cleaned up afterward.

No database reset, demo seed, production deployment, or automatic historical-data rewrite is needed. Restart the normal app with npm.cmd run dev. Check an existing booking and create/edit a test booking to see that the selected Manila date/time stays consistent.
