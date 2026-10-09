import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
export default function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  return <main className="flex min-h-dvh items-center justify-center bg-[#faf7f5] p-5"><section className="w-full max-w-md overflow-hidden rounded-2xl border border-[#ead7d3] bg-white p-6 shadow-sm sm:p-8">
    <div className="mb-6 flex items-center gap-3"><img src="/PUPLogo.png" alt="PUP seal" className="h-12 w-12"/><div><p className="text-xl font-bold text-[#800000]">SmartLab</p><p className="text-xs text-[#786565]">PUP Lopez Campus</p></div></div>
    <h1 className="text-2xl font-bold text-[#321d1d]">{reset ? 'Choose a new password' : 'Forgot your password?'}</h1>
    <p className="mt-2 mb-5 text-sm leading-6 text-[#786565]">{reset ? 'Use at least 8 characters. Your existing sessions will be signed out.' : 'Enter your registered email and we’ll send you a reset link.'}</p>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success ? <p role="status" className="rounded-lg bg-green-50 p-4 text-sm leading-6 text-green-800">{success}</p> : reset && !token ? <p role="alert" className="text-sm text-red-800">This reset link is missing or invalid. Request a new link below.</p> : <form onSubmit={async e=>{e.preventDefault();setError('');if(reset && password!==confirm){setError('The passwords do not match.');return;}setBusy(true);try{const {data}=reset ? await authApi.resetPassword({token,password}) : await authApi.forgotPassword(email);setSuccess(data.message);setPassword('');setConfirm('');if(reset) window.history.replaceState(null,'','/reset-password');}catch(err){setError((err as {response?:{data?:{error?:string}}}).response?.data?.error || 'Unable to complete this request. Please try again.');}finally{setBusy(false);}}} className="space-y-4">
      {reset ? <><label className="block text-sm font-semibold">New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#d8c7c3] px-3"/></label><label className="block text-sm font-semibold">Confirm new password<input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#d8c7c3] px-3"/></label></> : <label className="block text-sm font-semibold">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#d8c7c3] px-3"/></label>}
      <button disabled={busy} className="min-h-11 w-full rounded-lg bg-[#800000] px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : reset ? 'Reset password' : 'Send reset link'}</button>
    </form>}
    <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm font-semibold text-[#800000]"><Link to="/#login">Back to sign in</Link>{reset && !success && <Link to="/forgot-password">Request a new link</Link>}</div>
  </section></main>;
}
