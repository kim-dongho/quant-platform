import { StockDashboardWidget } from "@/widgets/stock-dashboard/ui/stock-dashboard-widget";

export const HomePage = () => {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🚀 Quant Dashboard</h1>
        <StockDashboardWidget />
      </div>
    </main>
  );
};