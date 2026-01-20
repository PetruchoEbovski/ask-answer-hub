import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { QuestionCard } from "@/components/QuestionCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  author: { full_name: string | null } | null;
  answers: { id: string }[];
  userVote: 'up' | 'down' | null;
}

type SortOption = 'trending' | 'newest' | 'answered';

export default function Questions() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const fetchQuestions = async () => {
    if (!user) return;

    setIsLoadingQuestions(true);
    
    let query = supabase
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
        department:departments(name),
        answers(id)
      `);

    if (departmentFilter !== "all") {
      query = query.eq('department_id', departmentFilter);
    }

    if (sortBy === 'trending') {
      query = query.order('upvotes', { ascending: false });
    } else if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'answered') {
      query = query.eq('status', 'answered').order('updated_at', { ascending: false });
    }

    const { data: questionsData, error } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return;
    }

    // Fetch user votes
    const { data: votesData } = await supabase
      .from('votes')
      .select('question_id, vote_type')
      .eq('user_id', user.id);

    const votesMap = new Map(votesData?.map(v => [v.question_id, v.vote_type as 'up' | 'down']) || []);

    const formattedQuestions = (questionsData || []).map(q => ({
      ...q,
      userVote: votesMap.get(q.id) || null,
    }));

    setQuestions(formattedQuestions);
    setIsLoadingQuestions(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    if (data) setDepartments(data);
  };

  useEffect(() => {
    if (user) {
      fetchQuestions();
      fetchDepartments();
    }
  }, [user, departmentFilter, sortBy]);

  const filteredQuestions = questions.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.content.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={profile ? { email: profile.email, full_name: profile.full_name || undefined, avatar_url: profile.avatar_url || undefined } : null} 
        isAdmin={isAdmin} 
      />

      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Questions</h1>
          <p className="text-muted-foreground">
            Browse anonymous questions from your team
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            <Button
              variant={sortBy === 'trending' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('trending')}
              className="gap-1.5"
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </Button>
            <Button
              variant={sortBy === 'newest' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('newest')}
              className="gap-1.5"
            >
              <Clock className="w-4 h-4" />
              Newest
            </Button>
            <Button
              variant={sortBy === 'answered' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('answered')}
              className="gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Answered
            </Button>
          </div>
        </div>

        {/* Questions List */}
        {isLoadingQuestions ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg mb-2">No questions found</p>
            <p className="text-sm">Be the first to ask a question!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map(question => (
              <QuestionCard
                key={question.id}
                id={question.id}
                title={question.title}
                content={question.content}
                departmentName={question.department?.name}
                isAnonymous={question.is_anonymous}
                authorName={question.author?.full_name || undefined}
                status={question.status || 'open'}
                upvotes={question.upvotes}
                downvotes={question.downvotes}
                userVote={question.userVote}
                answersCount={question.answers?.length || 0}
                createdAt={question.created_at}
                onVoteChange={fetchQuestions}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
