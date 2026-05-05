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
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3"/> Đã thanh toán</Badge>;
      case "PARTIAL":
        return <Badge variant="secondary" className="text-orange-600 bg-orange-100 border-orange-200"><AlertCircle className="mr-1 h-3 w-3"/> Thu thiếu</Badge>;
      default:
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3"/> Chưa thanh toán</Badge>;
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

      <div className="grid md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Tòa nhà</label>
          <SearchableSelect
            options={buildings.map((b) => ({
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
            }))}
            value={filterBuilding}
            onValueChange={setFilterBuilding}
            placeholder="Chọn nhà..."
            searchPlaceholder="Tìm kiếm nhà..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Phòng</label>
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
            placeholder="Chọn phòng..."
            searchPlaceholder="Tìm kiếm phòng..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Kỳ hóa đơn</label>
          <Input 
            type="month" 
            value={filterPeriod} 
            onChange={(e) => setFilterPeriod(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Trạng thái</label>
          <Select value={filterStatus} onValueChange={(val) => val && setFilterStatus(val)}>
            <SelectTrigger>
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              <SelectItem value="UNPAID">Chưa thanh toán</SelectItem>
              <SelectItem value="PARTIAL">Thu thiếu (Một phần)</SelectItem>
              <SelectItem value="PAID">Đã thanh toán đủ</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {invoices.map((inv) => (
            <Card key={inv.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className={`h-1.5 w-full ${inv.status === 'PAID' ? 'bg-green-500' : inv.status === 'PARTIAL' ? 'bg-orange-500' : 'bg-red-500'}`} />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-1">
                  <Badge variant="outline" className="font-normal text-xs">{formatPeriod(inv.billing_period)}</Badge>
                  {getStatusBadge(inv.status)}
                </div>
                <CardTitle className="text-xl">{inv.room?.name || "Phòng ?"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-3">
                <div className="flex justify-between items-center py-1 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">Tổng tiền:</span>
                  <span className="font-semibold text-lg">{formatCurrency(inv.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">Đã thanh toán:</span>
                  <span className="font-medium text-green-600">{formatCurrency(inv.paid_amount)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">Còn nợ:</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount)))}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-2 bg-muted/10">
                <Button 
                  variant="ghost" 
                  className="w-full text-primary hover:bg-primary/10" 
                  onClick={() => router.push(`/billing/${inv.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Xem chi tiết & Cập nhật
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}


    </div>
  );
}
