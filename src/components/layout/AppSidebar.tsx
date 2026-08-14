import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BellRing,
  PlusCircle,
  HeartPulse,
  Users,
  MonitorSmartphone,
  MessageCircle,
  FileText,
  BarChart3,
  Settings,
  ScrollText,
  Siren,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const primaryItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Notification Center", url: "/notifications", icon: BellRing },
  { title: "Create Notification", url: "/notifications/new", icon: PlusCircle },
  { title: "Wellness Programs", url: "/wellness-programs", icon: HeartPulse },
];

const manageItems = [
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Devices", url: "/devices", icon: MonitorSmartphone },
  { title: "WhatsApp Gateway", url: "/whatsapp", icon: MessageCircle },
  { title: "Templates", url: "/templates", icon: FileText },
];

const systemItems = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/"));

  const renderGroup = (label: string, items: typeof primaryItems) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emergency text-emergency-foreground">
            <Siren className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">MTI Alert</span>
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              Emergency Notification
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operations", primaryItems)}
        {renderGroup("Management", manageItems)}
        {renderGroup("System", systemItems)}
      </SidebarContent>
    </Sidebar>
  );
}
