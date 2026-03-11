import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
	import.meta.env.VITE_SUPABASE_URL ||
	'https://qaiutofpzcwuufwcpboy.supabase.co'
const supabaseAnonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhaXV0b2ZwemN3dXVmd2NwYm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzAzODgsImV4cCI6MjA4ODQwNjM4OH0.oroPG9D2ddaU77mdpOSnAKiNyNF-mgwsaPheENiJqU4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
