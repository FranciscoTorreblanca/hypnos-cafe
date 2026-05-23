import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUsageTracking } from "@/hooks/useUsageTracking";

export const AppLayout = () => {
  const isMobile = useIsMobile();
  useUsageTracking();

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 p-4 pb-20">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-6">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
