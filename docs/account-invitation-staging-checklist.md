# Account invitation staging test checklist

Use staging only and email inboxes you control. Keep your existing administrator signed in in your normal browser. Use a private/incognito window for invitation links and new-user sign-in. Do not record passwords, full invitation links, or tokens in this file.

Test date: __________
Tester: __________
Staging URL: __________
Deployed commit: __________

Check a box only after verifying its expected result. Leave failed or untested items unchecked and record the issue below.

## 1. Deployment and existing access

- [ ] GitHub checks pass for the invitation commit.
- [ ] Render staging shows Live for that same commit.
- [ ] Existing administrator can sign in with their unchanged password.

## 2. Create a student invitation

In Manage Accounts, add a test student with a controlled email address and the required academic details.

- [ ] The account form has no administrator-entered password field.
- [ ] Send invitation succeeds and reports that the email was queued.
- [ ] The new account displays Pending activation.
- [ ] The Pending activation filter includes the new account.

## 3. Email delivery

Allow time for the email queue to process. Check the inbox and spam folder.

- [ ] The invitation reaches the controlled inbox.
- [ ] The email identifies Smartlab and explains the link expiry.
- [ ] The setup link points to the staging website, not production or localhost. Stop if the destination is wrong.

## 4. Password setup

Open the invitation link in a private/incognito window.

- [ ] A password shorter than 8 characters produces a validation message without activating the account.
- [ ] Different password and confirmation values produce a mismatch message.
- [ ] Show passwords makes both fields readable; turning it off hides them.
- [ ] Matching valid passwords successfully activate the account.
- [ ] The success page asks the user to sign in and does not automatically sign them in.

## 5. Sign-in and permissions

- [ ] The invited student can sign in using their chosen password.
- [ ] The student portal opens successfully.
- [ ] The student cannot access admin pages.
- [ ] Manage Accounts shows the account as Active after refreshing.
- [ ] Reopening the used invitation link reports that it is invalid or expired.

## 6. Resend and old-link rejection

Create another pending account using a different controlled email address. Keep the first invitation email for comparison.

- [ ] An immediate resend is blocked by the one-minute waiting period.
- [ ] Resending after at least one minute succeeds.
- [ ] The original invitation link no longer works.
- [ ] The newest invitation link works.

## 7. Correct the email address

Use a pending account. Wait at least one minute after its last invitation, then select Invitation options, enter another controlled address, and select Correct email and send new link.

- [ ] The account displays the corrected email address.
- [ ] The previous invitation link no longer works.
- [ ] A new invitation reaches the corrected inbox.
- [ ] The new link activates the account, which can sign in with the corrected address.

## 8. Cancel and reinvite

Use another pending test account.

- [ ] Cancel invitation requires confirmation.
- [ ] After cancellation, the account shows Invitation cancelled.
- [ ] The cancelled invitation link cannot activate the account.
- [ ] After waiting at least one minute since the last send, Send new invitation succeeds.
- [ ] The account returns to Pending activation.
- [ ] The new invitation works, while the cancelled link remains invalid.

## 9. Other roles and existing features

Use separate controlled email addresses for role tests. Do not change the role of an existing account to perform these checks.

- [ ] An invited faculty user can activate and sign in to the faculty portal.
- [ ] The invited faculty user cannot access admin pages.
- [ ] A temporary invited administrator can activate and access the admin portal.
- [ ] Existing student and faculty accounts can still sign in.
- [ ] Lab schedules display correctly.
- [ ] A disposable test borrowing request can be submitted and processed through the expected workflow.
- [ ] Report PDFs download and open correctly.
- [ ] Lab schedule PDFs download and open correctly.
- [ ] Password reset works for an activated test account.

## 10. Cleanup and release decision

- [ ] Resolve any outstanding test requests or loans before deactivating test accounts.
- [ ] Cancel unused pending invitations.
- [ ] Deactivate activated test accounts, including the temporary administrator.
- [ ] Confirm the original administrator remains active and can sign in.
- [ ] Record failures or untested items below.
- [ ] Review all results before approving a production deployment. Completing this checklist does not itself deploy anything.

## Issues and untested items

| Check | Actual result | Follow-up | Retest result |
| --- | --- | --- | --- |
| | | | |

Overall result: PASS / FAIL / INCOMPLETE

Production approval: PENDING / APPROVED

Reviewer and date: __________

## How to mark completion

Change `- [ ]` to `- [x]` when a check passes. Keep the space inside unchecked brackets. If any check fails or remains untested, leave it unchecked and describe it in the issues table.
