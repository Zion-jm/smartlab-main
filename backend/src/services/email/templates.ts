import { MANILA_TIME_ZONE } from '../../utils/manilaTime';
// ─── Shared layout ────────────────────────────────────────────────────────────

export const wrap = (bodyHtml: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SmartLab Notification</title>
</head>
<body style="margin:0;padding:0;background:#f4f0eb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0eb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#7a0c2e;padding:32px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                      &#9728; SmartLab
                    </div>
                    <div style="font-size:12px;color:#f5c6d0;margin-top:2px;letter-spacing:0.3px;">
                      PUP Lopez Campus — Laboratory Management System
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f6f2;border-top:1px solid #ede8e0;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9a8c7e;line-height:1.6;">
                This is an automated message from <strong>SmartLab 2.0</strong>. Please do not reply to this email.
                For assistance, contact the lab administrator at
                <a href="mailto:pupsmartlab@gmail.com" style="color:#7a0c2e;text-decoration:none;">pupsmartlab@gmail.com</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  PENDING:  'background:#fff3cd;color:#856404;',
  APPROVED: 'background:#d1e7dd;color:#0a5c36;',
  REJECTED: 'background:#f8d7da;color:#842029;',
  BORROWED: 'background:#cfe2ff;color:#084298;',
  RETURNED: 'background:#e2e3e5;color:#383d41;',
};

export const badge = (label: string, status: string) => {
  const style = BADGE_STYLES[status] || 'background:#e2e3e5;color:#383d41;';
  return `<span style="${style}font-size:13px;font-weight:700;padding:4px 14px;border-radius:20px;display:inline-block;">${label}</span>`;
};

// ─── Equipment table ───────────────────────────────────────────────────────────

export interface EquipmentItem {
  name: string;
  quantity: number;
}

export const equipmentTable = (items: EquipmentItem[]) => {
  if (!items.length) return '';
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 14px;font-size:14px;color:#2d2d2d;border-bottom:1px solid #f0ebe4;">${item.name}</td>
        <td style="padding:10px 14px;font-size:14px;color:#2d2d2d;text-align:center;border-bottom:1px solid #f0ebe4;font-weight:600;">${item.quantity}</td>
      </tr>`
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border:1px solid #ede8e0;border-radius:8px;overflow:hidden;">
      <tr style="background:#f9f6f2;">
        <th style="padding:10px 14px;font-size:12px;color:#7a7068;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Equipment</th>
        <th style="padding:10px 14px;font-size:12px;color:#7a7068;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
      </tr>
      ${rows}
    </table>`;
};

// ─── Info row helper ───────────────────────────────────────────────────────────

export const infoRow = (label: string, value: string | null | undefined) => {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#7a7068;width:130px;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-size:13px;color:#2d2d2d;font-weight:500;">${value}</td>
    </tr>`;
};

// ─── CTA button ────────────────────────────────────────────────────────────────

export const ctaButton = (text: string) => `
  <div style="margin-top:28px;">
    <a href="https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/login"
       style="display:inline-block;background:#7a0c2e;color:#ffffff;font-size:14px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
      ${text}
    </a>
  </div>`;

// ─── Shared request detail block ───────────────────────────────────────────────

export interface RequestDetails {
  id: string;
  requesterName: string;
  dateNeeded: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  location?: string | null;
  purpose?: string | null;
  items: EquipmentItem[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { timeZone: MANILA_TIME_ZONE, hour: '2-digit', minute: '2-digit' });

export const requestDetailBlock = (req: RequestDetails) => {
  const timeStr =
    req.timeStart && req.timeEnd
      ? `${formatTime(req.timeStart)} – ${formatTime(req.timeEnd)}`
      : null;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
      ${infoRow('Request ID', `#${req.id.slice(-8).toUpperCase()}`)}
      ${infoRow('Requested by', req.requesterName)}
      ${infoRow('Date needed', formatDate(req.dateNeeded))}
      ${timeStr ? infoRow('Time slot', timeStr) : ''}
      ${infoRow('Location', req.location)}
      ${infoRow('Purpose', req.purpose)}
    </table>
    ${req.items.length ? `<p style="margin:20px 0 6px;font-size:13px;color:#7a7068;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Equipment Requested</p>${equipmentTable(req.items)}` : ''}`;
};

// ─── Divider ───────────────────────────────────────────────────────────────────

export const divider = `<hr style="border:none;border-top:1px solid #ede8e0;margin:24px 0;" />`;
