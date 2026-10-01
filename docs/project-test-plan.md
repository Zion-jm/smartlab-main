> Historical review/proposal. See README.md and reproducible-verification.md for implemented status and current checks.

# SmartLab Project Test Plan

This checklist will contain test coverage for every page and user view in
SmartLab. It currently starts with the official login experience and can be
expanded with admin, faculty, and student portal sections.

The official SmartLab sign-in experience is the branded landing page at `/`,
which contains the login section.

The old standalone `/login` URL now redirects to `/` so existing bookmarks
continue to work. The old generic `/dashboard` route has been removed, so
students now go directly to `/student/panel`. The test suite should verify
both the visible user interactions and the authentication behavior behind the
official page.

## 1. Landing Page and Navigation

On the branded landing page, verify that a user can:

- [ ] Open the home page.
- [ ] Click the SmartLab logo and scroll to the Home section.
- [ ] Click **Home** and scroll to the Home section.
- [ ] Click **Features** and scroll to the Features section.
- [ ] Click **About** and scroll to the About section.
- [ ] Click **Sign In** and scroll to the login section.
- [ ] Click **Get Started** and scroll to the login section.
- [ ] Click **Learn More** and scroll to the Features section.
- [ ] Scroll through the page manually.
- [ ] Use browser back and forward navigation after using page navigation.
- [ ] Open `/login` directly and confirm it redirects to `/`.

## 2. Login Form Inputs

For the login form, verify that a user can:

- [ ] Focus the email field.
- [ ] Enter a valid email address.
- [ ] Enter an invalid email format.
- [ ] Leave the email field empty.
- [ ] Enter spaces or unusual characters in the email field.
- [ ] Enter a normal password.
- [ ] Enter an incorrect password.
- [ ] Leave the password field empty.
- [ ] Enter a very long password.
- [ ] Enter special or Unicode characters in the password field.
- [ ] Replace or edit previously entered values.
- [ ] Use the Tab key to move between fields and controls.
- [ ] Press Enter while inside the form to submit.

### Password Visibility Control

On the login section of `/`, verify that a user can:

- [ ] Click **Show password** to reveal the password.
- [ ] Click **Hide password** to conceal the password again.
- [ ] Confirm that toggling visibility does not change the password value.
- [ ] Confirm that the accessible label changes between `Show password` and
      `Hide password`.

## 3. Form Submission

Verify that the user can submit:

- [ ] Valid admin credentials.
- [ ] Valid faculty credentials.
- [ ] Valid student credentials.
- [ ] An incorrect password.
- [ ] An unknown email address.
- [ ] Both fields empty.
- [ ] Only the email field filled.
- [ ] Only the password field filled.
- [ ] The form with repeated rapid clicks.

During submission, verify that:

- [ ] The submit button becomes disabled while the request is loading.
- [ ] The submit button changes from `Sign In` to `Signing in...`.
- [ ] The form does not submit duplicate login requests from repeated clicks.
- [ ] The submit button becomes available again after the request finishes.

## 4. Successful Login Behavior

Verify the expected redirect for each role:

| User role | Expected destination |
| --- | --- |
| Admin | `/admin/dashboard` |
| Faculty | `/faculty/panel` |
| Student from `/` | `/student/panel` |

After successful login, verify that:

- [ ] The correct role portal is displayed.
- [ ] The correct user identity is loaded.
- [ ] A user cannot access another role's portal.
- [ ] Refreshing the page keeps the session active.
- [ ] Opening the login page again does not corrupt the active session.

The student flow should not pass through a generic dashboard route:

- [ ] A student is sent directly to `/student/panel` after signing in.
- [ ] `/dashboard` is not used as an intermediate student destination.

## 5. Failed Login Behavior

Verify that:

- [ ] An error appears for invalid credentials.
- [ ] The error does not reveal whether the email or password was incorrect.
- [ ] The entered email remains available after a failed attempt.
- [ ] The password can be corrected and submitted again.
- [ ] A successful retry clears the previous error.
- [ ] The form remains usable after a failed attempt.
- [ ] The login button is enabled again after the failed request finishes.

The branded landing page should:

- [ ] Display `Invalid email or password.`
- [ ] Keep the error visible until a new login attempt or page navigation.

## 6. Error and Resilience Cases

