import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OSProvider } from "@/context/OSContext";
import { SiteHeader } from "@/components/SiteHeader";
import { CookieBanner } from "@/components/CookieBanner";
import Index from "./pages/Index.tsx";
import Lessons from "./pages/Lessons.tsx";
import LessonRoute from "./pages/LessonRoute.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OSProvider>
          <SiteHeader />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/lessons" element={<Lessons />} />
            <Route path="/lessons/:slug" element={<LessonRoute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieBanner />
        </OSProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
