import path from 'node:path';

export const EMAIL_LOGO_CID = 'pup-logo@smartlab';

export function emailAttachments(html: string) {
  return html.includes(`cid:${EMAIL_LOGO_CID}`) ? [{
    filename: 'pup-logo.png',
    path: path.resolve(__dirname, '../../../assets/email/pup-logo.png'),
    cid: EMAIL_LOGO_CID,
    contentType: 'image/png',
    contentDisposition: 'inline' as const,
  }] : [];
}
