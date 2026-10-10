import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function NotFoundPage() {
  const { user, isAuthenticated } = useAuthStore();
  const home = isAuthenticated && user ? ({ ADMIN: '/admin/dashboard', FACULTY: '/faculty/panel', STUDENT: '/student/panel' }[user.role] ?? '/') : '/';
  return <main className="flex min-h-screen items-center justify-center bg-[#faf7f5] p-6">
    <section className="w-full max-w-lg rounded-2xl border border-[#ead7d3] bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-[#800000]">404</p>
      <h1 className="mt-3 text-2xl font-bold text-[#321d1d]">Page not found</h1>
      <p className="mt-3 text-sm text-[#786565]">This address does not match a SmartLab page. It may have moved or been typed incorrectly.</p>
      <Link to={home} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#800000] px-5 text-sm font-semibold text-white">{home === '/' ? 'Back to sign in' : 'Back to Dashboard'}</Link>
    </section>
  </main>;
}
