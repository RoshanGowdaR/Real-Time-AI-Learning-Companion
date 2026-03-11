-- Patch: Create missing 'announcements' and 'assignments' tables
-- Run this in your Supabase SQL Editor at https://supabase.com/dashboard

create extension if not exists pgcrypto;

-- Ensure subjects and teachers tables exist before creating dependent ones
-- (They should already exist; this is a safety check)

create table if not exists announcements (
    id uuid primary key default gen_random_uuid(),
    subject_id uuid references subjects(id) on delete cascade,
    teacher_id uuid references teachers(id) on delete set null,
    title text not null,
    body text default '',
    tag text not null default 'General' check (tag in ('General', 'Assignment', 'Important')),
    created_at timestamp with time zone default now()
);

create table if not exists assignments (
    id uuid primary key default gen_random_uuid(),
    subject_id uuid references subjects(id) on delete cascade,
    teacher_id uuid references teachers(id) on delete set null,
    title text not null,
    description text default '',
    due_date timestamp with time zone,
    max_score integer default 100,
    created_at timestamp with time zone default now()
);

create index if not exists idx_announcements_subject_created on announcements(subject_id, created_at desc);
create index if not exists idx_assignments_subject_due on assignments(subject_id, due_date);

-- Refresh PostgREST schema cache immediately
select pg_notify('pgrst', 'reload schema');
