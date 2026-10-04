import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { borrowRequestApi } from '../services/api';
import MyRequestDetailModal from '../features/requests/MyRequestDetailModal';
import { normalizeBorrowRequest, type RequestRow } from '../features/requests/requestModels';
export default function RequestLinkPage() {
  const { id = '' } = useParams();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const adminReview = params.get('review') === 'admin';
  const wrongAccount = adminReview && user?.role !== 'ADMIN';
  const returnPath = '/requests/' + encodeURIComponent(id) + (adminReview ? '?review=admin' : '');
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!user || wrongAccount || user.role === 'ADMIN') return;
    let active = true;
    borrowRequestApi.getById(id).then(({ data }) => { if (active) setRequest(normalizeBorrowRequest(data.request)); }).catch(() => { if (active) setError('This request is unavailable or you do not have access. It may be outside the active academic period.'); });
    return () => { active = false; };
  }, [id, user, wrongAccount]);
  if (!user) return <Navigate to={'/?returnTo=' + encodeURIComponent(returnPath)} replace />;
  const home = user.role === 'ADMIN' ? '/admin/requests' : user.role === 'FACULTY' ? '/faculty/panel' : '/student/panel';
  if (wrongAccount) return <main className="flex min-h-dvh items-center justify-center bg-[#faf7f5] p-4"><section className="w-full max-w-md rounded-2xl border border-[#ead7d3] bg-white p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-[#800000]">Administrator access required</p>
    <h1 className="mt-3 text-xl font-bold text-[#321d1d]">Switch accounts to review this request</h1>
    <p className="mt-3 text-sm leading-6 text-[#786565]">You’re signed in as {user.role === 'FACULTY' ? 'Faculty' : 'Student'} ({user.email}). Sign in with an administrator account to approve or decline requests.</p>
    <button type="button" className="mt-5 min-h-11 w-full rounded-xl bg-[#800000] px-4 py-3 font-semibold text-white" onClick={() => { logout(); navigate('/?returnTo=' + encodeURIComponent(returnPath), { replace: true }); }}>Switch account</button>
    <Link className="mt-3 block py-3 text-center text-sm font-semibold text-[#800000]" to={home}>Return to my dashboard</Link>
  </section></main>;
  if (user.role === 'ADMIN') return <Navigate to="/admin/requests" state={{ reviewRequestId: id }} replace />;
  if (closed) return <Navigate to={home} replace />;
  return <main className="min-h-dvh bg-[#faf7f5] p-6"><Link to={home} className="font-semibold text-[#800000]">Open workspace</Link><p role="status" className="mt-6">{error || (request ? 'Request details' : 'Loading request…')}</p>{request && <MyRequestDetailModal request={request} onClose={() => setClosed(true)} />}</main>;
}
