# First-time setup design preview

Run the frontend development server and open `/setup-preview` (for example, `http://localhost:5000/setup-preview`). The route is enabled only in Vite development mode.

The preview walks through Welcome, Administrator, Verify email, Academic period, Review, and a completion screen. Sample details are editable. Back and Edit preserve in-memory values; a reload resets the preview. Password confirmation and required fields are checked before continuing.

This is a UI prototype: it makes no setup API calls, stores no credentials, creates no records, and does not redirect existing installations. Use sample passwords only. The real wizard is documented separately.

The real `/setup` route uses server-side installation eligibility, deployer authorization, validation, and atomic initialization. The preview remains independent of those APIs.

Email verification is simulated on `/setup-preview`: continue is blocked until the preview verification button is used. Resend displays a local status message. Editing the address clears verification. No messages are sent and no token is generated. For the separate real `/setup` flow, see [first-time-setup.md](first-time-setup.md).
