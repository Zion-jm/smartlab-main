# SmartLab

Laboratory scheduling, equipment borrowing, account management, and notifications for PUP Lopez Campus.

## Development

Use Node.js 22.13.0, npm 10.9.2, and PostgreSQL.

1. Run `npm ci` from the repository root.
2. For a new installation, copy `backend/.env.example` to `backend/.env` and configure the database URL and a unique JWT secret. Keep existing environment files.
3. Run `npm run db:generate`.
4. Review the database migration instructions before setting up or upgrading a database. Do not reset an existing database to install changes.
5. Run `npm run dev` and open http://localhost:5000. The API runs on port 3001.

See [local development](docs/local-development.md), [project handoff](PROJECT_HANDOFF.md), and [verification](docs/reproducible-verification.md).

## Production

`npm run build` builds both packages. `npm run start:production` starts the production server. The Dockerfile installs Chromium and supplies its runtime path. Configure environment variables through your hosting provider; migrations and initial administrator creation are explicit operator actions.

## PDF and email

PDF exports require Chrome or Chromium. Outside Docker, set `CHROMIUM_PATH` to the installed executable. Python is not required by the application.

See [email configuration](EMAIL_NOTIFICATIONS.md). Set `FRONTEND_URL` to the accessible website origin for email links. Never commit environment credentials.
