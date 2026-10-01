import { transporter, FROM } from './transporter';
import {
  wrap,
  badge,
  divider,
  ctaButton,
  requestDetailBlock,
  type RequestDetails,
} from './templates';

export type { RequestDetails };
export { verifyEmailTransport } from './transporter';

// 1. Request Submitted — goes to the requester
export const sendRequestSubmittedEmail = async (
  to: string,
  req: RequestDetails
): Promise<void> => {
  const html = wrap(`
    <p style="margin:0 0 6px;font-size:13px;color:#7a7068;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Borrow Request</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1a1a1a;">Request Submitted</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b6b;">Your borrow request has been received and is pending admin review.</p>

    ${badge('PENDING REVIEW', 'PENDING')}
    ${divider}
    ${requestDetailBlock(req)}
    ${divider}
    <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.6;">
      You'll receive another notification once an administrator reviews your request.
      If you need to cancel this request, you can do so from the SmartLab portal.
    </p>
    ${ctaButton('View My Requests')}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[SmartLab] Request Received — #${req.id.slice(-8).toUpperCase()}`,
    html,
  });
};

// 2. Request Approved — goes to the requester
export const sendRequestApprovedEmail = async (
  to: string,
  req: RequestDetails
): Promise<void> => {
  const html = wrap(`
    <p style="margin:0 0 6px;font-size:13px;color:#7a7068;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Borrow Request Update</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1a1a1a;">Request Approved ✓</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b6b;">Great news! Your borrow request has been approved by the lab administrator.</p>

    ${badge('APPROVED', 'APPROVED')}
    ${divider}
    ${requestDetailBlock(req)}
    ${divider}
    <div style="background:#d1e7dd;border-left:4px solid #0a5c36;border-radius:6px;padding:14px 18px;margin-top:4px;">
      <p style="margin:0;font-size:14px;color:#0a5c36;font-weight:600;">Next step: Equipment Pickup</p>
      <p style="margin:6px 0 0;font-size:13px;color:#0a5c36;line-height:1.5;">
        Please visit the laboratory on your scheduled date to collect the equipment.
        Bring your student/faculty ID and present this approval notification.
      </p>
    </div>
    ${ctaButton('View My Requests')}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[SmartLab] Request Approved ✓ — #${req.id.slice(-8).toUpperCase()}`,
    html,
  });
};

// 3. Request Rejected — goes to the requester
export const sendRequestRejectedEmail = async (
  to: string,
  req: RequestDetails,
  reason: string
): Promise<void> => {
  const html = wrap(`
    <p style="margin:0 0 6px;font-size:13px;color:#7a7068;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Borrow Request Update</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1a1a1a;">Request Declined</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b6b;">Unfortunately, your borrow request could not be approved at this time.</p>

    ${badge('DECLINED', 'REJECTED')}
    ${divider}
    ${requestDetailBlock(req)}
    ${divider}
    <div style="background:#f8d7da;border-left:4px solid #842029;border-radius:6px;padding:14px 18px;margin-top:4px;">
      <p style="margin:0;font-size:14px;color:#842029;font-weight:600;">Reason for Decline</p>
      <p style="margin:6px 0 0;font-size:13px;color:#842029;line-height:1.5;">${reason}</p>
    </div>
    <p style="margin:20px 0 0;font-size:14px;color:#6b6b6b;line-height:1.6;">
      You may submit a new request with updated details or contact the lab administrator
      for further assistance.
    </p>
    ${ctaButton('Submit New Request')}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[SmartLab] Request Declined — #${req.id.slice(-8).toUpperCase()}`,
    html,
  });
};

// 4. Equipment Borrowed / Picked Up — goes to the requester
export const sendEquipmentBorrowedEmail = async (
  to: string,
  req: RequestDetails
): Promise<void> => {
  const html = wrap(`
    <p style="margin:0 0 6px;font-size:13px;color:#7a7068;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Borrow Request Update</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1a1a1a;">Equipment Picked Up</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b6b;">The equipment for your request has been marked as borrowed. Please take good care of the items.</p>

    ${badge('BORROWED', 'BORROWED')}
    ${divider}
    ${requestDetailBlock(req)}
    ${divider}
    <div style="background:#cfe2ff;border-left:4px solid #084298;border-radius:6px;padding:14px 18px;margin-top:4px;">
      <p style="margin:0;font-size:14px;color:#084298;font-weight:600;">Return Reminder</p>
      <p style="margin:6px 0 0;font-size:13px;color:#084298;line-height:1.5;">
        Please ensure all borrowed equipment is returned to the laboratory in good condition
        on or before the scheduled date. Late or damaged returns may affect future borrowing privileges.
      </p>
    </div>
    ${ctaButton('View My Requests')}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[SmartLab] Equipment Borrowed — #${req.id.slice(-8).toUpperCase()}`,
    html,
  });
};

// 5. Equipment Returned — goes to the requester
export const sendEquipmentReturnedEmail = async (
  to: string,
  req: RequestDetails
): Promise<void> => {
  const html = wrap(`
    <p style="margin:0 0 6px;font-size:13px;color:#7a7068;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Borrow Request Update</p>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1a1a1a;">Return Confirmed ✓</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b6b;">The equipment has been successfully returned and logged in the system. Thank you!</p>

    ${badge('RETURNED', 'RETURNED')}
    ${divider}
    ${requestDetailBlock(req)}
    ${divider}
    <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.6;">
      This transaction is now complete. Your borrowing history has been updated.
      Feel free to submit a new borrow request any time from the SmartLab portal.
    </p>
    ${ctaButton('Go to SmartLab')}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[SmartLab] Return Confirmed ✓ — #${req.id.slice(-8).toUpperCase()}`,
    html,
  });
};
