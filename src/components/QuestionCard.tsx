import { Link } from "react-router-dom";
import { MessageSquare, Clock, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VoteButtons } from "./VoteButtons";
import { DepartmentBadge } from "./DepartmentBadge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  id: string;
  title: string;
  content: string;
  departmentName?: string;
  isAnonymous: boolean;
  authorName?: string;
  status: string;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  answersCount: number;
  createdAt: string;
  onVoteChange?: () => void;
}

export function QuestionCard({
  id,
  title,
  content,
  departmentName,
  isAnonymous,
  authorName,
  status,
  upvotes,
  downvotes,
  userVote,
  answersCount,
  createdAt,
  onVoteChange,
}: QuestionCardProps) {
  return (
    <Card className="p-4 hover:shadow-elegant transition-all duration-300 animate-fade-in border-border/50">
      <div className="flex gap-4">
        <VoteButtons
          questionId={id}
          upvotes={upvotes}
          downvotes={downvotes}
          userVote={userVote}
          onVoteChange={onVoteChange}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Link to={`/question/${id}`} className="group">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-accent transition-colors line-clamp-2">
                {title}
              </h3>
            </Link>
            {departmentName && <DepartmentBadge name={departmentName} />}
          </div>

          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
            {content}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span className={cn(isAnonymous && "text-anonymous font-medium")}>
                {isAnonymous ? "Anonymous" : authorName || "Unknown"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{answersCount} {answersCount === 1 ? "answer" : "answers"}</span>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
            </div>

            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
              status === 'open' && "bg-accent/10 text-accent",
              status === 'answered' && "bg-success/10 text-success",
              status === 'closed' && "bg-muted text-muted-foreground"
            )}>
              {status}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
