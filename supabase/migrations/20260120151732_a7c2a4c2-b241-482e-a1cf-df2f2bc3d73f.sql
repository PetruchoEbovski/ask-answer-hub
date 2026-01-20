-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'responder', 'employee');

-- Create departments table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Create questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id),
    is_anonymous BOOLEAN DEFAULT true NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
    upvotes INTEGER DEFAULT 0 NOT NULL,
    downvotes INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create answers table
CREATE TABLE public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_official BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create comments table
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create votes table
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    vote_type TEXT CHECK (vote_type IN ('up', 'down')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (question_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or responder
CREATE OR REPLACE FUNCTION public.is_admin_or_responder(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'responder')
  )
$$;

-- Departments policies (readable by all authenticated, writable by admin)
CREATE POLICY "Departments are viewable by authenticated users"
ON public.departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- User roles policies (only admins can manage, but users can see their own)
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Questions policies
CREATE POLICY "Questions are viewable by authenticated users"
ON public.questions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create questions"
ON public.questions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id OR author_id IS NULL);

CREATE POLICY "Admins can update questions"
ON public.questions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions"
ON public.questions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Answers policies
CREATE POLICY "Answers are viewable by authenticated users"
ON public.answers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Responders and admins can create answers"
ON public.answers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_responder(auth.uid()) AND auth.uid() = author_id);

CREATE POLICY "Authors and admins can update answers"
ON public.answers FOR UPDATE
TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete answers"
ON public.answers FOR DELETE
TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- Comments policies
CREATE POLICY "Comments are viewable by authenticated users"
ON public.comments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create comments"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id OR author_id IS NULL);

CREATE POLICY "Admins can delete comments"
ON public.comments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Votes policies
CREATE POLICY "Users can view all votes"
ON public.votes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage their own votes"
ON public.votes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
ON public.votes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
ON public.votes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create function to update vote counts
CREATE OR REPLACE FUNCTION public.update_question_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE public.questions SET upvotes = upvotes + 1 WHERE id = NEW.question_id;
    ELSE
      UPDATE public.questions SET downvotes = downvotes + 1 WHERE id = NEW.question_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE public.questions SET upvotes = upvotes - 1 WHERE id = OLD.question_id;
    ELSE
      UPDATE public.questions SET downvotes = downvotes - 1 WHERE id = OLD.question_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE public.questions SET upvotes = upvotes - 1 WHERE id = OLD.question_id;
    ELSE
      UPDATE public.questions SET downvotes = downvotes - 1 WHERE id = OLD.question_id;
    END IF;
    IF NEW.vote_type = 'up' THEN
      UPDATE public.questions SET upvotes = upvotes + 1 WHERE id = NEW.question_id;
    ELSE
      UPDATE public.questions SET downvotes = downvotes + 1 WHERE id = NEW.question_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_votes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.update_question_votes();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_answers_updated_at
BEFORE UPDATE ON public.answers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Add default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default departments
INSERT INTO public.departments (name, description) VALUES
  ('Engineering', 'Technical and development team'),
  ('Product', 'Product management and design'),
  ('HR', 'Human resources and people operations'),
  ('Finance', 'Financial operations and accounting'),
  ('Marketing', 'Marketing and communications'),
  ('Operations', 'General operations and administration'),
  ('Leadership', 'Executive team and company leadership');