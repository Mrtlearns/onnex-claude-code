import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Brain, Lock, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, role, loading, roleLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect only after both session and role are resolved
  useEffect(() => {
    if (!loading && !roleLoading && user && role) {
      if (role === "admin") navigate("/admin/dashboard", { replace: true });
      else if (role === "employee") navigate("/employee/questionnaire", { replace: true });
    }
  }, [user, role, loading, roleLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      // AuthContext will update role; useEffect above will redirect
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid credentials";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-navy relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-gold blur-3xl" />
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Brain className="w-7 h-7 text-accent" />
            </div>
            <span className="text-2xl font-display font-bold text-primary-foreground">
              AI Maturity
            </span>
          </div>
          <h1 className="text-5xl font-display font-bold text-primary-foreground leading-tight mb-6">
            Measure. Understand.{" "}
            <span className="text-gradient-teal">Transform.</span>
          </h1>
          <p className="text-lg text-primary-foreground/70 leading-relaxed">
            Assess your organization's AI readiness across eleven critical dimensions — including individual AI competency profiling.
            Get actionable insights, gap analysis, and a tailored transformation roadmap.
          </p>
          <div className="mt-12 flex gap-8 text-primary-foreground/50 text-sm">
            <div>
              <div className="text-3xl font-display font-bold text-accent">11</div>
              <div>Dimensions</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold text-accent">40</div>
              <div>Questions</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold text-accent">5</div>
              <div>Maturity Stages</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">
              AI Maturity
            </span>
          </div>

          <Card className="shadow-card border-border/50">
            <CardHeader className="space-y-1 pb-4">
              <h2 className="text-2xl font-display font-bold text-foreground">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to access your assessment platform
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full h-11" disabled={submitting || loading || roleLoading}>
                  {submitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
