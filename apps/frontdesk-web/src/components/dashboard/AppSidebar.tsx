import { type ReactNode } from "react"
import { useParams, useNavigate } from "react-router"
import {
  BarChart2, PhoneCall, MessageSquare, Settings, LogOut, CalendarDays, Calendar, CreditCard, HelpCircle,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

type Tab = "overview" | "calls" | "messages" | "upcoming" | "calendar" | "billing" | "settings" | "help"

const NAV_ITEMS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "overview",  label: "Overview",        icon: <BarChart2     size={16} /> },
  { id: "calls",     label: "Call Logs",        icon: <PhoneCall     size={16} /> },
  { id: "messages",  label: "Messages",         icon: <MessageSquare size={16} /> },
  { id: "upcoming",  label: "Upcoming Events",  icon: <CalendarDays  size={16} /> },
  { id: "calendar",  label: "Calendar",         icon: <Calendar      size={16} /> },
  { id: "billing",   label: "Billing",          icon: <CreditCard    size={16} /> },
  { id: "settings",  label: "Settings",         icon: <Settings      size={16} /> },
  { id: "help",      label: "Help",             icon: <HelpCircle    size={16} /> },
]

export { NAV_ITEMS }
export type { Tab }

export function AppSidebar() {
  const { tab } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const { profile, business, signOut } = useAuth()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <img src="/logo-v2.png" alt="Front Desk" className="h-8 w-8 shrink-0 object-contain" />
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">Front Desk</p>
            {business?.name && (
              <p className="truncate text-xs text-sidebar-foreground/60">{business.name}</p>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={tab === item.id}
                    tooltip={item.label}
                    onClick={() => navigate(`/dashboard/${item.id}`)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile?.firstName} {profile?.lastName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            title="Sign out"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
