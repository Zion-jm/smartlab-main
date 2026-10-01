# Step 16 — control-ribbon compliance

Completed 2026-10-01. Restored the documented 40px minimum for ribbon toggles, bottom handles, fields, actions, tabs, reset controls and clickable checkbox labels. Preserved outer bottom slots, explicit portal targets, PortalLayout identity and always-visible actions. Added real label associations through FilterItem and date labels in faculty/student schedule filters. Removed a blocked Google Fonts import; report styles use their existing Georgia/serif fallback offline.

Validation: backend and frontend build passed; final frontend rebuild passed. Chromium against the real production API in an isolated database passed 39 cases: Requests, Equipment, Schedule, Accounts, Directory, Rooms, Audit Logs, Reports overview and three detail tabs, Faculty and Student, each at 1280/1024/390px. Checks include expanded/advanced/collapsed controls, active search preservation, one portal handle, labels and aria-controls, keyboard activation/focus, dropdown keys, visible actions, target dimensions, horizontal bounds, sticky scroll positioning and print styles. Zero browser console, JavaScript or API errors in the final run. Screenshots are saved alongside the JSON matrix. Resize checks wait for the existing 300ms layout transition. This is Chromium verification, not a screen-reader or all-browser certification.

Changed shared components lint cleanly. Faculty/Student each retain seven pre-existing lint errors and three warnings, confirmed against the prechange snapshot; no new lint diagnostics. See SmartLab-Fix-16-Lint-Comparison.json. The existing frontend bundle-size warning remains. No production deployment.

Evidence: SmartLab-Fix-16-Browser-Matrix.json, SmartLab-Fix-16-Browser.log, SmartLab-Fix-16-Build.log, SmartLab-Fix-16-Shared-Lint.log and SmartLab-Before-Fix-16.zip. Reproduce with backend/scripts/verify-ribbons.cjs, SMARTLAB_EVIDENCE_DIR and PLAYWRIGHT_MODULE pointing to an available Playwright installation; local smartlab_test and Chrome required. Script creates and removes only its generated schema.

Next: step 17, reusable interactive tables.
