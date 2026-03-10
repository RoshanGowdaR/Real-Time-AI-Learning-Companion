import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import MainApp from './pages/MainApp'

function ProtectedRoute({ children }) {
  const id = localStorage.getItem('student_id')
  return id ? children : <Navigate to="/" replace />
}

function PublicRoute({ children }) {
  const id = localStorage.getItem('student_id')
  return id ? <Navigate to="/app" replace /> : children
}

export default function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/app" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
