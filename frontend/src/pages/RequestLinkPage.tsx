import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { borrowRequestApi } from '../services/api';
import MyRequestDetailModal from '../features/requests/MyRequestDetailModal';
import { normalizeBorrowRequest, type RequestRow } from '../features/requests/requestModels';
export default function RequestLinkPage() {
  const { id = '' } = useParams();
  const user = useAuthStore(s => s.user);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    borrowRequestApi.getById(id).then(({ data }) => { if (active) setRequest(normalizeBorrowRequest(data.request)); }).catch(() => { if (active) setError('This request is unavailable or you do not have access. It may be outside the active academic period.'); });
    return () => { active = false; };
  }, [id, user]);
  if (!user) return <Navigate to={'/?returnTo=' + encodeURIComponent('/requests/' + id)} replace />;
  const home = user.role === 'ADMIN' ? '/admin/requests' : user.role === 'FACULTY' ? '/faculty/panel' : '/student/panel';
  if (closed) return <Navigate to={home} replace />;
  return <main className="min-h-dvh bg-[#faf7f5] p-6"><Link to={home} className="font-semibold text-[#800000]">Open workspace</Link><p role="status" className="mt-6">{error || (request ? 'Request details' : 'Loading request…')}</p>{request && <MyRequestDetailModal request={request} onClose={() => setClosed(true)} />}</main>;
}
