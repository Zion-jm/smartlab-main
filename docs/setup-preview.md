# First-time setup design preview

Run the frontend development server and open `/setup-preview` (for example, `http://localhost:5000/setup-preview`). The route is enabled only in Vite development mode.

The preview walks through Welcome, Administrator, Verify email, Academic period, Review, and a completion screen. Sample details are editable. Back and Edit preserve in-memory values; a reload resets the preview. Password confirmation and required fields are checked before continuing.

This is a UI prototype: it makes no setup API calls, stores no credentials, creates no records, and does not redirect existing installations. Use sample passwords only. Real setup still uses the existing deployment and initial-administrator procedures.

Before connecting this design to real setup, implement server-side installation eligibility, authorized bootstrap access, atomic initialization, server-side validation, and protection against repeated or concurrent setup. The client must never decide whether an installation is eligible by itself.

Email verification is simulated: continue is blocked until the preview verification button is used. Resend displays a local status message. Editing the address clears verification. No messages are sent and no token is generated. Real delivery, token expiry, single-use validation, resend throttling, and deployer authorization are still pending backend work.
