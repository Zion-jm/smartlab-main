# SmartLab instructor handover checklist

Use this checklist together with the instructor who will operate and supervise SmartLab. Tick an item only after checking it on the release being handed over. Previous test results do not automatically complete this checklist. Mark items that do not apply as N/A with a reason.

| Handover details | Record |
| --- | --- |
| Instructor / system owner | |
| Prepared by | |
| Review date | |
| Website URL | |
| Git branch and deployed commit | |
| Environment and database name (no password) | |
| Intended start of real use | |

## 1. Confirm the release

- [ ] GitHub verification passes for the commit listed above. Record the run link: __________
- [ ] Render shows a successful deployment of that same commit.
- [ ] The website opens over HTTPS and login works.
- [ ] Deployment logs show successful migrations and no unresolved startup errors.
- [ ] Confirm whether the current staging website will be used for real operations or a separate production installation will be created. Record the decision: __________
- [ ] Record outstanding issues in section 8; do not describe the system as free of all security risks.

Reference: [production deployment](production-deployment.md) and [verification commands](reproducible-verification.md).

## 2. Confirm accounts and access

- [ ] The instructor has an individual administrator account and can sign in with their own password.
- [ ] The instructor knows how to change their password and sign out.
- [ ] Agree who may hold administrator access and who will provide backup administration.
- [ ] Review developer and QA accounts; agree which should be deactivated after testing. Do not deactivate the only working administrator.
- [ ] Faculty and student accounts can access their own permitted pages and requests; they cannot access administrator pages or another user's private requests.
- [ ] Password recovery works using a controlled test account, including receiving the email and signing in with the replacement password.
- [ ] For a new installation only: complete real setup email verification on a disposable installation. Do not erase an existing database to reopen setup. Mark N/A for an existing installation.

Reference: [first-time setup](first-time-setup.md) and [session security](session-security.md).

## 3. Review the data with the instructor

- [ ] Active academic year and semester are correct.
- [ ] Programs, departments, subjects, buildings and rooms are correct.
- [ ] Faculty assignments and student academic records are correct.
- [ ] Equipment names and usable, borrowed, damaged and total quantities match actual records or a physical count.
- [ ] Archived equipment and outstanding loans have been reviewed.
- [ ] Existing schedules are accurate and do not contain unintended test bookings.
- [ ] The instructor has reviewed and approved the borrowing policy.
- [ ] Identify sample records to remove or archive, if any. Record the exact scope and instructor approval before cleanup; preserve genuine transactions and audit history.
- [ ] Take and verify a backup before any approved data cleanup. No cleanup is required just to complete this checklist.

## 4. Walk through normal work

Use clearly labeled test accounts and agreed test equipment/times. Avoid reserving real resources unintentionally. Record the request reference and result for each scenario.

| Scenario | Expected result | Pass / issue / reference |
| --- | --- | --- |
| Faculty submits a request | Request appears with the correct details and status | |
| Student submits a request | Required academic details are validated; request appears correctly | |
| Admin approves a request | Status updates and the requester can see the decision | |
| Admin rejects a request | Correct status and explanation appear | |
| Requester cancels an eligible request | Cancellation is recorded and availability is updated correctly | |
| Admin releases equipment | Borrowed and available quantities change correctly | |
| Admin records a full return | Request and inventory reflect returned items | |
| Admin records a partial or damaged return | Remaining loan and damaged quantities are correct | |
| Conflicting request or schedule | System explains the conflict and prevents an invalid booking | |
| Report PDF download | Preparing notice is visible; all rows, page breaks and footer are readable | |
| Audit log review | Relevant actions can be traced to the acting account | |

- [ ] Repeat key request and report tasks on the instructor's phone or tablet.
- [ ] Refresh faculty/student pages and confirm the selected tab is retained.
- [ ] The instructor can perform the main tasks without developer assistance.
- [ ] Close out test loans/bookings and review their effect on inventory after the walkthrough.

## 5. Confirm notifications

- [ ] Confirm the sender address and the person responsible for Brevo or the configured mail provider.
- [ ] Review pending queued messages before enabling delivery, so old test messages are not sent unexpectedly.
- [ ] A controlled request notification reaches the intended inbox; check spam as well.
- [ ] Links in received email open the intended deployed website.
- [ ] In-app notifications appear for the appropriate user.
- [ ] The instructor knows who to contact if email is delayed or fails. A SENT queue status alone is not proof of inbox delivery.

Reference: [email guide](EMAIL_NOTIFICATIONS.md).

## 6. Confirm backup and recovery

- [ ] The backup workflow points to the database that will be used for real operations.
- [ ] Confirm the schedule in the backup repository: expected daily time is **2:17 AM Asia/Manila**. Scheduled runs may start late; check actual run history.
- [ ] Check a successful scheduled run, not only a manual run, and confirm its encrypted backup artifact is available.
- [ ] Confirm daily/weekly retention settings and explain when old artifacts expire.
- [ ] The responsible person can download a backup and locate the encryption password in the agreed password manager.
- [ ] Follow the recovery guide: verify the checksum, decrypt, restore into a separate test database, and check records and application access. Never test a restore over the live database.
- [ ] Record the most recent successful restore test: date __________ backup name __________ reviewer __________
- [ ] Confirm how hosting configuration and any separately stored files will be recovered; a database dump does not contain hosting secrets or every application file.
- [ ] Take a final backup after agreed cleanup and before handover. Record its name and storage location: __________
- [ ] Assign someone to check backup failures and perform periodic restore tests.

Recovery instructions: the README and recovery guide in the private [SmartLab backup repository](https://github.com/Zion-jm/smartlab-backups). Confirm the instructor or designated technical owner can access them.

## 7. Transfer ownership and support

Record account owners and access locations here, never passwords, API keys, connection strings or backup encryption secrets.

| Service | Responsible owner | Access confirmed / secure credential location |
| --- | --- | --- |
| SmartLab administrator account | | |
| Main GitHub repository | | |
| Backup GitHub repository and Actions | | |
| Render hosting | | |
| Aiven database | | |
| Brevo / mail provider | | |
| Backup encryption password | | |
| Domain, if applicable | | |

- [ ] Transfer access through service invitations or an agreed secure password manager.
- [ ] Review account recovery methods and enable multifactor authentication for hosting/source-control accounts where supported.
- [ ] Agree who pays recurring charges and checks plan limits, email quotas and artifact storage.
- [ ] Explain observed hosting delays or idle startup behavior on the selected plan.
- [ ] Assign responsibility for dependency/security updates and reviewing access.
- [ ] Share the [documentation index](README.md), recovery instructions and support contact.
- [ ] Agree who can deploy updates, approve data cleanup and authorize emergency recovery.
- [ ] Record support contact, availability and escalation method: __________

## 8. Record issues and acceptance

| Issue or limitation | Impact | Responsible person | Target date | Resolution or accepted limitation |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |

Do not approve real use while there is an unresolved problem with administrator access, data integrity, essential borrowing/return tasks, or recoverability. Minor issues may be accepted only with their impact and owner recorded above.

- [ ] Required checks are complete, with evidence or notes recorded.
- [ ] The instructor understands daily operation, backup responsibility and how to request help.
- [ ] Any accepted limitations are explicitly agreed.
- [ ] The deployed version and final backup are recorded.

Decision: **Ready for use / Ready with listed limitations / Not ready**

Instructor name and signature: ____________________ Date: __________

Developer / technical owner name and signature: ____________________ Date: __________

Follow-up review date: __________
