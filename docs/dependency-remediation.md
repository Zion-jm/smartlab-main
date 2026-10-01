# SmartLab dependency remediation

1 October 2026. Release-plan section 1.

The root npm lockfile was updated using compatible audit fixes, with an individually reviewed Nodemailer upgrade from 8.0.10 to 10.0.13. No blanket forced major upgrade was used. Updated resolved packages include Axios 1.20.0, Express 4.22.3, React Router DOM 7.18.4, and PostCSS 8.5.28. The complete package-path changes are in `SmartLab-Release-Dependency-Changes.json`; some entries moved because npm deduplicated the tree.

Nodemailer 10.0.13 requires Node 20 or newer, compatible with this project's Node 22.13.0. Its [official release notes](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.13) and preceding releases were reviewed. The application's SMTP/JSON transport usage compiles and the credential-free email regression passes. Delivery to a real SMTP server is still a staging check; no external email was sent.

Both full and production-only npm audits report **zero known vulnerabilities** at verification time. This is an audit result, not a guarantee against undiscovered vulnerabilities. CI now fails on moderate-or-higher audit findings and retains the JSON report.

Verified so far: clean `npm ci`, Prisma generation, both builds, lint baseline check, and all 474 regression tests across 25 suites. Existing lint debt remains 49 errors and 14 warnings; bundle-size warnings remain.

The installed project dependencies were synchronized and its lockfile matches the tested clean copy. Windows refused to replace the working project's existing Prisma DLL during regeneration (`EPERM` rename). No running user processes were stopped. Prisma version/schema are unchanged; generation and tests succeeded in the independent clean copy. Stop the project's dev server before retrying `npm run db:generate` if regeneration is needed locally.

Backup: `SmartLab-Before-Release-Dependencies.zip`. Audit evidence: `SmartLab-Release-Audit-Before.json`, `SmartLab-Release-Audit-After.json`, and `SmartLab-Release-Production-Audit-After.json`.

Final verification: all 58 browser/component checks passed with zero recorded browser errors. Fresh and upgraded migration rehearsals, production login/SPA/CORS/readiness, and actual PDF generation passed. The working-project build also passed. Release-plan section 1 is complete; no hosted CI run or deployment occurred.
