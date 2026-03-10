import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import MainApp from './pages/MainApp'

function App() {
  const isRegistered = localStorage.getItem('student_id')

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isRegistered ? <Navigate to="/app" replace /> : <Landing />} />
        <Route path="/app" element={isRegistered ? <MainApp /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
