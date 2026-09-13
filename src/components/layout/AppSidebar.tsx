import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BellRing,
  PlusCircle,
  HeartPulse,
  Users,
  Building2,
  MonitorSmartphone,
  MessageCircle,
  FileText,
  BarChart3,
  Settings,
  ScrollText,
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
  useSidebar,
} from "@/components/ui/sidebar";

const primaryItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Notification Center", url: "/notifications", icon: BellRing },
  { title: "Create Notification", url: "/notifications/new", icon: PlusCircle },
  { title: "Wellness Programs", url: "/wellness-programs", icon: HeartPulse },
];

const manageItems = [
  { title: "Organization", url: "/organization", icon: Building2 },
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
  const { setOpenMobile } = useSidebar();
  const activeItem = [...primaryItems, ...manageItems, ...systemItems]
    .filter(({ url }) =>
      url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/"),
    )
    .sort((a, b) => b.url.length - a.url.length)[0];
  const isActive = (url: string) => activeItem?.url === url;

  const renderGroup = (label: string, items: typeof primaryItems) => (
    <SidebarGroup className="px-2 py-3 group-data-[collapsible=icon]:px-2">
      <SidebarGroupLabel className="mb-1 px-4 text-[11px] font-normal tracking-wide text-sidebar-foreground/75">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className="h-11 gap-3 rounded-sm px-4 text-[13px] font-normal md:h-9 data-[active=true]:font-medium"
              >
                <Link
                  to={item.url}
                  activeOptions={{ exact: true }}
                  aria-current={isActive(item.url) ? "page" : undefined}
                  onClick={() => setOpenMobile(false)}
                >
                  <item.icon aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
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
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden">
        <img
          src="/images/sidebar/services-sidebar-background.png"
          alt=""
          aria-hidden="true"
          width={212}
          height={223}
          draggable={false}
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full select-none group-data-[collapsible=icon]:hidden"
        />
        <SidebarHeader className="h-22 justify-center px-4 group-data-[collapsible=icon]:px-0">
          <div className="flex items-center gap-2 px-2 py-3">
            <img
              src="/images/brand/mti-connect-logo/logo-icon.svg"
              alt=""
              width={144}
              height={144}
              className="h-9 w-9 shrink-0 rounded-md bg-white"
            />
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-base font-semibold text-foreground">MTI Connect</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/75">
                Employee Communications
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-0">
          {renderGroup("Operations", primaryItems)}
          {renderGroup("Management", manageItems)}
          {renderGroup("System", systemItems)}
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
