-- Fix 1: Restrict votes table - users can only see their own votes  
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;

CREATE POLICY "Users can view their own votes"
ON public.votes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 2: For profiles_public view with security_invoker=on, we need to allow 
-- authenticated users to read from the underlying profiles table through the view.
-- We'll add a policy that allows reading non-email fields via the view.
-- Drop and recreate the view without security_invoker, then add RLS on the view itself.

-- First, recreate view as a materialized-like regular view that doesn't invoke caller RLS
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
SELECT id, user_id, full_name, avatar_url, department_id, created_at
FROM public.profiles;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Fix 3: Restrict question creation to authenticated users only
DROP POLICY IF EXISTS "Anyone can create questions" ON public.questions;

CREATE POLICY "Authenticated users can create questions"
ON public.questions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);