-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Department admins are viewable by authenticated users" ON public.department_admins;

-- Create a new policy that only allows admins to view department_admins
CREATE POLICY "Only admins can view department admins"
ON public.department_admins
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));