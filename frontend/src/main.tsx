import PasswordRecoveryPage from './pages/PasswordRecoveryPage'
import RequestLinkPage from './pages/RequestLinkPage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import FacultyPanel from './pages/FacultyPanel'
import AdminDashboard from './pages/AdminDashboard'
import ManageAccounts from './pages/ManageAccounts'
import AdminLabSchedule from './pages/AdminLabSchedule'
import AdminAcademicDirectory from './pages/AdminAcademicDirectory'
import AdminEquipment from './pages/AdminEquipment'
import AdminRequests from './pages/AdminRequests'
import AdminReports from './pages/AdminReports'
import AdminAcademicPeriod from './pages/AdminAcademicPeriod'
import AdminAuditLogs from './pages/AdminAuditLogs'
import StudentPanel from './pages/StudentPanel'
import ProfileRoute from './pages/ProfileRoute'
import SettingsRoute from './pages/SettingsRoute'
import ProtectedRoute from './components/ProtectedRoute'
import Toaster from './components/shared/Toaster'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/forgot-password" element={<PasswordRecoveryPage key="forgot" />} />
        <Route path="/reset-password" element={<PasswordRecoveryPage key="reset" reset />} />
        <Route path="/requests/:id" element={<RequestLinkPage />} />
        <Route path="/" element={<LandingPage />} />
        {/* Keep old bookmarks working while using the official branded login page. */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/faculty/panel"
          element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultyPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ManageAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedule"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLabSchedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/requests"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/academic-directory"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminAcademicDirectory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/equipment"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminEquipment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/academic-period"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminAcademicPeriod />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminAuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/panel"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'FACULTY', 'STUDENT']}>
              <ProfileRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'FACULTY', 'STUDENT']}>
              <SettingsRoute />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
