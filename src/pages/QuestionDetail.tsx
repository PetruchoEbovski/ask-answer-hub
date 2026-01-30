import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { VoteButtons } from "@/components/VoteButtons";
import { DepartmentBadge } from "@/components/DepartmentBadge";
import { AnswerCard } from "@/components/AnswerCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  title: string;
  content: string;
  is_anonymous: boolean;
  status: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  department: { name: string } | null;
  author: { full_name: string | null; avatar_url: string | null } | null;
}

interface Answer {
  id: string;
  content: string;
  is_official: boolean;
  created_at: string;
  author: { full_name: string | null; avatar_url: string | null; email: string } | null;
  comments: {
    id: string;
    content: string;
    is_anonymous: boolean;
    created_at: string;
    author: { full_name: string | null; avatar_url: string | null } | null;
  }[];
}

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, isAdmin, isResponder, isLoading } = useAuth();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [newAnswer, setNewAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const fetchQuestion = async () => {
    if (!id || !user) return;

    const { data: questionData, error } = await supabase
      .from('questions')
      .select(`
        id,
        title,
        content,
        is_anonymous,
        status,
        upvotes,
        downvotes,
        created_at,
        author_id,
        department:departments(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching question:', error);
      navigate('/');
      return;
    }

    // Fetch author profile if exists
    let authorData = null;
    // Use profiles_public view to avoid exposing email addresses
    if (questionData.author_id) {
      const { data } = await supabase
        .from('profiles_public')
        .select('full_name, avatar_url')
        .eq('user_id', questionData.author_id)
        .single();
      authorData = data;
    }

    setQuestion({ ...questionData, author: authorData } as any);

    // Fetch user vote
    const { data: voteData } = await supabase
      .from('votes')
      .select('vote_type')
      .eq('question_id', id)
      .eq('user_id', user.id)
      .single();

    setUserVote(voteData?.vote_type as 'up' | 'down' | null);
    setIsLoadingData(false);
  };

  const fetchAnswers = async () => {
    if (!id) return;

    const { data: answersData } = await supabase
      .from('answers')
      .select(`
        id,
        content,
        is_official,
        created_at,
        author_id,
        comments(id, content, is_anonymous, created_at, author_id)
      `)
      .eq('question_id', id)
      .order('is_official', { ascending: false })
      .order('created_at', { ascending: true });

    if (!answersData) {
      setAnswers([]);
      return;
    }

    // Fetch all author profiles
    const allAuthorIds = [
      ...answersData.map(a => a.author_id),
      ...answersData.flatMap(a => a.comments.map(c => c.author_id))
    ].filter(Boolean);

    // Use profiles_public view to avoid exposing email addresses
    const { data: profilesData } = await supabase
      .from('profiles_public')
      .select('user_id, full_name, avatar_url')
      .in('user_id', allAuthorIds);

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

    const formattedAnswers = answersData.map(a => ({
      ...a,
      author: profilesMap.get(a.author_id) || null,
      comments: a.comments.map(c => ({
        ...c,
        author: c.author_id ? profilesMap.get(c.author_id) || null : null,
      })),
    }));

    setAnswers(formattedAnswers as any);
  };

  useEffect(() => {
    if (user && id) {
      fetchQuestion();
      fetchAnswers();
    }
  }, [user, id]);

  const handleSubmitAnswer = async () => {
    if (!newAnswer.trim() || !user || !id) return;

    setIsSubmitting(true);

    const { error } = await supabase.from('answers').insert({
      question_id: id,
      content: newAnswer.trim(),
      author_id: user.id,
      is_official: isResponder,
    });

    if (error) {
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } else {
      // Update question status
      await supabase
        .from('questions')
        .update({ status: 'answered' })
        .eq('id', id);

      setNewAnswer("");
      toast({ title: "Answer posted successfully!" });
      fetchAnswers();
      fetchQuestion();
    }

    setIsSubmitting(false);
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Question not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={profile ? { email: profile.email, full_name: profile.full_name || undefined, avatar_url: profile.avatar_url || undefined } : null} 
        isAdmin={isAdmin} 
      />

      <main className="container max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Questions
        </Button>

        {/* Question */}
        <Card className="mb-8 shadow-elegant border-border/50 animate-slide-up">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <VoteButtons
                questionId={question.id}
                upvotes={question.upvotes}
                downvotes={question.downvotes}
                userVote={userVote}
                onVoteChange={fetchQuestion}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    {question.title}
                  </h1>
                  {question.department && (
                    <DepartmentBadge name={question.department.name} />
                  )}
                </div>

                <div className="prose prose-sm max-w-none text-foreground/90 mb-4">
                  <p className="whitespace-pre-wrap">{question.content}</p>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    <span className={cn(question.is_anonymous && "text-anonymous font-medium")}>
                      {question.is_anonymous
                        ? "Anonymous"
                        : question.author?.full_name || "Unknown"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}</span>
                  </div>

                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                    question.status === 'open' && "bg-accent/10 text-accent",
                    question.status === 'answered' && "bg-success/10 text-success",
                    question.status === 'closed' && "bg-muted text-muted-foreground"
                  )}>
                    {question.status}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Answers */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {answers.length} {answers.length === 1 ? "Answer" : "Answers"}
          </h2>

          {answers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border/50">
              <p className="text-lg mb-1">No answers yet</p>
              <p className="text-sm">Be the first to respond!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {answers.map((answer) => (
                <AnswerCard
                  key={answer.id}
                  id={answer.id}
                  content={answer.content}
                  isOfficial={answer.is_official}
                  createdAt={answer.created_at}
                  author={{
                    full_name: answer.author?.full_name || undefined,
                    avatar_url: answer.author?.avatar_url || undefined,
                    email: answer.author?.email,
                  }}
                  comments={answer.comments.map(c => ({
                    ...c,
                    author: c.author ? {
                      full_name: c.author.full_name || undefined,
                      avatar_url: c.author.avatar_url || undefined,
                    } : undefined,
                  }))}
                  onCommentAdded={fetchAnswers}
                />
              ))}
            </div>
          )}
        </div>

        {/* Answer Form */}
        {isResponder && (
          <Card className="shadow-elegant border-border/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Post an Official Answer</h3>
              <Textarea
                placeholder="Write your response..."
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                className="min-h-[120px] mb-4"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting || !newAnswer.trim()}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Posting..." : "Post Answer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
