-- Allow anonymous users to insert questions (no auth required)
DROP POLICY IF EXISTS "Authenticated users can create questions" ON public.questions;

CREATE POLICY "Anyone can create questions"
ON public.questions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view departments
DROP POLICY IF EXISTS "Departments are viewable by authenticated users" ON public.departments;

CREATE POLICY "Departments are viewable by everyone"
ON public.departments FOR SELECT
TO anon, authenticated
USING (true);