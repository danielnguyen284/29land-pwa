"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Home, 
  Users, 
  Banknote, 
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  AirVent,
  Contact,
  FileSignature,
  Receipt,
  ClipboardCheck,
  Siren,
  Mail,
  Store,
  FileEdit,
  QrCode,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  period: string;
  occupancy: {
    total: number;
    occupied: number;
    rate: number;
  };
  revenue: {
    expected: number;
    collected: number;
    outstanding: number;
  };
  expenses: {
    total: number;
  };
  tickets: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  tenants: {
    total: number;
  };
  contracts: {
    total: number;
    expiring: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [isRevenueVisible, setIsRevenueVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Read user from localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRole(user.role);
      } catch (e) {
        console.error(e);
      }
    }

    const fetchDashboard = async () => {
      try {
        const result = await apiFetch<DashboardData>("/api/reports/dashboard");
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-destructive gap-2">
        <AlertCircle className="h-10 w-10" />
        <p className="font-medium">{error || "Không có dữ liệu"}</p>
      </div>
    );
  }

  const { occupancy, revenue, period, tenants, contracts } = data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatPeriod = (p: string) => {
    if (!p) return "";
    const [year, month] = p.split("-");
    return `${month}/${year}`;
  };

  // Actions Grid matching the image
  const allActions = [
    { id: "staff", label: "Người dùng", icon: Contact, href: "/admin/users", roles: ["ADMIN"] },
    { id: "buildings", label: "Nhà", icon: Building2, href: "/buildings", roles: ["ADMIN", "MANAGER", "OWNER"] },
    // { id: "devices", label: "Thiết bị", icon: AirVent, href: "/devices", roles: ["ADMIN", "MANAGER", "TECHNICIAN"] },
    { id: "rooms", label: "Phòng", icon: Home, href: "/rooms", roles: ["ADMIN", "MANAGER", "OWNER"] },
    { id: "contracts", label: "Hợp đồng", icon: FileSignature, href: "/contracts", roles: ["ADMIN", "MANAGER"] },
    { id: "customers", label: "Khách hàng", icon: Users, href: "/tenants", roles: ["ADMIN", "MANAGER"] },
    { id: "close_numbers", label: "Chốt số", icon: FileEdit, href: "/meter-readings", roles: ["ADMIN", "MANAGER"] },
    // { id: "approvals", label: "Phê duyệt", icon: ClipboardCheck, href: "/approvals", roles: ["ADMIN", "OWNER"] },
    // { id: "finance", label: "Thu chi", icon: Banknote, href: "/finance", roles: ["ADMIN", "MANAGER", "OWNER"] },
    // { id: "incidents", label: "Sự cố", icon: Siren, href: "/tickets", roles: ["ADMIN", "MANAGER", "TECHNICIAN", "OWNER"] },
    // { id: "feedback", label: "Góp ý", icon: Mail, href: "/feedback", roles: ["ADMIN", "MANAGER"] },
    // { id: "listings", label: "Tin đăng", icon: Store, href: "/listings", roles: ["ADMIN", "MANAGER"] },
    { id: "invoices", label: "Hoá đơn", icon: Receipt, href: "/billing", roles: ["ADMIN", "MANAGER", "OWNER"] },
    { id: "reports", label: "Thống kê", icon: BarChart3, href: "/reports", roles: ["ADMIN", "OWNER"] },
    // { id: "qr_wallet", label: "Ví QR", icon: QrCode, href: "/finance", roles: ["ADMIN", "MANAGER", "OWNER"] },
  ];

  // Filter based on user roles
  const quickActions = allActions.filter(action => action.roles.includes(userRole) || userRole === "");
  
  // Slice to 8 if not expanded
  const displayedActions = isExpanded ? quickActions : quickActions.slice(0, 8);

  return (
    <div 
      className="pb-10 min-h-screen bg-slate-50/50 dark:bg-background bg-cover bg-center bg-no-repeat bg-fixed bg-[url('/dashboard-bg-modern.svg')] dark:bg-[url('/dashboard-bg-modern-dark.svg')]"
    >
      {/* Top 4 Overlapping Cards */}
      <div className="pt-6 px-4 max-w-5xl mx-auto relative z-10">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          
          {/* Card 1: Phòng trống */}
          <Card className="rounded-2xl border-none shadow-md overflow-hidden">
            <CardContent className="p-3 md:p-5 flex flex-col justify-between h-full min-h-[110px]">
              <div className="flex items-start gap-2 mb-2">
                <div className="p-2 md:p-2.5 bg-primary/10 rounded-full text-primary shrink-0">
                  <Home className="w-4 h-4 md:w-5 md:h-5"/>
                </div>
                <div className="pt-0.5">
                  <p className="text-sm md:text-base font-bold leading-none">Phòng trống</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-tight">Số phòng còn trống</p>
                </div>
              </div>
              <div className="flex justify-between items-end mt-2">
                <p className="text-2xl md:text-3xl font-bold tracking-tight">
                  {occupancy.total - occupancy.occupied} <span className="text-sm font-medium text-muted-foreground">/ {occupancy.total}</span>
                </p>
                <p className="text-xs md:text-sm text-rose-500 font-semibold">{Math.round((1 - occupancy.rate / 100) * 100)}%</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Khách hàng */}
          <Card className="rounded-2xl border-none shadow-md overflow-hidden">
            <CardContent className="p-3 md:p-5 flex flex-col justify-between h-full min-h-[110px]">
              <div className="flex items-start gap-2 mb-2">
                <div className="p-2 md:p-2.5 bg-primary/10 rounded-full text-primary shrink-0">
                  <Users className="w-4 h-4 md:w-5 md:h-5"/>
                </div>
                <div className="pt-0.5">
                  <p className="text-sm md:text-base font-bold leading-none">Khách hàng</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-tight">Tổng số khách hàng</p>
                </div>
              </div>
              <div className="flex justify-between items-end mt-2">
                <p className="text-2xl md:text-3xl font-bold tracking-tight">{tenants?.total || 0}</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Hợp đồng */}
          <Card className="rounded-2xl border-none shadow-md overflow-hidden">
            <CardContent className="p-3 md:p-5 flex flex-col justify-between h-full min-h-[110px]">
              <div className="flex items-start gap-2 mb-2">
                <div className="p-2 md:p-2.5 bg-primary/10 rounded-full text-primary shrink-0">
                  <FileSignature className="w-4 h-4 md:w-5 md:h-5"/>
                </div>
                <div className="pt-0.5">
                  <p className="text-sm md:text-base font-bold leading-none">Hợp đồng</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-tight">HĐ sắp hết hạn</p>
                </div>
              </div>
              <div className="flex justify-between items-end mt-2">
                <p className="text-2xl md:text-3xl font-bold tracking-tight">{contracts?.expiring || 0} <span className="text-sm font-medium text-muted-foreground">/ {contracts?.total || 0}</span></p>
                {contracts?.total > 0 && contracts?.expiring > 0 && (
                  <p className="text-xs md:text-sm text-rose-500 font-semibold">{Math.round((contracts.expiring / contracts.total) * 100)}%</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Doanh thu */}
          <Card className="rounded-2xl border-none shadow-md overflow-hidden">
            <CardContent className="p-3 md:p-5 flex flex-col justify-between h-full min-h-[110px]">
              <div className="flex items-start gap-2 mb-2">
                <div 
                  className="p-2 md:p-2.5 bg-primary/10 rounded-full text-primary shrink-0 cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => setIsRevenueVisible(!isRevenueVisible)}
                >
                  {isRevenueVisible ? <Eye className="w-4 h-4 md:w-5 md:h-5"/> : <EyeOff className="w-4 h-4 md:w-5 md:h-5"/>}
                </div>
                <div className="pt-0.5">
                  <p className="text-sm md:text-base font-bold leading-none">Doanh thu tháng</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-tight">{formatPeriod(period)}</p>
                </div>
              </div>
              <div className="flex justify-between items-end mt-2">
                <p className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
                  {isRevenueVisible ? formatCurrency(revenue.collected) : "******"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expandable Action Grid */}
      <div className="px-4 mt-6 max-w-5xl mx-auto relative z-10">
        <Card className="rounded-3xl border-none shadow-md pb-2 pt-2">
          <CardContent className="p-5">
            <div className="grid grid-cols-4 gap-y-7 gap-x-2 md:gap-x-4">
              {displayedActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <button 
                    key={idx} 
                    onClick={() => router.push(action.href)} 
                    className="flex flex-col items-center gap-2.5 group active:scale-95 transition-transform"
                  >
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-primary-gradient-start to-primary-gradient-end text-primary-foreground rounded-2xl md:rounded-3xl flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all">
                      <Icon className="w-6 h-6 md:w-7 md:h-7"/>
                    </div>
                    <span className="text-[11px] md:text-xs font-semibold text-center leading-tight whitespace-pre-wrap">{action.label}</span>
                  </button>
                )
              })}
            </div>
            
            {quickActions.length > 8 && (
              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors py-2 px-4 rounded-full hover:bg-primary/5"
                >
                  {isExpanded ? "Thu gọn" : "Mở rộng"}
                  {isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

