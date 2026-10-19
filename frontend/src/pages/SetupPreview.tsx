import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, GraduationCap, Mail, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import './SetupPreview.css';
import { setupRequest, setupError } from '../services/setupApi';
import { Link } from 'react-router-dom';

const steps = ['Welcome', 'Administrator', 'Verify email', 'Academic period', 'Review'];

export default function SetupPreview({ live = false }: { live?: boolean }) {
  const [setupToken, setSetupToken] = useState('');
  const [session, setSession] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [name, setName] = useState(live ? '' : 'Alex Reyes');
  const [email, setEmail] = useState(live ? '' : 'admin@example.com');
  const [password, setPassword] = useState(live ? '' : 'SampleOnly123!');
  const [confirm, setConfirm] = useState(live ? '' : 'SampleOnly123!');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const passwordBytes = new TextEncoder().encode(password).length;
  const passwordValid = password.length >= 8 && passwordBytes <= 72;
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const [year, setYear] = useState('2026');
  const [term, setTerm] = useState('1st Semester');
  const [error, setError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [resent, setResent] = useState(false);
  const verified = verifiedEmail === email;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step, complete]);
  const period = `${year}–${Number(year) + 1} · ${term}`;
  async function checkVerification() {
    setBusy(true); setError('');
    try { const result = await setupRequest<{verified:boolean}>('progress', {}, setupToken, session);
      if (result.verified) setVerifiedEmail(email); else setError('Email is not verified yet. Open the link in your inbox, then check again.');
    } catch(e) { setError(setupError(e)); } finally { setBusy(false); }
  }
  const go = (next: number) => { setError(''); setStep(next); };

  return <main className="setup-preview">
    <header className="setup-brand"><div><img src="/PUPLogo.png" alt="PUP seal" /><span><strong>Smartlab</strong><small>PUP Lopez Campus</small></span></div><span className="setup-badge">{live ? 'First-time setup' : 'Design preview'}</span></header>
    <div className="setup-shell">
      <aside className="setup-intro">
        <span className="setup-eyebrow">A good place to begin</span>
        <h1>Your laboratory.<br />Ready for a new term.</h1>
        <p>Set up your administrator, verify your email, and choose your academic period.</p>
        <ol aria-label="Setup progress">{steps.map((label, index) => <li key={label} aria-current={!complete && step === index ? 'step' : undefined} className={complete || index < step ? 'is-done' : step === index ? 'is-current' : ''}><span>{complete || index < step ? <Check size={16} aria-hidden="true" /> : index + 1}</span><div>{label}<small>{['Get acquainted', 'Your first account', 'Confirm your address', 'Start with the right term', 'Check the details'][index]}</small></div></li>)}</ol>
        <p className="setup-footnote"><ShieldCheck size={18} aria-hidden="true" /> {live ? 'For new installations only.' : 'Sample data only. Nothing is saved or sent.'}</p>
      </aside>
      <section className="setup-content" aria-labelledby="setup-title">
        <div className="setup-step-label">{complete ? (live ? 'Setup complete' : 'Preview complete') : `Step ${step + 1} of ${steps.length}`}</div>
        <h2 id="setup-title" ref={heading} tabIndex={-1}>{complete ? 'You’re ready to get started.' : ['Welcome to SmartLab', 'Create your administrator', 'Verify your email', 'Set your academic period', 'Everything look right?'][step]}</h2>
        <p className="setup-description">{complete ? 'Here’s a summary of the details you reviewed.' : ['Bring your laboratory schedules, equipment, and requests into one place.', 'Choose the account that will manage your laboratory.', 'Confirm your address to keep your account accessible.', 'Requests and schedules will be organized under this period.', 'Review your details. You can edit them before finishing.'][step]}</p>
        {complete ? <div className="setup-completion">
          <div className="setup-verification-card is-confirmed">
            <div className="setup-verification-heading"><div className="setup-mail-icon"><CheckCircle2 size={24} aria-hidden="true" /></div><div><h3>All steps reviewed</h3><p>{live ? 'Your installation is ready.' : 'Your setup preview is complete.'}</p></div></div>
            <dl className="setup-completion-details"><div><dt>Administrator</dt><dd>{name}<small>{email}</small></dd></div><div><dt>Academic period</dt><dd>{period}</dd></div></dl>
          </div>
          <div className="setup-next"><h3>What comes next</h3><p>{live ? 'You can now:' : 'After a real setup, you can:'}</p><ul><li><Check size={16} aria-hidden="true" /> Add programs and laboratory rooms</li><li><Check size={16} aria-hidden="true" /> Build your equipment inventory</li><li><Check size={16} aria-hidden="true" /> Invite faculty and students</li></ul></div>
          <footer className="setup-actions"><span>{live ? 'Sign in with your new administrator account.' : 'Preview only. Nothing was saved.'}</span>{live ? <Link className="setup-primary" to="/#login">Go to sign in<ArrowRight size={16} aria-hidden="true" /></Link> : <button className="setup-primary" onClick={() => { setComplete(false); setVerifiedEmail(''); setResent(false); go(0); }}>Explore again<ArrowRight size={16} aria-hidden="true" /></button>}</footer>
        </div> : <form aria-busy={busy} onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          if (step === 1 && (!name.trim() || !passwordValid || !passwordsMatch)) { setError(!name.trim() ? 'Enter an administrator name.' : !passwordValid ? (passwordBytes > 72 ? 'Your password is too long. Try a shorter one.' : 'Use at least 8 characters.') : 'The passwords do not match.'); return; }
          setShowPassword(false); setShowConfirm(false);
          if ((step === 2 || step === 4) && !verified) { setError('Preview opening the verification link before continuing.'); return; }
          setError('');
          setBusy(true);
          try {
            if (live && step === 0) await setupRequest('access', {}, setupToken);
            if (live && step === 1) {
              const signature = JSON.stringify([name, email, password]);
              if (signature !== submitted || !session) {
                const result = await setupRequest<{session:string;email:string}>('begin', {name,email,password}, setupToken);
                setSession(result.session); setSubmitted(signature); setVerifiedEmail(''); setResent(false);
              }
            }
            if (live && step === 4) await setupRequest('finish', {year:Number(year),term:term === 'Summer' ? 'Summer Term' : term}, setupToken, session);
            if (step === 4) { setPassword(''); setConfirm(''); setSubmitted(''); setSetupToken(''); setSession(''); setComplete(true); } else setStep(step + 1);
          } catch(e) { setError(setupError(e)); } finally { setBusy(false); }
        }}>
          <fieldset disabled={busy} className="setup-fields">
            {step === 0 && <><div className="setup-feature"><ShieldCheck aria-hidden="true" /><div><h3>Your administrator account</h3><p>Manage access, approvals, and system preferences.</p></div></div><div className="setup-feature"><GraduationCap aria-hidden="true" /><div><h3>Your academic period</h3><p>Keep requests and schedules connected to the right term.</p></div></div><div className="setup-note">Add programs, rooms, and equipment afterward.</div>{live && <label>Private setup token<input type="password" required minLength={32} maxLength={512} value={setupToken} onChange={e => setSetupToken(e.target.value)} autoComplete="off" /><span className="setup-hint">Ask the person deploying SmartLab for this token. Keep this tab open until setup is finished.</span></label>}</>}
            {step === 1 && <><label>Full name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label><label>Email address<input required type="email" maxLength={254} value={email} onChange={e => { setEmail(e.target.value); setVerifiedEmail(''); setResent(false); }} autoComplete="off" /></label><div className="setup-columns">
              <div><label htmlFor="setup-password">Password</label><div className="setup-password-input"><input id="setup-password" required type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} autoComplete="new-password" aria-describedby="setup-password-rules" aria-invalid={password.length > 0 && !passwordValid} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div></div>
              <div><label htmlFor="setup-confirm">Confirm password</label><div className="setup-password-input"><input id="setup-confirm" required type={showConfirm ? 'text' : 'password'} minLength={8} maxLength={72} value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} autoComplete="new-password" aria-describedby="setup-password-match" aria-invalid={confirm.length > 0 && !passwordsMatch} /><button type="button" aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirm} onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div></div>
            </div>
            <div className="setup-validation"><ul id="setup-password-rules" className="setup-password-rules">
              <li className={password.length >= 8 ? 'is-valid' : ''}>{password.length >= 8 ? '✓' : '○'} Use at least 8 characters</li>
            </ul>
            {passwordBytes > 72 && <p role="alert" className="setup-error">Your password is too long. Try a shorter one.</p>}
            <p id="setup-password-match" role="status" className={passwordsMatch ? 'setup-password-match is-valid' : 'setup-password-match'}>{confirm.length === 0 ? 'Re-enter your password to confirm it.' : passwordsMatch ? '✓ Passwords match' : 'Passwords do not match yet.'}</p>
            </div><p className="setup-hint">{live ? 'Use a unique password for this account.' : 'Preview only. Use sample account details.'}</p></>}
            {step === 2 && <div className="setup-verification">
              <div className={`setup-verification-card${verified ? ' is-confirmed' : ''}`}>
                <div className="setup-verification-heading">
                  <div className="setup-mail-icon">{verified ? <CheckCircle2 size={24} aria-hidden="true" /> : <Mail size={24} aria-hidden="true" />}</div>
                  <div><h3>{verified ? 'Email verified' : 'Check your inbox'}</h3><p>{verified ? 'Ready for the next step.' : 'Open the verification link to continue.'}</p></div>
                </div>
                <div className="setup-email-row"><div><span>Email address</span><strong>{email}</strong></div><button className="setup-email-edit" type="button" onClick={() => go(1)}>Change<span className="sr-only"> email address</span></button></div>
              </div>
              {!verified && <div className="setup-verification-controls">
                <button className="setup-primary" type="button" onClick={() => { if (live) { void checkVerification(); } else { setVerifiedEmail(email); setError(''); } }}>{live ? 'Check verification' : 'Try verification link'}</button>
                <button className="setup-email-edit" type="button" onClick={async () => { if (!live) { setResent(true); return; } setBusy(true); setError(''); try { await setupRequest('resend', {}, setupToken, session); setResent(true); } catch(e) { setError(setupError(e)); } finally { setBusy(false); } }}>Resend link</button>
              </div>}
              <p className="setup-verification-caption" role="status">{live ? (verified ? 'Email verified. Continue to your academic period.' : resent ? 'A new link is queued. Only the newest link will work.' : 'A verification link is queued for delivery. Check your inbox and spam folder. It expires in 30 minutes.') : verified ? 'Verified in this preview only. No email was sent.' : resent ? 'Resend previewed. Use “Try verification link” to continue.' : 'Preview only — no email is sent. Try the link above to see the verified state.'}</p>
            </div>}
            {step === 3 && <><div className="setup-columns"><label>Starting year<input required type="number" min={2000} max={2099} value={year} onChange={e => setYear(e.target.value)} /></label><label>Semester<select value={term} onChange={e => setTerm(e.target.value)}><option>1st Semester</option><option>2nd Semester</option><option>Summer</option></select></label></div><div className="setup-period"><span className="setup-eyebrow">Selected academic period</span><strong>{year ? period : 'Choose a starting year'}</strong><span>You can add future periods later.</span></div></>}
            {step === 4 && <><div className="setup-review"><div><h3>Administrator</h3><button type="button" onClick={() => go(1)}>Edit<span className="sr-only"> administrator</span></button></div><p>{name}</p><p>{email}</p><div className="setup-review-status"><CheckCircle2 size={14} aria-hidden="true" /><small>Email verified · Password set</small></div></div><div className="setup-review"><div><h3>Academic period</h3><button type="button" onClick={() => go(3)}>Edit<span className="sr-only"> academic period</span></button></div><p>{period}</p></div><div className="setup-note">{live ? 'Finish setup to create your administrator and active academic period.' : 'Preview only. Finishing won’t create an account or change your system.'}</div></>}
          </fieldset>
          {error && <p role="alert" className="setup-error">{error}</p>}
          <footer className="setup-actions">{step > 0 ? <button className="setup-back" type="button" disabled={busy} onClick={() => go(step - 1)}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : <span>Five simple steps.</span>}<button className="setup-primary" type="submit" disabled={busy || (step === 2 && !verified)}>{busy ? 'Please wait…' : step === 0 ? 'Start setup' : step === 4 ? (live ? 'Finish setup' : 'Finish preview') : 'Continue'}<ArrowRight size={16} aria-hidden="true" /></button></footer>
        </form>}
      </section>
    </div>
    <p className="setup-caption">SmartLab · Laboratory management, made simpler.</p>
  </main>;
}
