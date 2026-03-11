-- One-time patch: create schedule_events table for StudyBuddy scheduler.
-- Run this in Supabase SQL Editor for the same project used by SUPABASE_URL.

create table if not exists public.schedule_events (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    title text not null,
    subject text not null default 'General',
    date date not null,
    start_time time not null,
    end_time time not null,
    priority text not null default 'normal' check (priority in ('normal', 'high')),
    created_at timestamp with time zone default now()
);

create index if not exists idx_schedule_events_student_date_time
    on public.schedule_events(student_id, date, start_time);

-- Ensure PostgREST sees newly created tables immediately.
select pg_notify('pgrst', 'reload schema');

-- Optional verification query:
-- select to_regclass('public.schedule_events') as table_name;
