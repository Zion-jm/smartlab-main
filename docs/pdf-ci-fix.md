# PDF runtime CI correction

The hosted diagnostic returned ENOENT after approximately 60 seconds. It confirms the CLI renderer did not return a usable PDF, but does not establish the underlying Chromium failure.

Replaced command-line print-to-file with playwright-core's Chromium PDF API. The backend now declares playwright-core 1.58.2 as a production dependency. Browser selection still uses CHROMIUM_PATH and existing runtime candidates. Reports retain CSS page sizes, backgrounds, and no browser headers/footers. External requests are blocked; report assets are embedded. Rendering has a 60-second deadline after launch, and browser cleanup runs on success and failure.

Local validation: backend build passed; all 475 tests across 25 suites passed; standalone PDF generated in 1.8 seconds; authenticated equipment PDF generated (257,083 bytes); fresh and upgrade migration rehearsals passed. Linux hosted verification remains pending. No claim that the hosted failure is resolved until the next run passes.
