import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useKitchenAlerts } from "@/hooks/useKitchenAlerts";
import { AttendanceGate } from "@/components/AttendanceGate";
import { ConnectionPill } from "@/components/offline/ConnectionPill";
import { FirstRunBanner } from "@/components/offline/FirstRunBanner";

export const AppLayout = () => {
  const isMobile = useIsMobile();
  useUsageTracking();
  useKitchenAlerts();

  const inner = isMobile ? (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 flex justify-end p-2 pointer-events-none">
        <div className="pointer-events-auto"><ConnectionPill /></div>
      </div>
      <main className="flex-1 p-4 pb-20 -mt-12 pt-12">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  ) : (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-6">
          <SidebarTrigger />
          <div className="ml-auto"><ConnectionPill /></div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );

  return <AttendanceGate>{inner}<FirstRunBanner /></AttendanceGate>;
};
