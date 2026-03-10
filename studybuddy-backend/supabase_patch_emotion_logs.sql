-- One-time patch: create emotion_logs table for realtime demo telemetry.
-- Run this in Supabase SQL Editor for the same project used by SUPABASE_URL.

create extension if not exists pgcrypto;

create table if not exists public.emotion_logs (
    id uuid primary key default gen_random_uuid(),
    student_id uuid references public.students(id) on delete cascade,
    emotion text not null,
    confidence double precision not null default 0,
    session_date date default current_date,
    detected_at timestamp with time zone default now()
);

create index if not exists idx_emotion_logs_student_detected_at
    on public.emotion_logs(student_id, detected_at desc);

-- Ensure PostgREST sees newly created tables immediately.
select pg_notify('pgrst', 'reload schema');

-- Optional verification query:
-- select to_regclass('public.emotion_logs') as table_name;
