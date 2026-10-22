import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { authApi } from '../services/api';

export default function AccountActivationPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
    let live = true;
    authApi.inspectInvitation(token).then(({ data }) => { if (live) setEmail(data.email); }).catch(() => { if (live) setError('This invitation is invalid or expired. Reopen the link in your email or ask your laboratory administrator for a new invitation.'); }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; meta.remove(); };
  }, [token]);
  const passwordValid = password.length >= 8 && new TextEncoder().encode(password).length <= 72;
  return <main className="flex min-h-screen items-center justify-center bg-[#faf7f5] p-5"><section className="w-full max-w-md rounded-2xl border border-[#ead7d3] bg-white p-7 shadow-sm">
    <p className="text-sm font-semibold text-[#800000]">Smartlab</p><h1 className="mt-3 text-2xl font-bold">Set up your account</h1>
    {checking ? <p role="status" className="mt-4">Checking your invitation...</p> : success ? <p role="status" className="mt-4 rounded-lg bg-green-50 p-4 text-green-800">Your email is verified and your account is ready. Sign in with your new password.</p> : <>
      {email && <><p className="my-4 text-sm text-gray-600">Choose a password for {email}. Your administrator will not receive your password.</p><form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); if (busy) return; setError('');
        if (!passwordValid) { setError('Use at least 8 characters. Shorten your password if it is too long.'); return; }
        if (password !== confirm) { setError('The passwords do not match.'); return; }
        setBusy(true);
        try { await authApi.acceptInvitation(token, password, confirm); setPassword(''); setConfirm(''); setSuccess(true); }
        catch (failure) { setError(isAxiosError(failure) ? failure.response?.data?.error || 'Unable to set up your account. Please try again.' : 'Unable to set up your account. Please try again.'); }
        finally { setBusy(false); }
      }}>
        <label className="block text-sm font-semibold">Password<input required disabled={busy} type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} aria-describedby="invitation-password-help" className="mt-1 block w-full rounded-lg border p-3" /></label>
        <p id="invitation-password-help" className="text-xs text-gray-600">Use at least 8 characters. A longer, unique password is best.</p>
        {password && !passwordValid && <p className="text-xs text-red-700">{password.length < 8 ? 'Add more characters to reach 8.' : 'This password is too long. Please shorten it.'}</p>}
        <label className="block text-sm font-semibold">Confirm password<input required disabled={busy} type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Show passwords</label>
        <button disabled={busy} className="min-h-11 w-full rounded-lg bg-[#800000] p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Setting up account...' : 'Set password and activate'}</button>
      </form></>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </>}
    <Link className="mt-5 inline-block text-sm font-semibold text-[#800000] underline" to="/#login">Sign in</Link>
  </section></main>;
}
