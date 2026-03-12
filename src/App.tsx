import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDashboard } from "@/hooks/use-dashboard";
import Layout from "@/components/DashboardLayout";
import HomePage from "@/pages/HomePage";
import TPListPage from "@/pages/TPListPage";
import TPDetailPage from "@/pages/TPDetailPage";
import RappresentantiPage from "@/pages/RappresentantiPage";
import PrioritaPage from "@/pages/PrioritaPage";
import TopPerformerPage from "@/pages/TopPerformerPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function DashboardApp() {
  const {
    selectedMonth, setSelectedMonth, uploadCSV, confirmUpload,
    enrichedRecords, hasGiacenza, availableMonths, resetData,
  } = useDashboard();

  return (
    <Layout
      selectedMonth={selectedMonth}
      availableMonths={availableMonths}
      onMonthChange={setSelectedMonth}
      onUpload={uploadCSV}
      onConfirmUpload={confirmUpload}
      hasGiacenza={hasGiacenza}
      onReset={resetData}
    >
      <Routes>
        <Route path="/" element={<HomePage records={enrichedRecords} hasGiacenza={hasGiacenza} selectedMonth={selectedMonth} />} />
        <Route path="/touchpoints" element={<TPListPage records={enrichedRecords} hasGiacenza={hasGiacenza} />} />
        <Route path="/touchpoints/:id" element={<TPDetailPage hasGiacenza={hasGiacenza} />} />
        <Route path="/rappresentanti" element={<RappresentantiPage records={enrichedRecords} hasGiacenza={hasGiacenza} allMonths={useDashboard().allMonths} availableMonths={availableMonths} selectedMonth={selectedMonth} />} />
        <Route path="/priorita" element={<PrioritaPage records={enrichedRecords} hasGiacenza={hasGiacenza} selectedMonth={selectedMonth} />} />
        <Route path="/top-performer" element={<TopPerformerPage records={enrichedRecords} hasGiacenza={hasGiacenza} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <DashboardApp />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
