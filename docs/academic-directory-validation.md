# Academic directory validation

Applies to add and edit operations. Administrators only. Saves preserve record IDs and write before/after audit snapshots in the same transaction.

- Buildings and departments: required unique name, maximum 150 characters.
- Programs and subjects: independently unique code (20 characters) and name (150 characters), both required.
- Comparisons ignore case and repeated whitespace; display text is trimmed and spaces collapsed. Codes are stored uppercase. Legitimate punctuation and Filipino names are allowed.
- Rooms: number (20 characters) or name (150 characters) required; both allowed. Building is optional. Room numbers are text. Computer-lab classification must be a boolean, not a string.
- Assigned rooms: duplicate numbers within the building are blocked. Name-only duplicates are blocked within the building. Different buildings may reuse identifiers.
- Unassigned rooms: duplicate number/name generates a warning after saving; it does not block saving.
- Nonexistent building IDs are rejected. Reclassifying a computer lab is blocked for today/future one-time schedules, recurring schedules in the active year and term, or today/future pending/approved/borrowed room requests. Equipment usage locations do not count as reservations.
- Editing shows a warning that renaming may affect labels in linked historical reports. There are no delete endpoints in this directory; this update does not introduce deletion or archiving.

## Validation and rollout

Run npm.cmd run build at repository root. With local PostgreSQL running, run node scripts/test-directory-validation-local.cjs from backend. This uses only local smartlab_test with a temporary isolated schema and removes that schema afterwards.

Apply pending migrations with prisma migrate deploy on staging before deploying matching code. The subject and directory expression indexes are maintained in SQL and require migration deployment; prisma db push alone does not install them. If existing normalized duplicates prevent migration, inspect and resolve them deliberately without deleting referenced data. No automatic merging or renaming is performed.

Database integration tests could not run during implementation because localhost:5432 was unavailable. Build and standalone input validation checks were run separately.
