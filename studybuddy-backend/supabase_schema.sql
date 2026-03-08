-- Paste this in Supabase SQL Editor to create/update StudyBuddy tables.

create extension if not exists pgcrypto;

create table if not exists students (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text unique not null,
    created_at timestamp with time zone default now()
);

create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    filename text not null,
    summary text default '',
    upload_time timestamp with time zone default now()
);

create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    topics_covered text[] default '{}',
    goals text[] default '{}',
    duration_mins integer default 0,
    created_at timestamp with time zone default now()
);

create table if not exists chat_messages (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    question text not null,
    answer text not null,
    source text not null default 'text' check (source in ('text', 'voice')),
    created_at timestamp with time zone default now()
);

create table if not exists flashcards (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    subject text not null default 'General',
    question text not null,
    answer text not null,
    mastered boolean not null default false,
    created_at timestamp with time zone default now()
);

create table if not exists flashcard_review_days (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    review_date date not null,
    review_count integer not null default 0,
    created_at timestamp with time zone default now(),
    unique(student_id, review_date)
);

create table if not exists schedule_events (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    title text not null,
    subject text not null default 'General',
    date date not null,
    start_time time not null,
    end_time time not null,
    priority text not null default 'normal' check (priority in ('normal', 'high')),
    created_at timestamp with time zone default now()
);

create table if not exists workspaces (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default now()
);

create unique index if not exists idx_workspaces_student_name_lower on workspaces(student_id, lower(name));

create table if not exists workspace_documents (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    document_id uuid not null references documents(id) on delete cascade,
    created_at timestamp with time zone default now(),
    unique(workspace_id, document_id)
);

create index if not exists idx_documents_student_id on documents(student_id);
create index if not exists idx_sessions_student_id_created_at on sessions(student_id, created_at desc);
create index if not exists idx_chat_messages_student_id_created_at on chat_messages(student_id, created_at desc);
create index if not exists idx_flashcards_student_id_created_at on flashcards(student_id, created_at desc);
create index if not exists idx_flashcard_review_days_student_date on flashcard_review_days(student_id, review_date desc);
create index if not exists idx_schedule_events_student_date_time on schedule_events(student_id, date, start_time);
create index if not exists idx_workspace_documents_student_workspace on workspace_documents(student_id, workspace_id);

-- Optional RLS policy skeleton (enable only after auth setup):
-- alter table students enable row level security;
-- alter table documents enable row level security;
-- alter table sessions enable row level security;
-- alter table chat_messages enable row level security;
-- alter table flashcards enable row level security;
-- alter table flashcard_review_days enable row level security;
-- alter table schedule_events enable row level security;
-- alter table workspaces enable row level security;
-- alter table workspace_documents enable row level security;
