"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface Building {
  id: string;
  name: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
}

interface Room {
  id: string;
  name: string;
}
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, Loader2, FileText, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: string;
  room_id: string;
  contract_id: string;
  billing_period: string;
  issue_date: string;
  rent_amount: string;
  rolling_balance: string;
  total_amount: string;
  paid_amount: string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  room?: { id: string; name: string };
}

export default function BillingPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filterBuilding, setFilterBuilding] = useState<string>("");
  
  const [filterPeriod, setFilterPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filterRoom, setFilterRoom] = useState<string>("ALL");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Generate Dialog state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      const data = await apiFetch<{ data: Building[] }>("/api/buildings?limit=1000");
      setBuildings(data.data || []);
      if (data.data && data.data.length > 0) {
        setFilterBuilding(data.data[0].id);
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải danh sách tòa nhà");
    }
  };

  useEffect(() => {
    if (filterBuilding) {
      fetchRooms();
    }
  }, [filterBuilding]);

  const fetchRooms = async () => {
    try {
      const data = await apiFetch<{ data: Room[] }>(`/api/rooms?building_id=${filterBuilding}&limit=1000`);
      setRooms(data.data || []);
      setFilterRoom("ALL");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (filterBuilding && filterPeriod) {
      fetchInvoices();
    }
  }, [filterBuilding, filterRoom, filterPeriod, filterStatus]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      let url = `/api/invoices?building_id=${filterBuilding}&period=${filterPeriod}`;
      if (filterStatus !== "ALL") {
        url += `&status=${filterStatus}`;
      }
      if (filterRoom !== "ALL") {
        url += `&room_id=${filterRoom}`;
      }
      const data = await apiFetch<Invoice[]>(url);
      setInvoices(data || []);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải danh sách hóa đơn");
    } finally {
      setIsLoading(false);
    }
  };



  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge variant="default" className="bg-emerald-600 text-[10px] sm:text-xs px-1.5 py-0 sm:px-2.5 sm:py-0.5"><CheckCircle className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3"/> Đã thu đủ</Badge>;
      case "PARTIAL":
        return <Badge variant="secondary" className="text-amber-600 bg-amber-100 border-amber-200 text-[10px] sm:text-xs px-1.5 py-0 sm:px-2.5 sm:py-0.5"><AlertCircle className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3"/> Thu thiếu</Badge>;
      default:
        return <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2.5 sm:py-0.5"><AlertCircle className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3"/> Chưa đóng</Badge>;
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(amount));
  };

  const formatPeriod = (period?: string) => {
    if (!period) return "";
    const [year, month] = period.split("-");
    return `${month}/${year}`;
  };

  const selectedBuildingName = useMemo(() => {
    return buildings.find(b => b.id === filterBuilding)?.name || "";
  }, [buildings, filterBuilding]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Filters */}
      <div className="grid gap-3 my-3">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Toà nhà</Label>
          <SearchableSelect
            options={[
              { value: "", label: "Tất cả nhà" },
              ...buildings.map((b) => ({
                value: b.id,
                label: `${b.name}${
                  [b.address, b.ward, b.district, b.province]
                    .filter(Boolean)
                    .join(", ")
                    ? ` - ${[b.address, b.ward, b.district, b.province]
                        .filter(Boolean)
                        .join(", ")}`
                    : ""
                }`,
                displayLabel: b.name,
              })),
            ]}
            value={filterBuilding}
            onValueChange={(v) => setFilterBuilding(v || "")}
            placeholder="Tất cả nhà"
            searchPlaceholder="Tìm kiếm nhà..."
            className="bg-background rounded-xl w-full h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Phòng</Label>
          <SearchableSelect
            options={[
              { value: "ALL", label: "Tất cả phòng" },
              ...rooms.map((r) => ({
                value: r.id,
                label: r.name,
              }))
            ]}
            value={filterRoom}
            onValueChange={setFilterRoom}
            placeholder="Tất cả phòng"
            searchPlaceholder="Tìm kiếm phòng..."
            className="bg-background rounded-xl w-full h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Kỳ hóa đơn</Label>
          <Input 
            type="month" 
            value={filterPeriod} 
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="bg-background rounded-xl h-10 w-full"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
        <Button 
          variant={filterStatus === "ALL" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "ALL" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => setFilterStatus("ALL")}
        >
          Tất cả
        </Button>
        <Button 
          variant={filterStatus === "UNPAID" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "UNPAID" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => setFilterStatus("UNPAID")}
        >
          Chưa thanh toán
        </Button>
        <Button 
          variant={filterStatus === "PARTIAL" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "PARTIAL" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => setFilterStatus("PARTIAL")}
        >
          Thu thiếu
        </Button>
        <Button 
          variant={filterStatus === "PAID" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "PAID" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => setFilterStatus("PAID")}
        >
          Đã thanh toán
        </Button>
      </div>
      


      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center p-12 border rounded-lg bg-muted/20 flex flex-col items-center">
          <FileText className="h-12 w-12 mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium">Chưa có hóa đơn nào</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Không tìm thấy hóa đơn nào cho nhà và kỳ này.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {invoices.map((inv) => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow bg-card border shadow-sm rounded-xl overflow-hidden flex flex-col h-full p-0 gap-0">
              <div className="bg-primary/5 border-b border-primary/10 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="font-semibold text-primary truncate text-sm sm:text-base">
                  {inv.room?.name || "Phòng ?"}
                </div>
              </div>
              
              <CardContent className="px-2.5 sm:px-4 pb-3 pt-3 flex-1 flex flex-col space-y-2.5">
                <div className="flex justify-between items-center pb-1">
                  <Badge variant="outline" className="font-normal text-[10px] sm:text-xs bg-background px-1.5 py-0 sm:px-2.5 sm:py-0.5">{formatPeriod(inv.billing_period)}</Badge>
                  {getStatusBadge(inv.status)}
                </div>
                
                <div className="grid gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1">
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground truncate mr-2">Tổng:</span>
                    <span className="font-semibold shrink-0">{formatCurrency(inv.total_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground truncate mr-2">Đã thu:</span>
                    <span className="font-medium text-emerald-600 shrink-0">{formatCurrency(inv.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground truncate mr-2">Nợ:</span>
                    <span className="font-medium text-destructive shrink-0">
                      {formatCurrency(Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount)))}
                    </span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="pt-0 border-t bg-muted/20 p-2 sm:p-3">
                <Button 
                  variant="ghost" 
                  className="w-full h-8 text-xs sm:text-sm text-primary" 
                  onClick={() => router.push(`/billing/${inv.id}`)}
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Xem chi tiết
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}


    </div>
  );
}
