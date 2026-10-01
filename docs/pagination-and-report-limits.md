# SmartLab step 14 — bounded lists and reports

Completed locally on 1 October 2026 in `E:\BSIT 3 - DBA\smartlab-v2`. Changes remain uncommitted. No deployment or schema migration was performed.

## API contract

The equipment, users, borrow-request, personal-request and schedule lists default to page 1 with 25 rows. Explicit pageSize accepts 1–100; page accepts 1–10000. Invalid, fractional, negative or excessive values return 400. Requests never offer an unbounded page size. Every list adds an ID tie-breaker to its ordering.

All lists provide X-Total-Count, X-Page and X-Page-Size headers, exposed to configured CORS origins. Equipment and users retain their array response shape for compatibility. Request/schedule envelopes also include total, page and pageSize. Request total now means the selected status/filter total; allTotal and stats describe the base filtered scope across statuses. One Prisma groupBy supplies those status counts instead of six status counts plus another total count. Faculty visibility restrictions apply to rows and counts alike.

User-list queries explicitly select response fields and no longer load password hashes, session versions or unrelated account columns. Personal lists apply ownership, status and search before pagination. Schedule source, type, room, program, faculty and text filters execute before paging/counting. Existing period/date rules remain intact.

The admin Requests, Accounts, Equipment and Schedule tables fetch server pages and use server totals. Personal faculty/student requests use 25-row server pages. Filter changes reset the page; deletions/changes that remove the last page clamp the page. Request versions prevent older responses from replacing a newer page/filter result. Schedule filter choices come from directory resources, not just the current page. Program choices represent the program across year levels; date-range controls handle schedule dates.

Calendars, selectors, dashboard summaries and report analysis that require complete data explicitly fetch up to ten 100-row pages, with a 1000-record ceiling. They fail visibly instead of silently presenting a partial dataset. Changed totals, duplicate IDs and failed later pages reject the complete view. These are bounded complete views, not unlimited analytics. Report on-screen date ranges are also sent to the server. Existing local pagination inside bounded report analysis remains separate from operational table pagination.

Offset pages are not a cross-request database snapshot. Concurrent updates can move records between requests; refresh is appropriate after mutations. Stable ordering and collection checks reduce observable inconsistencies without claiming snapshot isolation across HTTP calls.

## PDF workload policy

One export may run per API process, across all four report types. The slot is acquired before fetching rows or launching Chromium, and released on success or failure. A simultaneous export gets 503 / REPORT_BUSY and Retry-After: 5; no unbounded queue is created. The frontend decodes JSON errors returned to blob requests and shows the useful retry/narrow-filter message.

Each report fetch is capped at 1001 candidates and rejects more than 1000 with 413 / REPORT_TOO_LARGE. Nested request items are capped at 101 and rejected above 100 per request. No truncated PDF is generated. Reports keep the existing 60-second Chromium timeout and temporary-file cleanup.

Date/period filters already ran in SQL. Request status, year and program, schedule type/year/computer-lab selection, and equipment status/low-stock predicates now also run in SQL where equivalent. Display-label/composite-text predicates remain in memory on the bounded candidate set to preserve their semantics. The cap is applied before these residual predicates, so a narrow text search can still require a narrower period or a database-applied filter.

Large exports are deliberately refused rather than silently queued. A persistent job queue, shared export semaphore and streamed/batched data preparation are future work if the product must support larger reports or multiple API replicas. The current single-service deployment does not require a background worker for the accepted bounded jobs.

## Measurements

Synthetic fixtures: 251 records per list family, using the actual Express routes and PostgreSQL local smartlab_test. First 25-row request in the final focused run:

| List | Response bytes | HTTP elapsed | SQL statements | Summed SQL duration |
| --- | ---: | ---: | ---: | ---: |
| Equipment | 7,676 | 170 ms | 3 | 9 ms |
| Users | 10,062 | 75 ms | 5 | 12 ms |
| Requests | 20,162 | 80 ms | 7 | 17 ms |
| Schedules | 36,218 | 88 ms | 8 | 20 ms |

SQL counts include authentication and relation loading. Timings are single local samples, not percentiles or production load-test results. The fixtures exercise tied ordering and multiple pages; they do not represent every production relationship density. Full evidence is in SmartLab-Fix-14-Measurements.json.

A fresh production rehearsal with 251 equipment records generated a 1,058,573-byte PDF in about 3.8 seconds including sampling overhead. Two simultaneous exports returned 200 and 503. Six Windows working-set samples observed about 81 MiB for the API before export and about 896 MiB at peak for the API plus newly appearing Chrome/Edge processes (15 processes at peak). Existing browser processes were excluded by baseline PID. Other newly started browser activity could affect this estimate; it is not an exact allocator measurement or a production capacity guarantee.

The memory result supports the conservative single-export policy. Provision and measure the actual host before rollout; the row cap is not a fixed memory cap. Full evidence: SmartLab-Fix-14-Export-Measurements.json and SmartLab-Fix-14-Production-Smoke.txt.

## Verification and recovery

- Both builds passed after the final frontend changes. The existing frontend bundle-size warning remains.
- 450 tests passed across 22 suites in the broad regression run.
- A final focused run passed 48 tests, including two additional personal/schedule filter checks: 452 distinct tests across the runs.
- Tests cover page boundaries, stable tie ordering, exact filtered totals, grouped counts, sensitive-field selection, bounded frontend collection, partial-fetch failure, report overflow, concurrent export rejection and slot recovery.
- Production rehearsal passed migrations, guarded admin setup, compiled frontend/deep links, login/API, CORS, removed diagnostics route, actual PDF generation and schema comparison. Its isolated schema was removed.
- Disposable list fixtures were cleaned up. Existing application data and academic periods were preserved.

New tests: backend/tests/pagination.test.js, reportLimits.test.js and frontendPagination.test.js. The measurement test requires local smartlab_test; set SMARTLAB_EVIDENCE_DIR to an output directory to save its JSON there. backend/scripts/benchmark-report.cjs runs the isolated production/PDF rehearsal and Windows process sampling; it refuses a non-local/non-test database.

SmartLab-Before-Fix-14.zip preserves pre-change backend/frontend source, tests and docs, excluding environment files/dependencies. It is not a database backup. Restore selectively and remove newly introduced files when reverting; avoid overwriting later work.

Restart development processes to use the changes. Browser click-through remains unverified, as does the actual production host. Next checklist item: step 15, shared Prisma access and measured index validation.
