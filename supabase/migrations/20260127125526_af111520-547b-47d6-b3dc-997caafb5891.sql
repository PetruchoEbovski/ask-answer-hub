-- Create department_admins table to link admins/responders to departments
CREATE TABLE public.department_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Enable RLS
ALTER TABLE public.department_admins ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Department admins are viewable by authenticated users"
ON public.department_admins
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage department admins"
ON public.department_admins
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_department_admins_user_id ON public.department_admins(user_id);
CREATE INDEX idx_department_admins_department_id ON public.department_admins(department_id);