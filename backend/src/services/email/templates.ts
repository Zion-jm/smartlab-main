import { EMAIL_LOGO_CID } from './assets';
import { MANILA_TIME_ZONE } from '../../utils/manilaTime';
export interface RequestDetails { id: string; requesterName: string; requesterRole?: string; programCode?: string | null; program?: string | null; yearLevel?: number | null; dateNeeded: string; timeStart?: string | null; timeEnd?: string | null; location?: string | null; purpose?: string | null; items: { name: string; quantity: number }[] }
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const reference = (id: string) => 'REQ-' + id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0');
export function requestUrl(id: string) {
  const origin = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid frontend URL');
  return new URL('/requests/' + encodeURIComponent(id), url.origin).toString();
}
const date = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { timeZone: MANILA_TIME_ZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-PH', { timeZone: MANILA_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
export function renderRequestEmail(title: string, message: string, req: RequestDetails, action: string, reason?: string, includeRequesterIdentity = false) {
  const url = requestUrl(req.id);
  const rows = [['Request', reference(req.id)], ['Requested by', req.requesterName], ['Room / location', req.location || 'Not specified'], ['Date', date(req.dateNeeded)], ['Time', req.timeStart && req.timeEnd ? time(req.timeStart) + ' – ' + time(req.timeEnd) : 'Not specified'], ['Purpose', req.purpose || 'Not specified']];
  if (includeRequesterIdentity && req.requesterRole) {
    const role = req.requesterRole === 'STUDENT' ? 'Student' : req.requesterRole === 'FACULTY' ? 'Faculty' : req.requesterRole === 'ADMIN' ? 'Admin' : req.requesterRole;
    const program = req.programCode || req.program;
    const studentSection = req.requesterRole === 'STUDENT'
      ? [program, req.yearLevel != null ? String(req.yearLevel) : null].filter(Boolean).join(' - ')
      : '';
    rows.splice(2, 0, ['Requester role', studentSection ? role + ' · ' + studentSection : role]);
  }
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media(max-width:480px){.content{padding:22px 18px!important}.header{padding:20px 18px!important}.detail-label,.detail-value{display:block!important;width:auto!important}.detail-label{padding:12px 0 2px!important;border-bottom:0!important}.detail-value{padding:0 0 12px!important}.title{font-size:24px!important}}</style></head>
<body style="margin:0;padding:0;background:#f5f3f1;font-family:Arial,Helvetica,sans-serif;color:#321d1d">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(title)} · ${escapeHtml(reference(req.id))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;table-layout:fixed;background:#ffffff;border:1px solid #ead7d3;border-top:4px solid #800000;border-radius:12px">
<tr><td class="header" style="padding:24px 28px;background:#fffaf6;border-bottom:1px solid #ead7d3">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="64" style="vertical-align:middle"><img src="cid:${EMAIL_LOGO_CID}" width="48" height="48" alt="PUP seal" style="display:block;border:0;background:#ffffff;border-radius:50%"></td><td style="vertical-align:middle"><strong style="font-size:22px;color:#800000">SmartLab</strong><div style="font-size:12px;line-height:20px;color:#786565">PUP Lopez Campus</div></td></tr></table>
</td></tr>
<tr><td class="content" style="padding:28px">
<p style="margin:0 0 10px;font-size:11px;line-height:18px;letter-spacing:1.4px;color:#986d3d;font-weight:bold;text-transform:uppercase">Request update</p>
<h1 class="title" style="font-size:28px;line-height:1.25;margin:0 0 14px;color:#800000">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#594747">${escapeHtml(message)}</p>
${reason ? `<div style="margin:0 0 24px;padding:14px 16px;background:#fff5f3;border-left:3px solid #800000;border-radius:4px"><strong style="font-size:13px;color:#800000">Reason</strong><p style="margin:6px 0 0;font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(reason)}</p></div>` : ''}
<h2 style="font-size:15px;margin:0;padding:0 0 10px;border-bottom:2px solid #caa88c;color:#321d1d">Request details</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;font-size:14px;line-height:1.6">${rows.map(([label,value])=>`<tr><td class="detail-label" style="width:125px;padding:12px 12px 12px 0;vertical-align:top;color:#786565;border-bottom:1px solid #eee6e2">${escapeHtml(label)}</td><td class="detail-value" style="padding:12px 0;vertical-align:top;border-bottom:1px solid #eee6e2;overflow-wrap:anywhere;word-wrap:break-word">${escapeHtml(value)}</td></tr>`).join('')}</table>
${req.items.length ? `<h2 style="font-size:15px;margin:26px 0 12px;color:#321d1d">Equipment <span style="font-size:12px;font-weight:normal;color:#786565">· ${req.items.length} item type${req.items.length === 1 ? '' : 's'}</span></h2><table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;border-collapse:collapse;font-size:14px;line-height:1.5"><tr><th scope="col" style="text-align:left;padding:10px 12px;background:#faf3ef;color:#800000;font-size:12px">Item</th><th scope="col" width="48" style="padding:10px 8px;background:#faf3ef;color:#800000;font-size:12px">Qty</th></tr>${req.items.map(i=>`<tr><td style="padding:12px;border-bottom:1px solid #eee6e2;overflow-wrap:anywhere">${escapeHtml(i.name)}</td><td style="padding:12px 8px;text-align:center;border-bottom:1px solid #eee6e2;font-weight:bold">${escapeHtml(i.quantity)}</td></tr>`).join('')}</table>` : ''}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 16px"><tr><td bgcolor="#800000" style="border-radius:8px;text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;border:1px solid #800000;border-radius:8px;font-size:14px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(action)} &rarr;</a></td></tr></table>
<p style="margin:0;font-size:12px;line-height:1.6;color:#786565">Sign in with your SmartLab account to view current details.<br>All schedule times are in Philippine time.</p>
</td></tr><tr><td style="padding:18px 24px;background:#faf7f5;border-top:1px solid #eadfd9;font-size:12px;line-height:1.6;color:#786565"><strong style="color:#594747">SmartLab · PUP Lopez Campus</strong><br>This is an automated notification. For assistance, contact your laboratory administrator.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title,message,reason ? 'Reason: '+reason : '',...rows.map(([k,v])=>k+': '+v),...req.items.map(i=>i.name+' ×'+i.quantity),action+': '+url,'Times are Philippine time.'].filter(Boolean).join('\n');
  return { html, text };
}
