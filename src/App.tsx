import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import Contacts from './components/Contacts';
import Settings from './components/Settings';
import Monitor from './components/settings/Monitor';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { CompanySettingsProvider, useCompanySettings } from './hooks/useCompanySettings';
import { api } from './services/api';
import Scheduling from './components/Scheduling';
import Kanban from './components/Kanban';
import WebhookListener from './components/WebhookListener';
import { Toaster } from 'sonner';
import { OnboardingWizard } from './components/OnboardingWizard';
import { useOnboardingStatus } from './hooks/useOnboardingStatus';

// Componente de Layout que envolve a aplicação principal
const AppLayout: React.FC = () => {
  const auth = (() => { try { return useAuth(); } catch (e) { return null as any; } })();
  if (!auth?.user) {
    return <Navigate to="/auth" replace />;
  }
  const wizardEnabled = import.meta.env.VITE_WIZARD_ENABLED !== 'false';
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isComplete, hasSeenWizard, loading } = useOnboardingStatus();

  // Show wizard automatically on first load if not complete and never seen
  useEffect(() => {
    if (wizardEnabled && !loading && !isComplete && !hasSeenWizard) {
      setShowOnboarding(true);
    }
  }, [loading, isComplete, hasSeenWizard, wizardEnabled]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[128px] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"></div>
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[128px] pointer-events-none translate-x-1/2 translate-y-1/2 z-0"></div>
      
      <Sidebar />
      
      <main className="flex-1 h-full overflow-hidden relative z-10 flex flex-col">
        {/* Top Border Gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50 z-20"></div>
        
        <div className="flex-1 w-full h-full relative">
          <Outlet context={{ showOnboarding, setShowOnboarding }} />
        </div>
      </main>

      <OnboardingWizard 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />
    </div>
  );
};

const ProtectedMonitor: React.FC = () => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const auth = (() => { try { return useAuth(); } catch (e) { return null as any; } })();
  const user = auth?.user ?? null;
  const cs = (() => { try { return useCompanySettings(); } catch (e) { return null as any; } })();

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (cs?.isAdmin) { if (mounted) setAllowed(true); return; }
      if (!user) { if (mounted) setAllowed(false); return; }
      try {
        const team = await api.fetchTeam();
        const member = team.find((t: any) => t.email === user.email || t.id === user.id);
        if (mounted) setAllowed(!!(member && (member.role === 'admin' || member.role === 'manager')));
      } catch (e) {
        if (mounted) setAllowed(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [user, cs]);

  if (allowed === null) return <div />; // loading placeholder
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <Monitor />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CompanySettingsProvider>
        <WebhookListener serverUrl={import.meta.env.VITE_WEBHOOK_SERVER || '/api'} />
        <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          {/* All Routes (No Auth Required) */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pipeline" element={<Kanban />} />
            <Route path="/chat" element={<ChatInterface />} />
            <Route path="/monitor" element={<ProtectedMonitor />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/scheduling" element={<Scheduling />} />
            <Route path="/team" element={<Navigate to="/settings" replace />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          
          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </BrowserRouter>
      </CompanySettingsProvider>
      <Toaster 
        position="top-right"
        richColors
        theme="dark"
      />
    </AuthProvider>
  );
};

export default App;
