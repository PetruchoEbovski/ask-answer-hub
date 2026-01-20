import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VoteButtonsProps {
  questionId: string;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  onVoteChange?: () => void;
}

export function VoteButtons({ questionId, upvotes, downvotes, userVote, onVoteChange }: VoteButtonsProps) {
  const [isVoting, setIsVoting] = useState(false);
  const { toast } = useToast();

  const handleVote = async (voteType: 'up' | 'down') => {
    if (isVoting) return;
    setIsVoting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to vote", variant: "destructive" });
        return;
      }

      if (userVote === voteType) {
        // Remove vote
        await supabase
          .from('votes')
          .delete()
          .eq('question_id', questionId)
          .eq('user_id', user.id);
      } else if (userVote) {
        // Change vote
        await supabase
          .from('votes')
          .update({ vote_type: voteType })
          .eq('question_id', questionId)
          .eq('user_id', user.id);
      } else {
        // New vote
        await supabase
          .from('votes')
          .insert({ question_id: questionId, user_id: user.id, vote_type: voteType });
      }

      onVoteChange?.();
    } catch (error) {
      toast({ title: "Failed to vote", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const score = upvotes - downvotes;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => handleVote('up')}
        disabled={isVoting}
        className={cn(
          "p-1.5 rounded-lg transition-all duration-200 hover:bg-secondary",
          userVote === 'up' && "text-upvote bg-upvote/10"
        )}
        aria-label="Upvote"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
      <span className={cn(
        "font-semibold text-sm tabular-nums",
        score > 0 && "text-upvote",
        score < 0 && "text-downvote"
      )}>
        {score}
      </span>
      <button
        onClick={() => handleVote('down')}
        disabled={isVoting}
        className={cn(
          "p-1.5 rounded-lg transition-all duration-200 hover:bg-secondary",
          userVote === 'down' && "text-downvote bg-downvote/10"
        )}
        aria-label="Downvote"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}
