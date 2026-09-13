import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({ component: LoginPage });

const sitePhotos = [
  { src: "/images/login/plant-team-oil-painting.png", label: "Plant team" },
  { src: "/images/login/operations-oil-painting.png", label: "Operations" },
  { src: "/images/login/industrial-plant-oil-painting.png", label: "Industrial plant" },
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
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [slideshowPaused, setSlideshowPaused] = useState(false);

  function selectPhoto(index: number) {
    setPhotoIndex((index + sitePhotos.length) % sitePhotos.length);
  }

  useEffect(() => {
    if (slideshowPaused) return;
    const timer = window.setTimeout(() => {
      setPhotoIndex((index) => (index + 1) % sitePhotos.length);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [photoIndex, slideshowPaused]);

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
    <main className="login-backdrop flex min-h-svh items-center justify-center bg-background px-4 py-6 sm:p-8 lg:p-12">
      <div className="grid w-full max-w-[1120px] overflow-hidden rounded-surface border bg-card shadow-login lg:min-h-[720px] lg:grid-cols-[1.15fr_1fr]">
        <section
          aria-label="Site photos"
          aria-roledescription="carousel"
          className="login-carousel relative h-72 min-w-0 overflow-hidden border-b border-border bg-login-panel sm:h-96 lg:h-auto lg:min-h-[720px] lg:border-b-0 lg:border-r"
        >
          <div
            className="absolute inset-0 flex transition-transform duration-700 ease-in-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${photoIndex * 100}%)` }}
          >
            {sitePhotos.map((photo, index) => (
              <div
                key={photo.src}
                aria-hidden={photoIndex !== index}
                className="relative h-full w-full shrink-0"
              >
                {failedImages[photo.src] ? (
                  <div className="absolute inset-0 flex items-center justify-center text-login-foreground">
                    <Siren aria-hidden="true" className="h-14 w-14" />
                    <span className="sr-only">Image unavailable. Choose another slide.</span>
                  </div>
                ) : (
                  <img
                    src={photo.src}
                    alt={photo.label}
                    width={900}
                    height={900}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: index === 0 ? "70% center" : "center" }}
                    onError={() => setFailedImages((failed) => ({ ...failed, [photo.src]: true }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent"
          />
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => selectPhoto(photoIndex - 1)}
            className="login-carousel-arrow absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ChevronLeft aria-hidden="true" className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => selectPhoto(photoIndex + 1)}
            className="login-carousel-arrow absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ChevronRight aria-hidden="true" className="h-6 w-6" />
          </button>
          <div
            className="absolute inset-x-0 bottom-4 flex justify-center"
            role="group"
            aria-label="Choose a site photo"
          >
            {sitePhotos.map((photo, index) => (
              <button
                key={photo.src}
                type="button"
                aria-label={`Show ${photo.label.toLowerCase()}`}
                aria-pressed={photoIndex === index}
                onClick={() => selectPhoto(index)}
                className="flex h-11 w-9 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
              >
                <span
                  className={`block h-2.5 rounded-full border border-white transition-all motion-reduce:transition-none ${photoIndex === index ? "w-6 bg-white" : "w-2.5 bg-white/40 hover:bg-white/80"}`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={slideshowPaused ? "Play slideshow" : "Pause slideshow"}
            onClick={() => setSlideshowPaused((paused) => !paused)}
            className="absolute bottom-4 right-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {slideshowPaused ? (
              <Play aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Pause aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </section>

        <section
          aria-labelledby="login-title"
          className="flex min-w-0 flex-col px-6 py-8 sm:px-10 lg:px-12 lg:py-10"
        >
          <div className="flex flex-1 flex-col justify-center">
            <div
              aria-label="Merdeka companies"
              className="mb-7 grid grid-cols-3 items-center gap-3 rounded-lg bg-white px-2 py-5"
            >
              <img
                src="/images/brand/mti-corporate.svg"
                alt="Merdeka Tsingshan Indonesia"
                width={138}
                height={30}
                className="h-12 w-full object-contain"
              />
              <img
                src="/images/brand/mcg-logo.png"
                alt="Merdeka Copper Gold"
                width={2800}
                height={1226}
                className="h-12 w-full object-contain"
              />
              <img
                src="/images/brand/mbm-logo.png"
                alt="Merdeka Battery Materials"
                width={438}
                height={108}
                className="h-12 w-full object-contain"
              />
            </div>
            <div className="mb-6 flex flex-col items-center justify-center gap-3 rounded-lg bg-white px-4 py-2">
              <img
                src="/images/brand/mti-connect-logo/logo.svg"
                alt="MTI Connect"
                width={640}
                height={144}
                className="h-auto w-full max-w-[300px]"
              />
              <p className="text-center text-xs text-muted-foreground">
                Terhubung. Terinformasi. Terlindungi.
              </p>
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
                  className="h-11 rounded-md bg-card shadow-none"
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
                    className="h-11 rounded-md bg-card pr-12 shadow-none"
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