Verify the login experience when:

- [ ] The backend is unavailable.
- [ ] The network request fails.
- [ ] The login response is slow.
- [ ] An existing token is expired.
- [ ] An existing token is invalid.
- [ ] Browser authentication storage is corrupted.
- [ ] A user logs in after logging out.
- [ ] The page is refreshed during or immediately after login.
- [ ] A protected portal is opened without logging in and redirects to `/`.

## 7. Accessibility and Usability

Verify that:

- [ ] Email and password labels are visible.
- [ ] Both fields are keyboard accessible.
- [ ] Focus moves in a sensible order.
- [ ] The password toggle has the correct accessible name.
- [ ] The submit button has a clear accessible name.
- [ ] Error messages are visible and readable.
- [ ] The form works at a desktop viewport size.
- [ ] The form works at a mobile viewport size.
- [ ] No form content is cut off on a narrow screen.

## 8. Important Validation Behavior

The branded form uses `noValidate`, so empty or malformed values are sent to
the application for handling. The test suite should assert the actual
behavior of the official page.

## 9. Student Panel

This section starts immediately after a student successfully signs in and
lands on `/student/panel`.

### 9.1 Student Panel Entry and Access

Verify that:

- [ ] A student is redirected directly to `/student/panel` after login.
- [ ] The page displays the `Student Portal` label.
- [ ] The student’s email is visible in the profile area.
- [ ] The current academic year and term context are displayed.
- [ ] Student-specific request resources load, including faculty, subjects,
      rooms, programs, and equipment.
- [ ] The student profile is refreshed when the panel opens.
- [ ] A student can refresh the page and remain in the student panel.
- [ ] An unauthenticated user cannot open `/student/panel`.
- [ ] An admin or faculty user cannot use the student panel and is redirected
      to their own portal.

### 9.2 Shared Student Portal Layout

Verify that the student can:

- [ ] Select **New Request** from the sidebar.
- [ ] Select **My Requests** from the sidebar.
- [ ] Select **View Schedules** from the sidebar.
- [ ] See which sidebar item is currently active.
- [ ] Collapse the sidebar on a desktop viewport.
- [ ] Expand the collapsed sidebar again.
- [ ] Open the mobile navigation menu on a narrow viewport.
- [ ] Close the mobile navigation menu with the menu button.
- [ ] Close the mobile navigation menu by clicking the page overlay.
- [ ] Scroll the portal content independently from the fixed navigation.
- [ ] Open the profile menu by clicking the student profile area.
- [ ] Close the profile menu by clicking the profile area again.
- [ ] See the student email in the profile menu.
- [ ] See the `Student Portal` role badge in the profile menu.
- [ ] Click **Sign Out**.
- [ ] Be returned to `/` after signing out.
- [ ] Lose access to protected student content after signing out.

### 9.3 Student Notifications

Verify that the student can:

- [ ] Open the notification panel from the bell icon.
- [ ] See the unread notification count when unread notifications exist.
- [ ] See `99+` when the unread count is greater than 99.
- [ ] See a loading state while notifications are being fetched.
- [ ] See the empty state when there are no notifications.
- [ ] Read notification titles, messages, and relative timestamps.
- [ ] Identify notification types including request approval, rejection,
      pending status, equipment due, schedule reminders, and system
      announcements.
- [ ] Click an unread notification to mark it as read.
- [ ] Confirm that clicking an already-read notification does not create an
      additional state change.
- [ ] Click **Mark all read** when unread notifications exist.
- [ ] Confirm the unread count becomes zero after marking all notifications as
      read.
- [ ] Confirm **Mark all read** is hidden when there are no unread
      notifications.
- [ ] Close the notification panel by clicking outside it.
- [ ] Confirm notifications continue polling while the student is
      authenticated.
- [ ] Confirm notification polling stops after sign-out.

### 9.4 New Request Tab

On **New Request**, verify that the student can:

