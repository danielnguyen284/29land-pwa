"use client";

import { useEffect, useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { format, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Home, 
  Building2, 
  Calendar,
  Loader2,
  Filter
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

interface Building {
  id: string;
  name: string;
}

interface RevenueStatsData {
  aggregate: {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
    occupancyRate: number;
    totalTenants: number;
  };
  chartData: Array<{
    period: string;
    revenue: number;
    expense: number;
    profit: number;
  }>;
}

export function RevenueStatistics() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(
    format(subMonths(new Date(), 5), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  
  const [data, setData] = useState<RevenueStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch buildings for filter
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const result = await apiFetch<{ data: Building[] }>("/api/buildings");
        setBuildings(result.data || []);
      } catch (error) {
        console.error("Error fetching buildings:", error);
      }
    };
    fetchBuildings();
  }, []);

  // Fetch stats data
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        let url = `/api/reports/revenue-stats?startDate=${startDate}&endDate=${endDate}`;
        if (selectedBuildings.length > 0) {
          url += `&building_ids=${selectedBuildings.join(",")}`;
        }
        const result = await apiFetch<RevenueStatsData>(url);
        setData(result);
      } catch (error) {
        console.error("Error fetching revenue stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [startDate, endDate, selectedBuildings]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000000) {
      return (value / 1000000000).toFixed(1) + " Tỷ";
    }
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + " Tr";
    }
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  const toggleBuilding = (id: string) => {
    setSelectedBuildings(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const formatMonth = (period: string) => {
    const [year, month] = period.split("-");
    return `T${month}/${year.slice(2)}`;
  };

  if (!data) return null;

  return (
    <div className="space-y-6 mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight">Thống kê & Báo cáo</h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Building Filter */}
          <Popover>
            <PopoverTrigger render={
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                <Building2 className="mr-2 h-4 w-4" />
                Tòa nhà
                {selectedBuildings.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 font-normal rounded-sm">
                    {selectedBuildings.length}
                  </Badge>
                )}
              </Button>
            } />
            <PopoverContent className="w-[200px] p-0" align="end">
              <div className="p-2 space-y-1">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm h-8"
                  onClick={() => setSelectedBuildings([])}
                >
                  Tất cả tòa nhà
                </Button>
                {buildings.map(b => (
                  <Button
                    key={b.id}
                    variant={selectedBuildings.includes(b.id) ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm h-8 truncate"
                    onClick={() => toggleBuilding(b.id)}
                  >
                    <div className="truncate">{b.name}</div>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 bg-background border rounded-md p-1 h-9">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm bg-transparent border-none outline-none focus:ring-0 px-2 w-[120px]"
            />
            <span className="text-muted-foreground">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm bg-transparent border-none outline-none focus:ring-0 px-2 w-[120px]"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center border rounded-2xl bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Doanh thu ròng</p>
                    <p className="text-2xl font-bold mt-2">{formatCurrency(data.aggregate.netProfit)}</p>
                  </div>
                  <div className={`p-2 rounded-full ${data.aggregate.netProfit >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'}`}>
                    {data.aggregate.netProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-emerald-500 font-medium">+ {formatCompactCurrency(data.aggregate.totalRevenue)}</span>
                  <span className="mx-2 text-muted-foreground">/</span>
                  <span className="text-rose-500 font-medium">- {formatCompactCurrency(data.aggregate.totalExpense)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tỉ lệ lấp đầy</p>
                    <p className="text-2xl font-bold mt-2">{data.aggregate.occupancyRate}%</p>
                  </div>
                  <div className="p-2 bg-primary/10 text-primary rounded-full">
                    <Home className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Dựa trên số phòng đang thuê
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Khách hàng</p>
                    <p className="text-2xl font-bold mt-2">{data.aggregate.totalTenants}</p>
                  </div>
                  <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 rounded-full">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Tổng số khách đang lưu trú
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Trung bình thu/tháng</p>
                    <p className="text-2xl font-bold mt-2">
                      {formatCurrency(data.chartData.length > 0 ? data.aggregate.totalRevenue / data.chartData.length : 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/30 rounded-full">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Trong {data.chartData.length} tháng gần nhất
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Biểu đồ Thu / Chi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.2)" />
                    <XAxis 
                      dataKey="period" 
                      tickFormatter={formatMonth}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCompactCurrency(value)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `Tháng ${label}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      iconType="circle"
                      formatter={(value) => <span className="text-sm font-medium">{value === 'revenue' ? 'Tổng Thu' : 'Tổng Chi'}</span>}
                    />
                    <Bar dataKey="revenue" name="Tổng Thu" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="expense" name="Tổng Chi" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
