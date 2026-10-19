# Official production launch

Preparation only: no cloud services, release branch or secrets have been created. Start with an empty database and first-time setup. Keep staging unchanged.

## Names and ownership

| Resource | Suggested name |
| --- | --- |
| Render service | smartlab-production |
| Aiven PostgreSQL service | smartlab-production-db |
| Database | smartlab_production |
| Release branch | production |
| Backup workflow | SmartLab production backup |

Names are subject to availability. Copy the actual website URL assigned by Render; do not assume it from the service name. Agree with the instructor who owns and pays for these services. Review prices before creating paid resources. An always-on Render service is preferable for official use: sleeping services cannot process the in-process email queue. Test PDF memory usage on the selected plan. Choose nearby Render and Aiven regions.

## 1. Aiven

1. In Aiven Console, select the intended organization/project and create a PostgreSQL service named **smartlab-production-db**.
2. Select the reviewed region and plan. The backup uses PostgreSQL 18 client tools; use a server no newer than 18 unless that workflow is updated.
3. Wait until running, open its **Databases** view and create **smartlab_production**. Do not restore staging or run demo seeds.
4. Get connection details from the service overview. Save credentials privately in your password manager.
5. Change the database part of the Service URI from defaultdb to smartlab_production. Preserve the actual host, port, username and correctly URL-encoded password.

Connection shape only:

```text
postgresql://USERNAME:URL_ENCODED_PASSWORD@HOST:PORT/smartlab_production?sslmode=require
```

Keep two slashes after the protocol and one before the database. Never paste real credentials into chat or GitHub files. sslmode=require encrypts traffic but does not verify server identity; review Aiven CA verification and test the final TLS options with Prisma and pg_dump. Review network restrictions for both Render and the backup runner. A separate service provides stronger isolation than another database in the staging service. If quotas prevent creation, resolve that before proceeding rather than replacing staging.

## 2. GitHub release branch

Use the existing **Zion-jm/smartlab-main** repository. After verification passes, create **production** from the exact reviewed **staging-render** commit, not an older main commit. This guide does not create that branch.

Keep staging-render connected to staging. Use reviewed pull requests into production for future releases. Enable passing Verification checks and protection against force pushes where your GitHub plan supports them. Application CI uses isolated PostgreSQL and must not receive production database credentials.

Initially disable Render auto-deploy; manually release a verified commit after taking a backup.

## 3. Render

Create a new **Web Service**, connected through GitHub to smartlab-main:

| Setting | Value |
| --- | --- |
| Name | smartlab-production |
| Branch | production |
| Runtime | Docker |
| Root directory | Leave blank |
| Dockerfile | ./Dockerfile |
| Build context | Repository root |
| Health check | /ready |
| Docker command override | Leave blank |
| Auto-deploy | Disabled initially |
| Instances | One initially; rate limits are currently process-local |

Choose the reviewed plan and region. Configure these environment variables before deployment:

| Variable | Value / source |
| --- | --- |
| DATABASE_URL | New Aiven URI targeting smartlab_production |
| JWT_SECRET | New random secret, different from staging |
| FRONTEND_URL | Actual assigned HTTPS origin, no trailing slash/path |
| NODE_ENV | production; also set by Docker/startup |
| PORT | 10000; Docker default |
| CHROMIUM_PATH | /usr/bin/chromium; Docker default |
| SYSTEM_BASELINE_ACADEMIC_YEAR | 2026-2027, confirm with instructor |
| EMAIL_PROVIDER | brevo |
| EMAIL_DELIVERY_ENABLED | false initially; enable before setup verification once email is configured |
| BREVO_API_KEY | Production-specific key from the authorized Brevo account |
| EMAIL_FROM_ADDRESS | Verified Brevo sender |
| EMAIL_FROM_NAME | SmartLab - PUP Lopez Campus |
| INITIAL_SETUP_TOKEN | Separate new random secret; remove after setup |