- [ ] See the `Request details` form.
- [ ] Select **Use a computer lab**.
- [ ] Select **Use a general room**.
- [ ] Switch between computer-lab and general-room requests.
- [ ] Select a computer laboratory room.
- [ ] Select a general-purpose room.
- [ ] See a helpful message when no computer labs are available.
- [ ] See a helpful message when no general-purpose rooms are available.
- [ ] Select a date of use.
- [ ] Clear the selected date.
- [ ] Navigate to the previous month in the date picker.
- [ ] Navigate to the next month in the date picker.
- [ ] Change the date picker month from the month selector.
- [ ] Change the date picker year from the year selector.
- [ ] Select a date at least three days after the current date.
- [ ] Confirm dates before the minimum allowed date are disabled.
- [ ] Confirm Sundays are disabled.
- [ ] Select a start time.
- [ ] Select an end time.
- [ ] Choose times from the available 30-minute options.
- [ ] Select a supervising faculty member.
- [ ] Select a subject.
- [ ] Review the prefilled program.
- [ ] Review the prefilled year level.
- [ ] Confirm the program field cannot be changed by the student.
- [ ] Confirm the year-level field cannot be changed by the student.
- [ ] Enter optional contact details.
- [ ] Leave contact details empty.
- [ ] Enter a required purpose for the request.
- [ ] Edit the purpose after entering it.
- [ ] Submit a request without reserving equipment.

### 9.5 Request Validation

Verify that the student cannot submit when:

- [ ] Academic context is unavailable.
- [ ] No supervising faculty is selected.
- [ ] No room is selected for a computer-lab request.
- [ ] No room is selected for a general-room request.
- [ ] No date of use is selected.
- [ ] No start time is selected.
- [ ] No end time is selected.
- [ ] No purpose is entered.
- [ ] No program is available.
- [ ] No year level is available.
- [ ] No subject is selected.
- [ ] The end time is the same as the start time.
- [ ] The end time is earlier than the start time.
- [ ] The combined date and time values cannot be converted into a valid
      request range.

For validation errors, verify that:

- [ ] A clear error message identifies the missing or invalid field.
- [ ] The first missing field is focused or brought into view.
- [ ] Clicking the `Missing: ...` summary link focuses the first missing field.
- [ ] Editing a field clears the previous submit error.
- [ ] The submit button is disabled while resources are loading.
- [ ] The submit button is disabled while the request is being submitted.
- [ ] A student can retry loading request resources after a loading error.

### 9.6 Equipment Selection

After a valid date, time, and academic context are selected, verify that the
student can:

- [ ] See the equipment availability and selection section.
- [ ] See equipment sorted by availability.
- [ ] See each item’s available, used, and total quantities.
- [ ] See availability percentages and status messages.
- [ ] Select an available equipment item using its checkbox.
- [ ] Select an available equipment item using its **Select** button.
- [ ] Confirm selecting an item starts with quantity 1.
- [ ] Increase the selected quantity with the plus button.
- [ ] Decrease the selected quantity with the minus button.
- [ ] Confirm the quantity cannot go below 1 while selected.
- [ ] Confirm the quantity cannot exceed the effective available quantity.
- [ ] Confirm the plus button is disabled at the available quantity.
- [ ] Clear a selected item with its remove button.
- [ ] Uncheck an equipment item to clear it.
- [ ] Select multiple equipment items.
- [ ] Submit a request with selected equipment.
- [ ] Submit a request with no equipment selected.
- [ ] View reservation details for an equipment item.
- [ ] Close the equipment reservation details modal with its close button.
- [ ] Close the equipment reservation details modal by clicking its overlay.
- [ ] See the disabled state for equipment with zero effective availability.
- [ ] Confirm unavailable equipment cannot be selected.
- [ ] See the temporary-unavailable message when availability cannot be loaded.
- [ ] See the prompt to select a date, time, and academic context before
      equipment selection is enabled.
- [ ] See the invalid-session-time message when the selected time is invalid.

### 9.7 Room and Equipment Conflict Checks

For computer-lab requests, verify that the student can:

- [ ] See a waiting state while room availability is checked.
- [ ] See a ready or idle state before enough values are selected.
- [ ] See a successful availability message when no room conflict exists.
- [ ] See a warning when another request overlaps but the room remains
      available for review.
- [ ] See a danger state when the room is already booked.
- [ ] See an error state when room conflict checking fails.
- [ ] Click **View details** when room conflicts exist.
- [ ] Review conflicting schedule details.
- [ ] Close the room conflict details modal with its close button.
- [ ] Close the room conflict details modal by clicking its overlay.
- [ ] Click **Try again** after a room conflict-check error.
- [ ] Confirm a dangerous room conflict prevents request submission.

