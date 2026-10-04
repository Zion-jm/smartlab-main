# Local development

Existing local installations: keep backend/.env. Run npm.cmd run dev from the repository root. Starting the app no longer installs packages, synchronizes the database, or seeds accounts.

For a new installation:
1. Run npm ci at the repository root.
2. Copy backend/.env.example to backend/.env, only if no .env exists. Fill in your PostgreSQL URL and a unique random JWT_SECRET. URL-encode special characters in the database password.
3. Run npm run db:generate.
4. For a new disposable development database only, run npm run db:push. Review schema changes before applying them to any database with valuable data.
5. Run npm run dev. Open http://localhost:5000.

Generate a JWT secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

The backend loads backend/.env before email and routes initialize, regardless of the launch directory. Environment variables injected by a hosting provider take priority. Missing DATABASE_URL or JWT_SECRET stops startup with a configuration error. Missing SMTP_PASS disables external email delivery. Frontend VITE_ variables are public: never put secrets in them.

## Optional demo data
Skip this if your local database already has accounts/data. Seeding can reset demo accounts and sample records. It is only for disposable development/test databases.

In a new PowerShell terminal at the repository root:

~~~powershell
$env:NODE_ENV = 'development'
$env:ALLOW_DEMO_SEED = '1'
$env:DEMO_DATABASE_NAME = 'smartlab_test'
try { npm.cmd run db:seed }
finally {
  Remove-Item Env:ALLOW_DEMO_SEED -ErrorAction SilentlyContinue
  Remove-Item Env:DEMO_DATABASE_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
}
~~~

Use the actual disposable database name. Production mode, missing confirmation, and a mismatched database name are refused before Prisma is created. These guards prevent accidents; someone controlling the environment can change them.

The reset script additionally requires RESET_TEST_DATABASE=1 and deletes database records. Do not run it on valuable data. No database reset or seed is needed for this configuration fix.

## Hosting
Store DATABASE_URL, JWT_SECRET, and SMTP credentials in your hosting provider's environment settings. Use the root npm scripts for startup and the Dockerfile for a portable production runtime. Run npm ci and npm run db:generate during setup, then npm run build. Review migrations before applying them; never enable demo seed flags in production. See README.md and EMAIL_NOTIFICATIONS.md for runtime requirements.

## Git and existing secrets
Ignore rules do not remove files already tracked. From the repository root, run git rm --cached -- .env backend/.env if these files still appear in git ls-files. This keeps the files on disk. Commit the removal alongside the safe example files and configuration changes.

Removing files from tracking does not erase old Git history. Replace any real exposed database/SMTP credentials with their providers, and generate a fresh JWT secret before deployment. Changing the JWT secret invalidates existing sessions. Do not paste credentials into chat or commit them.