If Render assigns the URL only after creation, correct FRONTEND_URL before setup or any email delivery. Leave VITE_API_BASE_URL unset for same-origin /api. Extra CORS_ORIGINS are unnecessary unless additional exact origins are required. Confirm trusted proxy addresses and client-IP behavior before launch; do not guess TRUSTED_PROXIES or set it to true. Otherwise users may share an IP-based limit. Never configure demo seed flags or test database variables in production.

Generate each secret separately in your own PowerShell terminal, then store it privately:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not reuse JWT, setup-token and backup-encryption secrets. Docker startup runs **prisma migrate deploy** before the API starts; migration failure stops startup. Do not add reset, seed or schema-push commands.

## 4. Email and first-time setup

1. Confirm migration/startup success in Render logs and a successful /ready response.
2. Configure the verified Brevo sender and API key. Set EMAIL_DELIVERY_ENABLED=true and apply the Render change. Keep staging delivery disabled.
3. Open the official site's **/setup**, enter the private setup token, and create the instructor's account with their cooperation.
4. Receive and verify the email, return to the original setup tab, check verification, select the academic period and finish.
5. Sign in, remove INITIAL_SETUP_TOKEN from Render, and confirm setup cannot create another installation.
6. Add approved catalog and user records through supported screens. Do not import staging test transactions.

See [first-time setup](first-time-setup.md). Test mail only with recipients you control before inviting users.

## 5. GitHub backup cron

The private **Zion-jm/smartlab-backups** repository has a prepared **.github/workflows/production-backup.yml**. Commit/push it and its README update to that repository's default branch. Existing staging workflow/secrets remain unchanged.

In the backup repository, open **Settings > Secrets and variables > Actions**:

| Type | Name | Value |
| --- | --- | --- |
| Secret | PRODUCTION_BACKUP_DATABASE_URL | New production URI; pg_dump-compatible options, no Prisma-only schema option |
| Secret | PRODUCTION_BACKUP_ENCRYPTION_PASSWORD | Separate random password of at least 32 characters |
| Variable | PRODUCTION_BACKUPS_ENABLED | true, after both secrets are set |

Save the recoverable password in your password manager as **SmartLab Production Backup Encryption**. Retain the staging password. GitHub cannot reveal saved secrets again.

Run **SmartLab production backup** manually from Actions. Disabled jobs are skipped, not successful backups. Confirm an encrypted artifact, checksum, decryption and restoration into a separate test database using the backup repository's RECOVERY.md. The workflow checks the database name, but you must also confirm the correct host.

Schedule: **02:17 Asia/Manila daily**, cron `17 18 * * *` in UTC. GitHub may delay scheduled jobs. Daily artifacts retain 7 days and Sunday copies 28 days, subject to repository limits. Confirm a scheduled run and enable failure notifications for the responsible owner. Agree whether losing changes since the last successful daily backup is acceptable; review Aiven's plan-specific recovery options too.

No separate Render cron is required. GitHub handles backups; email polling runs inside the web service every 30 seconds. Do not schedule migrations, seeds or restores.

## 6. Launch and future updates

Complete the [instructor handover checklist](instructor-handover-checklist.md), including email, PDF, inventory, permissions and restore rehearsal. Record the deployed commit, official URL, owners and final backup before inviting users.

For updates: test in staging, review migrations, back up production and deploy the verified release. The proposed maintenance-mode switch is not implemented. Coordinate a write pause for incompatible migrations; old/new instances can overlap during deployment. A code rollback does not undo database migrations. A restore requires a reviewed recovery procedure and stopped application/background writers. Never replace production with staging data as an update mechanism.

## Provider references

- [Render Docker](https://render.com/docs/docker)
- [Render health checks](https://render.com/docs/health-checks)
- [Render free-service limitations](https://render.com/docs/free)
- [Aiven database creation](https://aiven.io/docs/products/postgresql/howto/create-database)
- [Aiven TLS verification](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
- [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
