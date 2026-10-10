# Student academic records

## Scope
Admin > Academic Period now includes Student academic records. Select a year, load students, and add or edit a confirmed program, year level and academic status. A reason and confirmation are required. Changes are audited and stale edits are rejected.

One record is stored per student account and academic year. Records link to the account rather than its disposable role profile so a later role change does not erase academic history. Program code/name are saved on the academic record. Year levels remain 1–4; graduation is a status, not Year 5.

Selecting a historical year or changing the active period never increments, decrements, promotes or archives accounts. Batch promotion and automatic account archival are not included.

## Deployment
Apply the new migration to the intended database before starting the updated backend:

    npx prisma migrate deploy
    npx prisma migrate status

Run these from backend with DATABASE_URL set to the intended target. Generate Prisma Client as part of the normal build. The migration creates an empty table; it does not infer or backfill historical enrollment.

## Initial setup
Verify a student's standing for the selected year before saving. Use current profile as a starting point is explicit convenience, not proof of historical enrollment. Prefer confirming the current academic year first, then add earlier years only where reliable records exist.

Until the first academic record is saved, new requests retain the existing profile fallback. After the first record, new requests require an ENROLLED or CONTINUING record for the requested year. Missing years, GRADUATED and WITHDRAWN block new requests for that year without disabling login. Account deactivation remains separate.

Do not create future academic years merely to test progression in shared staging. Use disposable test data. If an administrator intentionally corrects a yearly record, the change is audited; switching the year filter itself performs no writes.

## Historical requests
New student requests copy program ID and year level from the year's confirmed standing. Editing an existing request retains its original academic year, term, program ID and year level. Corrections to standing do not rewrite old requests. Existing request/report year-level filters continue to use saved request values.

This feature does not reconstruct unknown historical enrollment or snapshot every mutable directory label on existing requests. Historical enrollment lists and request histories are separate views.

## Verification
The regression suite covers profile fallback, independent yearly records, uniqueness/stale edits, permissions, validation, graduation, saved program names and historical request edits. Browser verification covers explicit confirmation and year switching at desktop and phone widths.
