
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Funnel from "./pages/Funnel";
import Agent from "./pages/Agent";
import Automations from "./pages/Automations";
import Meetings from "./pages/Meetings";
import ContactDetail from "./pages/ContactDetail";
import RecordingDetail from "./pages/RecordingDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/funnel" element={<Funnel />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/contact/:id" element={<ContactDetail />} />
          <Route path="/recording/:id" element={<RecordingDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
