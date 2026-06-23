import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import RolePage from "./pages/RolePage";
import RealityCheckPage from "./pages/RealityCheckPage";
import SearchResults from "./pages/SearchResults";
import ProviderPage from "./pages/ProviderPage";
import Personalise from "./pages/Personalise";
import Profile from "./pages/Profile";
import MyDecisions from "./pages/MyDecisions";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import HowItWorks from "./pages/HowItWorks";
import ForInstitutions from "./pages/ForInstitutions";
import Support from "./pages/Support";
import Sources from "./pages/Sources";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Faq from "./pages/Faq";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/role/:slug" element={<RolePage />} />
                <Route path="/role/:slug/reality-check" element={<RealityCheckPage />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/provider/:id" element={<ProviderPage />} />
                <Route path="/personalise" element={<Personalise />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/my-decisions" element={<MyDecisions />} />
                <Route path="/my-decisions/:decisionId/opportunities" element={<OpportunitiesPage />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/for-institutions" element={<ForInstitutions />} />
                <Route path="/support" element={<Support />} />
                <Route path="/sources" element={<Sources />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
