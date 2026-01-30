-- Add CHECK constraints for reasonable length limits on questions table
ALTER TABLE public.questions
ADD CONSTRAINT questions_title_length CHECK (char_length(title) <= 500),
ADD CONSTRAINT questions_content_length CHECK (char_length(content) <= 10000);

-- Add CHECK constraints for answers table as well
ALTER TABLE public.answers
ADD CONSTRAINT answers_content_length CHECK (char_length(content) <= 10000);

-- Add CHECK constraints for comments table
ALTER TABLE public.comments
ADD CONSTRAINT comments_content_length CHECK (char_length(content) <= 2000);