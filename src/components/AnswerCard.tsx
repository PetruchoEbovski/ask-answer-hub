import { useState } from "react";
import { Check, MessageSquare, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface AnswerCardProps {
  id: string;
  content: string;
  isOfficial: boolean;
  createdAt: string;
  author: {
    full_name?: string;
    avatar_url?: string;
    email?: string;
  };
  comments: Comment[];
  onCommentAdded?: () => void;
}

export function AnswerCard({
  id,
  content,
  isOfficial,
  createdAt,
  author,
  comments,
  onCommentAdded,
}: AnswerCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to comment", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from('comments').insert({
        answer_id: id,
        content: newComment.trim(),
        author_id: user.id,
        is_anonymous: true,
      });

      if (error) throw error;

      setNewComment("");
      toast({ title: "Comment added" });
      onCommentAdded?.();
    } catch (error) {
      toast({ title: "Failed to add comment", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorInitials = author.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || author.email?.[0].toUpperCase() || 'U';

  return (
    <Card className={cn(
      "p-5 animate-slide-up",
      isOfficial && "border-success/30 bg-success/5"
    )}>
      <div className="flex gap-4">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={author.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {authorInitials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-foreground">
              {author.full_name || author.email || "Unknown"}
            </span>
            {isOfficial && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success text-success-foreground">
                <Check className="w-3 h-3" />
                Official
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
            </span>
          </div>

          <div className="prose prose-sm max-w-none text-foreground/90 mb-4">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" />
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </Button>

          {showComments && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-border">
              {comments.map((comment) => (
                <div key={comment.id} className="animate-fade-in">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className={cn(
                      "text-xs font-medium",
                      comment.is_anonymous && "text-anonymous"
                    )}>
                      {comment.is_anonymous
                        ? "Anonymous"
                        : comment.author?.full_name || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 pl-5">{comment.content}</p>
                </div>
              ))}

              <div className="pt-2">
                <Textarea
                  placeholder="Add a follow-up question or comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px] mb-2"
                />
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={isSubmitting || !newComment.trim()}
                >
                  {isSubmitting ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
