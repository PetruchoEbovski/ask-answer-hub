-- Update policy to allow null author_id for anonymous questions (while still requiring authentication)
DROP POLICY IF EXISTS "Authenticated users can create questions" ON public.questions;

CREATE POLICY "Authenticated users can create questions"
ON public.questions FOR INSERT
TO authenticated
WITH CHECK (
  (is_anonymous = true AND author_id IS NULL) 
  OR (is_anonymous = false AND auth.uid() = author_id)
);