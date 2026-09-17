import { canVisit } from "@/lib/access";
import { Button } from "@/components/ui/button";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
  Link,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Toaster } from "@/components/ui/sonner";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app")({
  async beforeLoad() {
    if (typeof window === "undefined") {
      return;
    }

    if (!authService.getCurrentUser()) {
      throw redirect({ to: "/login" });
    }

    const user = await authService.validateSession();
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && typeof window !== "undefined" && !user) {
      navigate({ to: "/login" });
    }
  }, [mounted, navigate, user]);

  useEffect(() => {
    const validate = () => {
      if (document.visibilityState === "visible") void authService.validateSession(true);
    };
    const timer = window.setInterval(validate, 30000);
    window.addEventListener("focus", validate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", validate);
    };
  }, []);

  if (!mounted || !user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-w-0 flex-1 p-4 md:p-6">
            {canVisit(user, pathname) ? (
              <Outlet />
            ) : (
              <section
                className="mx-auto max-w-lg space-y-4 rounded-lg border bg-card p-6"
                aria-labelledby="access-denied-title"
              >
                <h1 id="access-denied-title" className="text-xl font-semibold">
                  Access restricted
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your role does not have access to this page. Contact your MTI Connect
                  administrator if your responsibilities have changed.
                </p>
                <Button asChild variant="outline">
                  <Link to="/">Back to dashboard</Link>
                </Button>
              </section>
            )}
          </main>
        </SidebarInset>
      </div>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
