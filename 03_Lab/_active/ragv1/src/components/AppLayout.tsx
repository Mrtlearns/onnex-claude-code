import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectSelector } from "@/components/ProjectSelector";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <ProjectProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-4 border-b px-4 shrink-0">
              <SidebarTrigger />
              <ProjectSelector />
            </header>
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
}
