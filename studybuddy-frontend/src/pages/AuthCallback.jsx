import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../services/api'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        console.error('Auth callback error:', error)
        navigate('/')
        return
      }

      const user = session.user
      const name = user.user_metadata.full_name || user.email.split('@')[0]
      const email = user.email

      try {
        // Try to register (handles skip if already exists on server-side)
        const res = await api.registerStudent(name, email)
        const student = res.student || res

        const resolvedStudentId = student.student_id || student.id
        if (!resolvedStudentId) {
          throw new Error('Student id missing from register response')
        }

        localStorage.setItem('student_id', String(resolvedStudentId))
        localStorage.setItem('student_name', student.name || name)
        localStorage.setItem('student_email', student.email || email)

        navigate('/app')
      } catch (err) {
        console.error('Registration after Google login failed:', err)
        navigate('/')
      }
    }

    handleAuth()
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
      <p className="text-gray-400">Authenticating with Google...</p>
    </div>
  )
}
