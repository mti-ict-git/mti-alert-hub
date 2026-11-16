import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
} from "lucide-react";
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

function useSectionName() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return sectionNames[pathname.split("/")[1]] ?? "Dashboard";
}

/** Services places the trail at the top of the page body, below the header title. */
export function PageBreadcrumb() {
  const sectionName = useSectionName();
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex min-w-0 items-center gap-2 text-sm">
      <Link
        to="/"
        className="rounded-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
      >
        MTI Connect
      </Link>
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span aria-current="page" className="truncate font-semibold">
        {sectionName}
      </span>
    </nav>
  );
}

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const sectionName = useSectionName();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger className="md:hidden" />
      <Button
        variant="ghost"
        size="icon"
        className="hidden h-7 w-7 text-muted-foreground md:inline-flex"
        aria-label="Go back"
        onClick={() => window.history.back()}
      >
        <ChevronLeft />
      </Button>
      <div className="min-w-0 truncate px-2 text-base font-semibold">{sectionName}</div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/notifications" aria-label="Open Notification Center">
            <Bell className="h-4 w-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-11 max-w-64 gap-2 rounded-full bg-muted px-2 font-normal hover:bg-muted/70 sm:pr-3"
              aria-label="Open account menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden min-w-0 text-left text-xs md:block">
                <div className="truncate font-medium leading-4">{user?.name ?? "Guest"}</div>
                <div className="text-[11px] leading-4 text-muted-foreground">
                  {user?.role ?? "—"}
                </div>
              </div>
              <ChevronDown aria-hidden="true" className="hidden h-3 w-3 md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel className="break-words">{user?.email}</DropdownMenuLabel>
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
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Sign out"
          title="Sign out"
          onClick={async () => {
            await logout();
            navigate({ to: "/login" });
          }}
        >
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
