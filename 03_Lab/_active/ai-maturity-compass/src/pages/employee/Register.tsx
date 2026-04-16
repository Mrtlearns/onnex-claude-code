import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain } from "lucide-react";
import type { RoleLevel } from "@/types";

const ROLE_OPTIONS: { value: RoleLevel; label: string }[] = [
  { value: "cxo", label: "C-Suite / Executive" },
  { value: "director", label: "Director / VP" },
  { value: "manager", label: "Manager" },
  { value: "individual", label: "Individual Contributor" },
];

const deriveUsername = (email: string) =>
  email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleLevel | "">("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employeesAffected, setEmployeesAffected] = useState("");

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setUsername(deriveUsername(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    sessionStorage.setItem("employee-role", role);
    sessionStorage.setItem("employee-email", email);
    sessionStorage.setItem("employee-username", username);
    sessionStorage.setItem("employee-name", fullName);
    sessionStorage.setItem("employee-title", jobTitle);
    sessionStorage.setItem("employee-employees-affected", employeesAffected);
    setTimeout(() => navigate("/employee/questionnaire"), 600);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-display font-bold text-foreground">AI Maturity</span>
        </div>

        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-4">
            <h2 className="text-2xl font-display font-bold text-foreground">
              Complete Your Profile
            </h2>
            <p className="text-sm text-muted-foreground">
              Fill in your details to begin the AI maturity assessment.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="John Smith"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  placeholder="john.smith"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                />
                <p className="text-xs text-muted-foreground">
                  Auto-derived from email. Used for system login — lowercase, no spaces.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Job Title *</Label>
                  <Input
                    placeholder="Head of IT"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employees Affected *</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 50"
                    required
                    value={employeesAffected}
                    onChange={(e) => setEmployeesAffected(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role Level *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as RoleLevel)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role level" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This determines which questions are relevant to your level.
                </p>
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading || !role}>
                {loading ? "Saving..." : "Continue to Assessment →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
