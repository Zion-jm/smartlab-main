# Explicit request types

Only LABORATORY and EQUIPMENT are supported. There is no database default: every writer must declare its intent. Laboratory requests are faculty-only computer-lab reservations. Equipment usage rooms do not reserve rooms.

Migration 20261010010000_remove_legacy_requests locks the request table, checks for LEGACY rows, removes the default and enum value, and preserves all explicitly typed rows. It aborts without deleting or converting records if any LEGACY rows exist. Historical migrations remain unchanged.

Before deployment, back up the database and run the read-only backend command `node scripts/check-request-types.cjs` against the intended Render database. This implementation was tested locally; it does not independently verify Render contents. Stop request writes during deployment, apply migrations using the release's usual migration step, and start the new build. Old writers that omit requestType will fail after the migration. Do not mark a failed migration applied or auto-convert unknown records.

Demo seeds now explicitly create equipment requests with usage rooms; independent demo schedules are not linked to those equipment requests. The seed file also contains pre-existing catalog edits: review those separately before committing or running it. Do not run demo seeds on Render.

Local validation: test-remove-legacy-local.cjs covers guard rollback, preservation, missing-type and removed-enum rejection. test-request-types-local.cjs covers lifecycle and room separation. test-request-types-browser.cjs covers user roles and the alternate schedule-request endpoint. The regression runner and deployment smoke tests use isolated local schemas.
