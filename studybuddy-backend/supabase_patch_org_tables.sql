-- Run this in Supabase SQL Editor for the existing StudyBuddy project.
-- This patch adds org/teacher/subject tables without touching existing data.

create extension if not exists pgcrypto;

create table if not exists organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    invite_code text unique not null,
    admin_email text,
    password_hash text,
    created_at timestamp with time zone default now()
);

alter table organizations add column if not exists admin_email text;
alter table organizations add column if not exists password_hash text;

create table if not exists teachers (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    password_hash text not null,
    full_name text not null,
    org_id uuid references organizations(id) on delete set null,
    is_active boolean default true,
    created_at timestamp with time zone default now()
);

create table if not exists subjects (
    id uuid primary key default gen_random_uuid(),
    org_id uuid references organizations(id) on delete cascade,
    teacher_id uuid references teachers(id) on delete set null,
    name text not null,
    subject_code text unique not null,
    created_at timestamp with time zone default now()
);

create table if not exists org_members (
    id uuid primary key default gen_random_uuid(),
    org_id uuid references organizations(id) on delete cascade,
    student_id uuid references students(id) on delete cascade,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    requested_at timestamp with time zone default now(),
    reviewed_at timestamp with time zone
);

create table if not exists subject_enrollments (
    id uuid primary key default gen_random_uuid(),
    subject_id uuid references subjects(id) on delete cascade,
    student_id uuid references students(id) on delete cascade,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    requested_at timestamp with time zone default now(),
    reviewed_at timestamp with time zone,
    enrolled_at timestamp with time zone default now(),
    unique(subject_id, student_id)
);

alter table subject_enrollments add column if not exists status text default 'pending';
alter table subject_enrollments add column if not exists requested_at timestamp with time zone default now();
alter table subject_enrollments add column if not exists reviewed_at timestamp with time zone;

update subject_enrollments
set
    status = coalesce(status, 'approved'),
    requested_at = coalesce(requested_at, enrolled_at, now())
where status is null or requested_at is null;

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

create index if not exists idx_organizations_invite_code on organizations(invite_code);
create unique index if not exists idx_organizations_admin_email_lower on organizations(lower(admin_email));
create index if not exists idx_teachers_org_id on teachers(org_id);
create index if not exists idx_teachers_email on teachers(email);
create index if not exists idx_subjects_org_id on subjects(org_id);
create index if not exists idx_subjects_teacher_id on subjects(teacher_id);
create index if not exists idx_subjects_code on subjects(subject_code);
create index if not exists idx_org_members_org_status on org_members(org_id, status);
create index if not exists idx_org_members_student_status on org_members(student_id, status);
create index if not exists idx_subject_enrollments_student on subject_enrollments(student_id);
create index if not exists idx_subject_enrollments_subject_status on subject_enrollments(subject_id, status);
create index if not exists idx_announcements_subject_created on announcements(subject_id, created_at desc);
create index if not exists idx_assignments_subject_due on assignments(subject_id, due_date);

select pg_notify('pgrst', 'reload schema');
