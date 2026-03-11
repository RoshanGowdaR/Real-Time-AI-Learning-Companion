import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PortalSelect from './pages/PortalSelect'
import Landing from './pages/Landing'
import MainApp from './pages/MainApp'
import TeacherLogin from './pages/TeacherLogin'
import TeacherSubjects from './pages/TeacherSubjects'
import OrgsPage from './pages/OrgsPage'
import OrgView, { OrganizationAdminView } from './pages/OrgView'
import OrganizationLogin from './pages/OrganizationLogin'
import TeacherHome from './pages/TeacherHome'
import MCQExamRoom from './pages/MCQExamRoom'
import WrittenExamRoom from './pages/WrittenExamRoom'
import AuthCallback from './pages/AuthCallback'
import { getTeacherSession } from './utils/teacherSession'
import { getOrganizationSession } from './utils/organizationSession'

function StudentProtectedRoute({ children }) {
  const id = localStorage.getItem('student_id')
  return id ? children : <Navigate to="/student/login" replace />
}

function StudentPublicRoute({ children }) {
  const id = localStorage.getItem('student_id')
  return id ? <Navigate to="/app" replace /> : children
}

function StudentOrgProtectedRoute({ children }) {
  const id = localStorage.getItem('student_id')
  return id ? children : <Navigate to="/" replace />
}

function TeacherProtectedRoute({ children }) {
  const session = getTeacherSession()
  return session?.teacher_id ? children : <Navigate to="/teacher/login" replace />
}

function TeacherPublicRoute({ children }) {
  const session = getTeacherSession()
  if (!session?.teacher_id) return children

  const subjects = Array.isArray(session.subjects) ? session.subjects : []
  if (subjects.length > 1 && !session.active_subject_id) {
    return <Navigate to="/teacher/subjects" replace />
  }

  return <Navigate to="/teacher/home" replace />
}

function OrganizationProtectedRoute({ children }) {
  const session = getOrganizationSession()
  return session?.org_id ? children : <Navigate to="/organization/login" replace />
}

function OrganizationPublicRoute({ children }) {
  const session = getOrganizationSession()
  return session?.org_id ? <Navigate to="/organization/home" replace /> : children
}

export default function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PortalSelect />} />
        <Route path="/student/login" element={<StudentPublicRoute><Landing /></StudentPublicRoute>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/app" element={<StudentProtectedRoute><MainApp /></StudentProtectedRoute>} />
        <Route path="/app/organizations" element={<StudentOrgProtectedRoute><OrgsPage /></StudentOrgProtectedRoute>} />
        <Route path="/app/organizations/:subjectId" element={<StudentOrgProtectedRoute><OrgView /></StudentOrgProtectedRoute>} />
        <Route path="/app/exam/:examId/mcq" element={<StudentOrgProtectedRoute><MCQExamRoom /></StudentOrgProtectedRoute>} />
        <Route path="/app/exam/:examId/written" element={<StudentOrgProtectedRoute><WrittenExamRoom /></StudentOrgProtectedRoute>} />
        <Route path="/teacher/login" element={<TeacherPublicRoute><TeacherLogin /></TeacherPublicRoute>} />
        <Route path="/teacher/subjects" element={<TeacherProtectedRoute><TeacherSubjects /></TeacherProtectedRoute>} />
        <Route path="/teacher/home" element={<TeacherProtectedRoute><TeacherHome /></TeacherProtectedRoute>} />
        <Route path="/organization/login" element={<OrganizationPublicRoute><OrganizationLogin /></OrganizationPublicRoute>} />
        <Route path="/organization/home" element={<OrganizationProtectedRoute><OrganizationAdminView /></OrganizationProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
