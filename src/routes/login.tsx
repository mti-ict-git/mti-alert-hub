import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({ component: LoginPage });

const sitePhotos = [
  { src: "/images/login/camp.jpg", label: "Camp facilities" },
  { src: "/images/login/operations.jpeg", label: "Operations" },
  { src: "/images/login/site.jpg", label: "Site overview" },
];

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const usernameMissing = submitted && !username.trim();
  const passwordMissing = submitted && !password;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setSubmitted(true);
    setError("");
    if (!username.trim() || !password) {
      (!username.trim() ? usernameInput : passwordInput).current?.focus();
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await login(username.trim(), password);
      await navigate({ to: "/" });
    } catch {
      setError(
        "Unable to sign in. Check your corporate credentials and connection, then try again.",
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-6 sm:p-8 lg:p-12">
      <div className="grid w-full max-w-[1120px] overflow-hidden rounded-surface border bg-card shadow-login lg:min-h-[720px] lg:grid-cols-[1.15fr_1fr]">
        <section
          aria-label="Site photos"
          className="flex min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r"
        >
          <div className="relative h-52 overflow-hidden bg-login-panel sm:h-72 lg:h-auto lg:min-h-[540px] lg:flex-1">
            {imageFailed ? (
              <div className="flex h-full min-h-52 items-center justify-center text-login-foreground">
                <Siren aria-hidden="true" className="h-14 w-14" />
              </div>
            ) : (
              <img
                src={sitePhotos[photoIndex].src}
                alt={sitePhotos[photoIndex].label}
                width={900}
                height={900}
                fetchPriority="high"
                className="h-full w-full object-cover lg:absolute lg:inset-0"
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
          <div
            className="flex items-center justify-center gap-3 bg-card px-6 py-4 lg:py-6"
            role="group"
            aria-label="Choose a site photo"
          >
            {sitePhotos.map((photo, index) => (
              <button
                key={photo.src}
                type="button"
                aria-label={`Show ${photo.label.toLowerCase()}`}
                aria-pressed={photoIndex === index}
                onClick={() => {
                  setPhotoIndex(index);
                  setImageFailed(false);
                }}
                className={`h-12 w-16 overflow-hidden rounded-md border-2 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${photoIndex === index ? "border-primary" : "border-transparent"}`}
              >
                <img
                  src={photo.src}
                  alt=""
                  width={64}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="login-title"
          className="flex min-w-0 flex-col px-6 py-8 sm:px-10 lg:px-12 lg:py-10"
        >
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-7 flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emergency text-emergency-foreground">
                <Siren aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="text-2xl font-semibold tracking-tight">MTI Alert</p>
              <p className="mt-1 text-xs text-muted-foreground">Emergency Notification System</p>
            </div>
            <div className="border-t pt-6 text-center">
              <h1 id="login-title" className="text-lg font-semibold">
                Sign in
              </h1>
              <p id="login-help" className="mt-2 text-sm text-muted-foreground">
                Use your MTI corporate account to continue.
              </p>
            </div>
            <form
              noValidate
              onSubmit={submit}
              aria-describedby="login-help"
              aria-busy={loading}
              className="mt-7 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="u">Username</Label>
                <Input
                  ref={usernameInput}
                  id="u"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Corporate username"
                  className="h-11 bg-card shadow-none"
                  aria-invalid={usernameMissing}
                  aria-describedby={usernameMissing ? "username-error" : undefined}
                />
                {usernameMissing && (
                  <p id="username-error" className="text-xs text-destructive">
                    Enter your corporate username.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p">Password</Label>
                <div className="relative">
                  <Input
                    ref={passwordInput}
                    id="p"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Password"
                    className="h-11 bg-card pr-12 shadow-none"
                    aria-invalid={passwordMissing}
                    aria-describedby={passwordMissing ? "password-error" : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-0.5 h-10 w-10"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {passwordMissing && (
                  <p id="password-error" className="text-xs text-destructive">
                    Enter your password.
                  </p>
                )}
              </div>
              <div className="min-h-12 text-sm text-destructive" aria-live="polite">
                {error}
              </div>
              <Button type="submit" className="h-11 w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                )}
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
              Sign in with your Active Directory account.
              <br />
              For account access assistance, contact ICT.
            </p>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} PT MTI. Internal use only.
          </p>
        </section>
      </div>
    </main>
  );
}
