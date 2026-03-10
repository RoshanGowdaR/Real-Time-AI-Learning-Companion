-- One-time patch: create flashcard tables for StudyBuddy.
-- Run this in Supabase SQL Editor for the project configured in SUPABASE_URL.

create extension if not exists pgcrypto;

create table if not exists public.flashcards (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    subject text not null default 'General',
    question text not null,
    answer text not null,
    mastered boolean not null default false,
    created_at timestamp with time zone default now()
);

create table if not exists public.flashcard_review_days (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    review_date date not null,
    review_count integer not null default 0,
    created_at timestamp with time zone default now(),
    unique(student_id, review_date)
);

create index if not exists idx_flashcards_student_id_created_at
    on public.flashcards(student_id, created_at desc);

create index if not exists idx_flashcard_review_days_student_date
    on public.flashcard_review_days(student_id, review_date desc);

-- Ensure PostgREST sees newly created tables immediately.
select pg_notify('pgrst', 'reload schema');

-- Optional checks:
-- select to_regclass('public.flashcards') as flashcards_table;
-- select to_regclass('public.flashcard_review_days') as review_days_table;
