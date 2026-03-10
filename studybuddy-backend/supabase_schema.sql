-- Paste this in Supabase SQL Editor to create the tables

CREATE TABLE students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    created_at timestamp DEFAULT now()
);

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id),
    filename text,
    summary text,
    upload_time timestamp DEFAULT now()
);

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id),
    topics_covered text[],
    goals text[],
    duration_mins integer,
    created_at timestamp DEFAULT now()
);

-- Enable Row Level Security (RLS) if needed - uncomment and customize:
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
