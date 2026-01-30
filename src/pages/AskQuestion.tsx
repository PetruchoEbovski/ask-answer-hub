import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AskQuestion() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      if (data) setDepartments(data);
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !content.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('questions')
      .insert({
        title: title.trim(),
        content: content.trim(),
        department_id: departmentId || null,
        is_anonymous: isAnonymous,
        author_id: isAnonymous ? null : user.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to submit question", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Question submitted successfully!" });
      
      // Send notification to department admins (fire and forget)
      if (data.department_id) {
        supabase.functions.invoke('notify-department-admins', {
          body: { question: data }
        }).catch(err => console.error('Failed to send notifications:', err));
      }
      
      navigate(`/question/${data.id}`);
    }

    setIsSubmitting(false);
  };

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

      <main className="container max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="shadow-elegant border-border/50 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-2xl">Ask a Question</CardTitle>
            <CardDescription>
              Your question will be visible to everyone in the organization.
              {isAnonymous ? " Your identity will remain anonymous." : " Your name will be visible."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Question Title *</Label>
                <Input
                  id="title"
                  placeholder="What would you like to ask?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {title.length}/200
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Details *</Label>
                <Textarea
                  id="content"
                  placeholder="Provide more context or details about your question..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[150px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department (optional)</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Address your question to a specific department or manager
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {isAnonymous ? (
                    <EyeOff className="w-5 h-5 text-anonymous" />
                  ) : (
                    <Eye className="w-5 h-5 text-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {isAnonymous ? "Anonymous" : "Show my name"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isAnonymous
                        ? "Your identity will be hidden from everyone"
                        : "Your name will be visible to everyone"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={!isAnonymous}
                  onCheckedChange={(checked) => setIsAnonymous(!checked)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  className="flex-1 gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Submitting..." : "Submit Question"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
