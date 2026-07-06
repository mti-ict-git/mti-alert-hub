import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Siren, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin.ohse");
  const [password, setPassword] = useState("demo");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch {
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emergency text-emergency-foreground">
            <Siren className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold">MTI Alert</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
              Emergency Notification System
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">
            Reach every officer,
            <br /> every site, in seconds.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">
            Coordinate emergency and operational notifications across desktop agents, WhatsApp,
            email, and digital signage from a single control room.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-sidebar-foreground/70">
            {["Acid Plant", "Pyrite", "Chloride", "CCP", "Makarti", "Labota"].map((s) => (
              <span key={s} className="rounded-full border border-sidebar-border px-3 py-1">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} PT MTI. Internal use only.</div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-2 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emergency text-emergency-foreground">
                <Siren className="h-4 w-4" />
              </div>
              <span className="font-semibold">MTI Alert</span>
            </div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your MTI corporate account to continue.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="u">Username</Label>
                <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p">Password</Label>
                <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={submit}>
              <ShieldCheck className="h-4 w-4" /> Login with AD Account
            </Button>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Demo build — any credentials will sign you in.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