For equipment conflicts, verify that the student can:

- [ ] See the equipment check after selecting equipment and a complete
      date/time range.
- [ ] See the checking state while equipment availability is being evaluated.
- [ ] See `Equipment check passed` when requested quantities are available.
- [ ] See a warning when overlapping requests exist without a shortage.
- [ ] See a danger state when one or more requested quantities are unavailable.
- [ ] See the per-item available-versus-requested quantities.
- [ ] Click **View details** for equipment conflicts.
- [ ] Review affected equipment, requesters, statuses, times, dates, purposes,
      shortages, and available quantities.
- [ ] Review suggested resolution options.
- [ ] Close the equipment conflict details modal with its close button.
- [ ] Close the equipment conflict details modal by clicking its overlay.
- [ ] Expand an equipment conflict with **Show requests**.
- [ ] Collapse an expanded equipment conflict with **Hide requests**.
- [ ] Review the conflicting requester details.
- [ ] Review total, available, and shortage quantities.
- [ ] Click **Refresh Data** to reload conflict information.
- [ ] Change the selected time or quantity and confirm conflict results update.
- [ ] Reduce a selected quantity to remove a shortage.
- [ ] Change the date or time to check a different reservation window.

### 9.8 Request Summary and Submission

Verify that the request summary:

- [ ] Shows that no equipment is reserved when no items are selected.
- [ ] Shows the number of selected equipment line items.
- [ ] Shows each selected equipment name and quantity.
- [ ] Lists all missing required fields when the form is incomplete.

For a new request, verify that the student can:

- [ ] Click **Clear form**.
- [ ] Confirm clearing resets room preference, equipment, date, times,
      faculty, subject, contact details, and purpose.
- [ ] Submit a complete request with a computer lab.
- [ ] Submit a complete request with a general-purpose room.
- [ ] See the `Submitting...` state during submission.
- [ ] See a success message after submission.
- [ ] See a success toast after submission.
- [ ] Confirm the form resets after a successful submission.
- [ ] Confirm the new request appears in **My Requests**.
- [ ] See a useful error message when submission fails.
- [ ] See an error toast when submission fails.
- [ ] Correct the form and resubmit after a failure.

### 9.9 My Requests Tab

On **My Requests**, verify that the student can:

- [ ] See the `My borrow requests` section.
- [ ] See loading state while requests are being loaded.
- [ ] Retry after requests fail to load.
- [ ] See the empty state when no requests have been filed.
- [ ] Review each request reference.
- [ ] Review when each request was filed.
- [ ] Review the requested room.
- [ ] Review requested equipment.
- [ ] Review date and time of use.
- [ ] Review the current request status.
- [ ] See pending, approved, borrowed, returned, rejected, and cancelled
      statuses.
- [ ] Confirm action buttons are shown only for pending requests.
- [ ] Confirm completed or rejected requests have no edit or cancel actions.

For a pending request, verify that the student can:

- [ ] Click the edit action.
- [ ] Open the request form populated with the existing request values.
- [ ] Change editable request details.
- [ ] Change the supervising faculty, subject, room, date, time, equipment,
      contact details, or purpose as applicable.
- [ ] See the `Save changes` action.
- [ ] See the `Saving...` state while changes are submitted.
- [ ] Save valid changes.
- [ ] See a success message and toast after saving.
- [ ] Return to the request list after saving.
- [ ] Confirm the updated values appear in the request list.
- [ ] Cancel editing without saving.
- [ ] Confirm cancelling edit returns to **My Requests** without changing the
      request.
- [ ] Click the cancel action for a pending request.
- [ ] See the cancellation confirmation modal.
- [ ] Close the cancellation modal without cancelling.
- [ ] Confirm cancellation with **Yes, cancel request**.
- [ ] See the `Cancelling...` state during cancellation.
- [ ] Confirm the request changes to `CANCELLED`.
- [ ] Confirm the request list reloads after cancellation.
- [ ] See an error toast if cancellation fails.

### 9.10 View Schedules Tab

On **View Schedules**, verify that the student can:

