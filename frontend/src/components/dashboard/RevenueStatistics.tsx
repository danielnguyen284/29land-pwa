"use client";

import { format, subMonths } from "date-fns";
import {
  Loader2
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

interface Building {
  id: string;
  name: string;
  address?: string;
  ward?: string;
  district?: string;
  province?: string;
}

interface RevenueStatsData {
  aggregate: {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
    occupancyRate: number;
    totalTenants: number;
  };
  breakdown: {
    invoicesRevenue: number;
    depositsRevenue: number;
    refundExpenses: number;
    maintenanceExpenses: number;
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
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("Tất cả");
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
        if (selectedBuildingId && selectedBuildingId !== "Tất cả") {
          url += `&building_ids=${selectedBuildingId}`;
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
  }, [startDate, endDate, selectedBuildingId]);

  const formatCompactCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absValue >= 1000000000) {
      return sign + (absValue / 1000000000).toFixed(1) + " Tỷ";
    }
    if (absValue >= 1000000) {
      return sign + (absValue / 1000000).toFixed(1) + " Tr";
    }
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const formatMonth = (period: string) => {
    const [year, month] = period.split("-");
    return `T${month}/${year.slice(2)}`;
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Toà nhà</Label>
            <SearchableSelect
              options={[
                { value: "Tất cả", label: "Tất cả nhà" },
                ...buildings.map((b) => ({
                  value: b.id,
                  label: b.address ? `${b.name} - ${b.address}` : b.name,
                  displayLabel: b.name,
                })),
              ]}
              value={selectedBuildingId}
              onValueChange={(v) => setSelectedBuildingId(v || "Tất cả")}
              placeholder="Tất cả nhà"
              searchPlaceholder="Tìm kiếm nhà..."
              className="bg-background rounded-xl w-full h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Thời gian</Label>
            <div className="flex items-center gap-2 bg-background border rounded-xl px-3 h-10">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm bg-transparent border-none outline-none focus:ring-0 flex-1 min-w-[100px]"
              />
              <span className="text-muted-foreground font-medium">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm bg-transparent border-none outline-none focus:ring-0 flex-1 min-w-[100px] text-right md:text-left"
              />
            </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tổng doanh thu ròng</p>
                    <p className="text-2xl font-bold mt-2">{formatCompactCurrency(data.aggregate.netProfit)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tổng thu:</span>
                    <span className="text-emerald-500 font-medium">+{formatCompactCurrency(data.aggregate.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tổng chi:</span>
                    <span className="text-rose-500 font-medium">-{formatCompactCurrency(data.aggregate.totalExpense)}</span>
                  </div>
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
                      {formatCompactCurrency(data.chartData.length > 0 ? data.aggregate.totalRevenue / data.chartData.length : 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Trong khoảng thời gian báo cáo
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Trung bình lợi nhuận/tháng</p>
                    <p className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
                      {formatCompactCurrency(data.chartData.length > 0 ? data.aggregate.netProfit / data.chartData.length : 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Sau khi trừ tất cả chi phí
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue/Expense Details */}
          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold">Chi tiết Thu / Chi</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[40%]">Hạng mục</TableHead>
                    <TableHead>Phân loại</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead className="text-right">Tỷ trọng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Thu hóa đơn</TableCell>
                    <TableCell><span className="text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded text-xs">Thu</span></TableCell>
                    <TableCell className="text-right">{formatCompactCurrency((data.breakdown || { invoicesRevenue: 0 }).invoicesRevenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {data.aggregate.totalRevenue > 0 ? Math.round(((data.breakdown || { invoicesRevenue: 0 }).invoicesRevenue / data.aggregate.totalRevenue) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Thu cọc</TableCell>
                    <TableCell><span className="text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded text-xs">Thu</span></TableCell>
                    <TableCell className="text-right">{formatCompactCurrency((data.breakdown || { depositsRevenue: 0 }).depositsRevenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {data.aggregate.totalRevenue > 0 ? Math.round(((data.breakdown || { depositsRevenue: 0 }).depositsRevenue / data.aggregate.totalRevenue) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Hoàn cọc</TableCell>
                    <TableCell><span className="text-rose-600 font-medium bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded text-xs">Chi</span></TableCell>
                    <TableCell className="text-right">{formatCompactCurrency((data.breakdown || { refundExpenses: 0 }).refundExpenses)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {data.aggregate.totalExpense > 0 ? Math.round(((data.breakdown || { refundExpenses: 0 }).refundExpenses / data.aggregate.totalExpense) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Chi phí khác</TableCell>
                    <TableCell><span className="text-rose-600 font-medium bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded text-xs">Chi</span></TableCell>
                    <TableCell className="text-right">{formatCompactCurrency((data.breakdown || { maintenanceExpenses: 0 }).maintenanceExpenses)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {data.aggregate.totalExpense > 0 ? Math.round(((data.breakdown || { maintenanceExpenses: 0 }).maintenanceExpenses / data.aggregate.totalExpense) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Chart */}
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Biểu đồ Thu / Chi</CardTitle>
              <span className="text-xs text-muted-foreground font-medium">Đơn vị: Triệu VNĐ</span>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
              <div className="h-[350px] w-full mt-2 [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none focus:outline-none outline-none">
                <ResponsiveContainer width="100%" height="100%" className="focus:outline-none outline-none">
                  <BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis 
                      dataKey="period" 
                      tickFormatter={formatMonth}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                      dy={10}
                      dx={-5}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      width={35}
                      tickFormatter={(value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1000000)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      dx={0}
                    />
                    <Tooltip
                      cursor={false}
                      formatter={(value: any) => formatCompactCurrency(Number(value))}
                      labelFormatter={(label) => `Tháng ${label}`}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: '1px solid var(--border)', 
                        backgroundColor: 'var(--card)',
                        color: 'var(--card-foreground)',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                      }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      iconType="circle"
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey="revenue" name="Tổng Thu" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} activeBar={false} />
                    <Bar dataKey="expense" name="Tổng Chi" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} activeBar={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart: Profit vs Expense Ratio */}
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tỷ lệ Lợi nhuận / Chi phí</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="h-[300px] w-full flex flex-col md:flex-row items-center justify-center">
                <div className="h-full w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Lợi nhuận", value: Math.max(0, data.aggregate.netProfit) },
                          { name: "Chi phí", value: data.aggregate.totalExpense }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="var(--primary)" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => formatCompactCurrency(Number(value))}
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid var(--border)', 
                          backgroundColor: 'var(--card)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-4 px-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm font-medium">Lợi nhuận</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {data.aggregate.totalRevenue > 0 ? Math.round((data.aggregate.netProfit / data.aggregate.totalRevenue) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm font-medium">Chi phí</span>
                    </div>
                    <span className="text-sm font-bold text-rose-600">
                      {data.aggregate.totalRevenue > 0 ? Math.round((data.aggregate.totalExpense / data.aggregate.totalRevenue) * 100) : 0}%
                    </span>
                  </div>
                  {/* <p className="text-[11px] text-muted-foreground text-center md:text-left pt-2">
                    * Tỷ lệ được tính không bao
                  </p> */}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
