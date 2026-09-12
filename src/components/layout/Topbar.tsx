import { Bell, ChevronRight, LogOut, User as UserIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const section = pathname.split("/")[1];
  const sectionNames: Record<string, string> = {
    notifications: "Notification Center",
    "wellness-programs": "Wellness Programs",
    employees: "Employees",
    devices: "Devices",
    whatsapp: "WhatsApp Gateway",
    templates: "Templates",
    reports: "Reports",
    settings: "Settings",
    "audit-logs": "Audit Logs",
  };

  return (
    <header className="sticky top-0 z-30 flex h-18 shrink-0 items-center gap-3 border-b bg-card px-4 md:px-6">
      <SidebarTrigger />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <Link
          to="/"
          className="rounded-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
        >
          MTI Alert
        </Link>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{sectionNames[section] ?? "Control Room"}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/notifications" aria-label="Open Notification Center">
            <Bell className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="hidden gap-2 md:inline-flex"
          aria-label="Sign out"
          onClick={async () => {
            await logout();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 gap-3" aria-label="Open account menu">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden text-left text-sm md:block">
                <div className="font-medium leading-none">{user?.name ?? "Guest"}</div>
                <div className="text-xs text-muted-foreground">{user?.role ?? "—"}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
