import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  LogIn, 
  EyeOff, 
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Mode = 'ask' | 'signin';

export default function Landing() {
  const [mode, setMode] = useState<Mode>('ask');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/questions");
    }
  }, [user, navigate]);

  const handleAskQuestion = () => {
    // Redirect to sign in - anonymous question submission is no longer allowed for security
    setMode('signin');
    toast({ 
      title: "Sign in required", 
      description: "Please sign in to ask a question. Your identity can remain anonymous.",
    });
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center lg:hidden">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Ask us anything</h1>
              <p className="text-sm text-muted-foreground">Anonymous Q&A for the team</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-secondary rounded-lg p-1">
            <Button
              variant={mode === 'ask' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('ask')}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Ask Question
            </Button>
            <Button
              variant={mode === 'signin' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('signin')}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </div>
        </header>

        {/* Banner */}
        <div className="gradient-banner px-6 py-4 text-primary-foreground">
          <p className="text-sm font-medium">
            💬 Ask questions anonymously. Get answers from your team leaders.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 max-w-2xl mx-auto w-full">
          {mode === 'ask' ? (
              <Card className="shadow-lg border-border/50 animate-slide-up">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <EyeOff className="w-5 h-5 text-primary" />
                    Ask a Question
                  </CardTitle>
                  <CardDescription>
                    Sign in to ask questions. You can choose to remain anonymous - your identity will be hidden from others.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      <span>Choose to post anonymously or with your name</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      <span>Direct questions to specific departments</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      <span>Get responses from team leaders</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleAskQuestion}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In to Ask a Question
                  </Button>
                </CardContent>
              </Card>
          ) : (
            <Card className="shadow-lg border-border/50 animate-slide-up">
              <CardHeader className="text-center">
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                  Sign in with your @getblock.io Google account to view and answer questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button
                  className="w-full gap-3 h-12 text-base"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {isAuthLoading ? "Signing in..." : "Continue with Google"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Only @getblock.io accounts are allowed
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
