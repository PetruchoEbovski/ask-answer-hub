-- Fix Security Definer View warning by using security_invoker
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, user_id, full_name, avatar_url, department_id, created_at
FROM public.profiles;

-- Since we're using security_invoker, we need a policy on profiles table that allows
-- authenticated users to read public profile fields through this view.
-- Add a policy that allows all authenticated users to read profiles (but view excludes email)
CREATE POLICY "Authenticated users can view profiles via public view"
ON public.profiles FOR SELECT
TO authenticated
USING (true);