import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { userApi } from '../../services/api';
import type { Account } from '../../types/account';

type Invitation = { expiresAt: string; usedAt: string | null; revokedAt: string | null; delivery: string };
export default function InvitationActions({ account, onUpdated }: { account: Account; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(account.email);
  const [info, setInfo] = useState<Invitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    userApi.invitationInfo(account.id).then(({ data }) => { if (live) setInfo(data.invitation); }).catch(() => { if (live) setMessage('Could not load invitation status.'); });
    return () => { live = false; };
  }, [open, account.id]);
  const run = async (action: 'resend' | 'email' | 'cancel' | 'reinvite') => {
    if (busy) return;
    if (action === 'cancel' && !window.confirm('Cancel this invitation? The user will not be able to activate this account.')) return;
    setBusy(true); setMessage('');
    try { const { data } = await userApi.invitationAction(account.id, action, email); setMessage(data.message); onUpdated(); const response = await userApi.invitationInfo(account.id); setInfo(response.data.invitation); }
    catch (error) { setMessage(isAxiosError(error) ? error.response?.data?.error || 'Unable to update invitation.' : 'Unable to update invitation.'); }
    finally { setBusy(false); }
  };
  if (account.activationState === 'CANCELLED') return <div><button type="button" disabled={busy} onClick={() => void run('reinvite')} className="min-h-11 text-xs font-semibold text-[#800000]">Send new invitation</button><p role="status" className="text-xs">{busy ? 'Queuing invitation...' : message}</p></div>;
  return <div className="text-left"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-11 rounded-lg border border-[#ead7d3] px-3 text-xs font-semibold text-[#800000]">Invitation options</button>
    {open && <div className="mt-2 w-64 max-w-full space-y-2 rounded-xl border bg-white p-3">
      <p className="text-xs">{info ? `${new Date(info.expiresAt) <= new Date() ? 'Expired' : 'Pending activation'} · ${info.delivery === 'SENT' ? 'Sent to provider' : info.delivery.toLowerCase()}` : 'Loading status...'}</p>
      <label className="block text-xs">Email<input type="email" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <button type="button" disabled={busy} onClick={() => void run('email')} className="min-h-11 text-xs font-semibold text-[#800000]">Correct email and send new link</button>
      <button type="button" disabled={busy} onClick={() => void run('resend')} className="block min-h-11 text-xs font-semibold text-[#800000]">Resend invitation</button>
      <button type="button" disabled={busy} onClick={() => void run('cancel')} className="block min-h-11 text-xs text-red-700">Cancel invitation</button>
      <p role="status" className="text-xs">{busy ? 'Updating invitation...' : message}</p>
    </div>}
  </div>;
}
