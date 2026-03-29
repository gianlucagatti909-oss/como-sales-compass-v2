import { Component, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDashboard } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { migrateFromLocalStorage } from "@/lib/migrate-localStorage";
import Layout from "@/components/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import TPListPage from "@/pages/TPListPage";
import TPDetailPage from "@/pages/TPDetailPage";
import RappresentantiPage from "@/pages/RappresentantiPage";
import PrioritaPage from "@/pages/PrioritaPage";
import TopPerformerPage from "@/pages/TopPerformerPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import { useMemo, useEffect } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="glass-card p-8 max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-bold text-destructive">Errore imprevisto</h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              className="text-sm underline text-primary"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            >
              Ricarica la pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    </div>
  );
}

function DashboardApp() {
  // Run one-time localStorage → Supabase migration on first load
  useEffect(() => {
    migrateFromLocalStorage().catch(err => console.error("[App] Migration error:", err));
  }, []);

  const { user, login, logout, loading: authLoading } = useAuth();
  const {
    selectedMonth, setSelectedMonth, uploadCSV, confirmUpload,
    enrichedRecords, hasGiacenza, availableMonths, resetData, allMonths, refresh,
    loading: dashLoading,
  } = useDashboard();

  // Show loading while auth or initial data is being fetched
  if (authLoading || (user && dashLoading)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  // Filter records by representative if user is a representative
  const filteredRecords = (() => {
    if (user.role === "admin") return enrichedRecords;
    if (!user.rappresentante) return [];
    return enrichedRecords.filter(r => r.rappresentante === user.rappresentante);
  })();

  return <DashboardContent
    user={user}
    isAdmin={user.role === "admin"}
    filteredRecords={filteredRecords}
    selectedMonth={selectedMonth}
    setSelectedMonth={setSelectedMonth}
    uploadCSV={uploadCSV}
    confirmUpload={confirmUpload}
    hasGiacenza={hasGiacenza}
    availableMonths={availableMonths}
    resetData={resetData}
    allMonths={allMonths}
    refresh={refresh}
    logout={logout}
  />;
}

// Separate component to allow hooks to run after user is known
function DashboardContent({
  user, isAdmin, filteredRecords, selectedMonth, setSelectedMonth,
  uploadCSV, confirmUpload, hasGiacenza, availableMonths, resetData,
  allMonths, refresh, logout,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  isAdmin: boolean;
  filteredRecords: ReturnType<typeof useDashboard>["enrichedRecords"];
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  uploadCSV: ReturnType<typeof useDashboard>["uploadCSV"];
  confirmUpload: ReturnType<typeof useDashboard>["confirmUpload"];
  hasGiacenza: boolean;
  availableMonths: string[];
  resetData: () => Promise<void>;
  allMonths: ReturnType<typeof useDashboard>["allMonths"];
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const availableRappresentanti = useMemo(() => {
    const set = new Set<string>();
    allMonths.forEach(m => m.records.forEach(r => { if (r.rappresentante) set.add(r.rappresentante); }));
    return [...set].sort();
  }, [allMonths]);

  return (
    <Layout
      selectedMonth={selectedMonth}
      availableMonths={availableMonths}
      onMonthChange={setSelectedMonth}
      onUpload={uploadCSV}
      onConfirmUpload={confirmUpload}
      hasGiacenza={hasGiacenza}
      onReset={resetData}
      onLogout={logout}
      userName={user.displayName}
      userRole={user.role}
      isAdmin={isAdmin}
      records={filteredRecords}
      hasGiacenzaProp={hasGiacenza}
      allMonths={allMonths}
    >
      <Routes>
        <Route path="/" element={<HomePage records={filteredRecords} hasGiacenza={hasGiacenza} selectedMonth={selectedMonth} allMonths={allMonths} />} />
        <Route path="/touchpoints" element={<TPListPage records={filteredRecords} hasGiacenza={hasGiacenza} />} />
        <Route path="/touchpoints/:id" element={<TPDetailPage hasGiacenza={hasGiacenza} allMonths={allMonths} />} />
        <Route path="/rappresentanti" element={
          isAdmin
            ? <RappresentantiPage records={filteredRecords} hasGiacenza={hasGiacenza} allMonths={allMonths} availableMonths={availableMonths} selectedMonth={selectedMonth} />
            : <div className="glass-card p-8 text-center text-muted-foreground">Accesso riservato al Sales Manager.</div>
        } />
        <Route path="/priorita" element={<PrioritaPage records={filteredRecords} hasGiacenza={hasGiacenza} selectedMonth={selectedMonth} allMonths={allMonths} />} />
        <Route path="/top-performer" element={<TopPerformerPage records={filteredRecords} hasGiacenza={hasGiacenza} />} />
        <Route path="/impostazioni" element={
          <SettingsPage
            isAdmin={isAdmin}
            currentUserId={user.id}
            onDataChange={refresh}
            availableRappresentanti={availableRappresentanti}
            onUpload={uploadCSV}
            onConfirmUpload={confirmUpload}
          />
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <DashboardApp />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