- [ ] See the `Lab Schedules` section.
- [ ] See loading state while schedules are loading.
- [ ] Retry after schedules fail to load.
- [ ] See the empty state when no schedules match.
- [ ] Search schedules by room.
- [ ] Search schedules by faculty.
- [ ] Search schedules by program.
- [ ] Search schedules by subject.
- [ ] Search schedules by day.
- [ ] Search schedules by displayed date.
- [ ] Search without regard to letter case.
- [ ] Clear the search query.
- [ ] Filter schedules by date.
- [ ] Clear the selected date filter.
- [ ] Toggle the filters control on a mobile viewport.
- [ ] See the active date-filter count.

### 9.11 Schedule Table View

In **Table View**, verify that the student can:

- [ ] Switch to **Table View**.
- [ ] Review schedule type.
- [ ] Review the day and date.
- [ ] Review the time range.
- [ ] Review the room.
- [ ] Review the subject.
- [ ] Review the program.
- [ ] Review the assigned faculty member.
- [ ] Review the academic year and term.
- [ ] Confirm search and date filters update the table.

### 9.12 Schedule Chart View

In **Chart View**, verify that the student can:

- [ ] Switch to **Chart View**.
- [ ] Review total schedules.
- [ ] Review active labs.
- [ ] Review assigned faculty count.
- [ ] Select a computer lab from the lab selector.
- [ ] See the selected lab’s schedules.
- [ ] See a message when no computer labs are available.
- [ ] See a message when the selected lab has no schedules.
- [ ] Review schedules across the weekly day columns.
- [ ] Distinguish one-time and weekly schedule blocks.
- [ ] Click a schedule block.
- [ ] Open schedule details.
- [ ] Review schedule type, time, program, subject, room, faculty, and date or
      recurring day.
- [ ] Close schedule details with the close button.
- [ ] Close schedule details by clicking the overlay.

### 9.13 Schedule Calendar View

In **Calendar View**, verify that the student can:

- [ ] Switch to **Calendar View**.
- [ ] See the current month.
- [ ] Click **Today** to return to the current month.
- [ ] Navigate to the previous month.
- [ ] Navigate to the next month.
- [ ] See days from the previous or next month in the calendar grid.
- [ ] Identify the current day.
- [ ] See schedule chips on days with schedules.
- [ ] See a `+N more` indicator when a day has more than three schedules.
- [ ] Click any calendar day.
- [ ] Open the day schedule modal.
- [ ] Review the selected date.
- [ ] Review the number of schedules on that day.
- [ ] Review all schedules for the selected day.
- [ ] See the no-schedules message for an empty day.
- [ ] Close the day modal with the close button.
- [ ] Close the day modal by clicking the overlay.

### 9.14 Student Panel Resilience and Usability

Verify that:

- [ ] The panel remains usable while request resources are loading.
- [ ] Request-resource errors show a retry action.
- [ ] Request-list errors show a retry action.
- [ ] Schedule errors show a retry action.
- [ ] Room conflict errors show a retry action.
- [ ] Equipment conflict errors do not crash the form.
- [ ] Empty request and schedule states provide useful next steps.
- [ ] Modals close by their close buttons.
- [ ] Modals close when the backdrop is clicked.
- [ ] Clicking inside a modal does not close it accidentally.
- [ ] Dropdowns close after an option is selected.
- [ ] Dropdowns close when clicking outside.
- [ ] Dropdowns close when pressing Escape.
- [ ] Long dropdown lists remain scrollable.
- [ ] The student panel works on desktop.
- [ ] The student panel works on mobile.
- [ ] The sidebar and content remain usable at narrow widths.
- [ ] Form controls are keyboard accessible.
- [ ] Navigation controls have understandable labels.
- [ ] Loading, success, warning, and error states are visible and readable.

## Suggested Test Script Organization

Organize the new test suite into these sections:

1. Landing-page navigation.
2. Login form.
3. Invalid-login scenarios.
4. Admin, faculty, and student redirects.
5. Student panel entry and shared layout.
6. Student notifications.
7. Student new-request form and validation.
8. Student equipment selection and conflict checks.
9. Student request history, editing, and cancellation.
10. Student schedule table, chart, and calendar views.
11. Session persistence, sign-out, and protected-route behavior.
12. Network, loading, empty, error, accessibility, and responsive handling.