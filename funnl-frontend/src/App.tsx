import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from './contexts/AuthContext'
import { UserProvider } from './contexts/UserContext';
import LoginPage from './pages/auth/login'
import RegisterPage from './pages/auth/register'
import ResetPasswordPage from './pages/auth/reset-password'
import VerifyEmailPage from './pages/auth/verify-email'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Index from "./pages/Index";
import Funnel from "./pages/Funnel";
import Pipeline from "./pages/Pipeline";
import Agent from "./pages/Agent";
import Automations from "./pages/Automations";
import Meetings from "./pages/Meetings";
import ContactDetail from "./pages/ContactDetail";
import RecordingDetail from "./pages/RecordingDetail";
import NotFound from "./pages/NotFound";
import HubSpotCallback from "./pages/auth/hubspot-callback";
import Settings from "./pages/Settings";
import DashboardPage from "./pages/dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <UserProvider>
          <Router>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/" element={<Index />} />
              <Route path="/funnel" element={<Funnel />} />
              <Route path="/pipeline" element={<Pipeline />} />

              {/* Rutas de autenticación */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
              <Route path="/auth/hubspot-callback" element={<HubSpotCallback />} />
              <Route path="/apiauth/hubspot/callback" element={<HubSpotCallback />} />

              {/* Rutas protegidas */}
              <Route path="/" element={<ProtectedRoute />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="agent" element={<Agent />} />
                <Route path="automations" element={<Automations />} />
                <Route path="meetings" element={<Meetings />} />
                <Route path="settings" element={<Settings />} />
                <Route path="contact/:id" element={<ContactDetail />} />
                <Route path="recording/:id" element={<RecordingDetail />} />
              </Route>

              {/* Ruta 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </UserProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
