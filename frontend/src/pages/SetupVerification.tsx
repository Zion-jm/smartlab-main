import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { setupRequest, setupError } from '../services/setupApi';
import './SetupPreview.css';

export default function SetupVerification() {
  // Strip the secret fragment immediately; never put it in storage or query strings.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="setup-preview"><section className="setup-verification-page">
    <img src="/PUPLogo.png" alt="PUP seal" width={48} height={48} />
    <h1>Verify your administrator email</h1>
    {done ? <><CheckCircle2 size={32} aria-hidden="true" /><p role="status">Email verified. Return to your original setup tab and select “Check verification”.</p></> : <>
      <Mail size={32} aria-hidden="true" /><p>Confirm this address for your new SmartLab installation.</p>
      {!token ? <p role="alert">The verification link is missing. Request a new link from your setup tab.</p> : <button className="setup-primary" disabled={busy} onClick={async () => {
        setBusy(true); setError(''); window.history.replaceState(null, '', window.location.pathname);
        try { await setupRequest('verify', {token}); setDone(true); } catch(e) { setError(setupError(e)); } finally { setBusy(false); }
      }}>{busy ? 'Verifying…' : 'Verify email'}</button>}
    </>}
    {error && <p role="alert" className="setup-error">{error}</p>}
    <Link to="/">Back to sign in</Link>
  </section></main>;
}
