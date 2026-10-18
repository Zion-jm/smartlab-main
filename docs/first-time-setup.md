# First-time installation setup

The real wizard is `/setup`; `/setup-preview` remains development-only and never sends mail. Existing installations continue to use normal sign-in. There is no automatic redirect from the landing page.

## Enable on a new installation

1. Back up existing databases before deploying migrations. Do not reset a database to enable setup. The new migration permanently closes setup when it finds existing users or academic/catalog data.
2. Configure the backend database, JWT secret, HTTPS `FRONTEND_URL`, and email delivery as described in the deployment guide. For Brevo use `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS` (verified sender), and `EMAIL_DELIVERY_ENABLED=true`.
3. Generate a random token locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store it in your password manager and set it as the backend secret `INITIAL_SETUP_TOKEN`. Never commit it or put it into a frontend `VITE_*` setting.
4. Apply migrations, build, and start normally. Open `https://YOUR-APP/setup`. Enter the private token and administrator details. Keep that tab open: setup credentials remain only in memory.
5. Open the email verification link and explicitly click Verify email. Return to the original tab and click Check verification. The queued email can take at least one worker interval (30 seconds) plus provider delivery time.
6. Choose the starting year and semester. Finish setup creates the administrator, active academic year, active term, and audit record in one transaction. Sign in with the new account.
7. Remove `INITIAL_SETUP_TOKEN` from hosting secrets. Setup remains closed even if the token is left configured.

The verification link lasts 30 minutes, works once, and is replaced by a resend. Setup sessions last two hours. Resends require at least one minute between sends and are capped at five per hour across the installation, including address changes. Reloading the original tab loses the session; start again with the token and request another email. Correcting account details also requires a new link. The wizard does not create catalog data or invite users.

The existing `admin:initialize` CLI remains an operator alternative and also closes browser setup. Do not use it partway through a browser setup.

## Verification before deployment

Run `npm run build`, `npm run lint:ci`, and `npm run test:setup` with `TEST_DATABASE_URL` pointing to local `smartlab_test`. The setup test creates a temporary schema and removes it afterward. It queues mail with test credentials but never starts the email worker or contacts Brevo. It checks tokens, validation, email-disabled failure, resend cooldown, expiry, corrected address, single-use links, invalid sessions, concurrent finalization, and permanent closure.

Actual Brevo delivery must still be checked on a separate disposable installation with a recipient you control. Never enable or test first-time setup by clearing the live installation marker.
