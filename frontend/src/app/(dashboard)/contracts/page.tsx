"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api";
import { intervalToDuration, isBefore, format } from "date-fns";
import {
  Ban,
  Building2,
  Calendar,
  Home,
  Info,
  Loader2,
  Plus,
  RefreshCw
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

interface Building {
  id: string;
  name: string;
  address?: string;
  ward?: string;
  district?: string;
  province?: string;
}

interface Room {
  id: string;
  name: string;
  floor: { name: string };
  status: string;
}

interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  cccd: string | null;
}

interface Contract {
  id: string;
  room_id: string;
  representative_tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  status: "NEW" | "ACTIVE" | "EXPIRED" | "TERMINATED" | "CANCELLED";
  document_photos: string[];
  auto_renew_months: number | null;
  created_at: string;
  room: {
    id: string;
    name: string;
    floor: { 
      name: string;
      building: {
        name: string;
        address?: string;
        ward?: string;
        district?: string;
        province?: string;
      };
    };
    status: string;
  };
  representative_tenant: Tenant;
}

type TabKey = "ALL" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "DEPOSIT" | "TERMINATED" | "CANCELLED";

export default function ContractsPage() {
  const router = useRouter();
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("Tất cả");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("Tất cả");
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [renewingContract, setRenewingContract] = useState<Contract | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);

  useEffect(() => {
    fetchBuildings();
    fetchContracts();
  }, []);

  useEffect(() => {
    fetchContracts();
    if (selectedBuildingId !== "Tất cả") {
      fetchRooms(selectedBuildingId, setRooms);
    } else {
      setRooms([]);
      setSelectedRoomId("Tất cả");
    }
  }, [selectedBuildingId, selectedRoomId]);

  const fetchBuildings = async () => {
    try {
      const res = await apiFetch<{data: Building[]}>("/api/buildings?limit=1000");
      setBuildings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRooms = async (buildingId: string, setter: (rooms: Room[]) => void) => {
    try {
      const res = await apiFetch<{data: Room[]}>(`/api/rooms?building_id=${buildingId}&limit=1000`);
      setter(res.data);
    } catch (err) {
      console.error(err);
    }
  };


  const fetchContracts = async () => {
    try {
      setLoading(true);
      let url = "/api/contracts?";
      if (selectedBuildingId !== "Tất cả") url += `building_id=${selectedBuildingId}&`;
      if (selectedRoomId !== "Tất cả") url += `room_id=${selectedRoomId}&`;
      
      const data = await apiFetch<Contract[]>(url);
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelContract = async (contract: Contract) => {
    const reason = window.prompt(`Nhập lý do hủy hợp đồng phòng ${contract.room.name} (Bắt buộc):`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do hủy hợp đồng");
      return;
    }
    
    try {
      setCancelingId(contract.id);
      await apiFetch(`/api/rooms/${contract.room.id}/contracts/${contract.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ notes: reason })
      });
      toast.success("Đã hủy hợp đồng thành công");
      fetchContracts();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi hủy hợp đồng");
    } finally {
      setCancelingId(null);
    }
  };

  const handleReactivateContract = async (contract: Contract) => {
    if (!window.confirm(`Bạn có chắc chắn muốn kích hoạt lại hợp đồng phòng ${contract.room.name}?`)) return;

    try {
      setReactivatingId(contract.id);
      await apiFetch(`/api/rooms/${contract.room.id}/contracts/${contract.id}/reactivate`, {
        method: "POST"
      });
      toast.success("Đã kích hoạt lại hợp đồng");
      fetchContracts();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi kích hoạt lại");
    } finally {
      setReactivatingId(null);
    }
  };
  
  const handleRenew = async (months: number) => {
    if (!renewingContract) return;
    
    try {
      setIsRenewing(true);
      const currentEnd = new Date(renewingContract.end_date);
      
      // Calculation logic: Set to 1st of month, add months, then get last day of that month
      const date = new Date(currentEnd);
      date.setDate(1);
      date.setMonth(date.getMonth() + months);
      
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const newEndDateStr = format(lastDay, "yyyy-MM-dd");

      await apiFetch(`/api/rooms/${renewingContract.room.id}/contracts/${renewingContract.id}`, {
        method: "PATCH",
        body: JSON.stringify({ end_date: newEndDateStr })
      });
      
      toast.success(`Đã gia hạn hợp đồng đến ngày ${format(lastDay, "dd/MM/yyyy")}`);
      setRenewingContract(null);
      fetchContracts();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi gia hạn hợp đồng");
    } finally {
      setIsRenewing(false);
    }
  };

  // Helper to categorize contracts
  const today = new Date();
  const oneMonthLater = new Date();
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  const isExpiring = (endDateStr: string) => {
    const end = new Date(endDateStr);
    return end >= today && end <= oneMonthLater;
  };

  const isExpiredLocally = (endDateStr: string) => {
    const end = new Date(endDateStr);
    return isBefore(end, today);
  };

  const getRemainingTimeLabel = (endDateStr: string) => {
    const end = new Date(endDateStr);
    if (isBefore(end, today)) return "Hết hạn";
    
    const duration = intervalToDuration({ 
      start: today, 
      end: end 
    });
    
    const parts = [];
    if (duration.years) parts.push(`${duration.years} năm`);
    if (duration.months) parts.push(`${duration.months} tháng`);
    if (duration.days) parts.push(`${duration.days} ngày`);
    
    if (parts.length === 0) return "Hết hạn hôm nay";
    return `Còn hạn: ${parts.join(" ")}`;
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      switch (activeTab) {
        case "ALL": return true;
        case "ACTIVE": return c.status === "ACTIVE" && !isExpiring(c.end_date) && !isExpiredLocally(c.end_date);
        case "EXPIRING": return c.status === "ACTIVE" && isExpiring(c.end_date);
        case "EXPIRED": return c.status === "EXPIRED" || (c.status === "ACTIVE" && isExpiredLocally(c.end_date));
        case "DEPOSIT": return c.status === "NEW";
        case "TERMINATED": return c.status === "TERMINATED";
        case "CANCELLED": return c.status === "CANCELLED";
        default: return true;
      }
    });
  }, [contracts, activeTab]);

  const counts = useMemo(() => {
    return {
      ALL: contracts.length,
      ACTIVE: contracts.filter(c => c.status === "ACTIVE" && !isExpiring(c.end_date) && !isExpiredLocally(c.end_date)).length,
      EXPIRING: contracts.filter(c => c.status === "ACTIVE" && isExpiring(c.end_date)).length,
      EXPIRED: contracts.filter(c => c.status === "EXPIRED" || (c.status === "ACTIVE" && isExpiredLocally(c.end_date))).length,
      DEPOSIT: contracts.filter(c => c.status === "NEW").length,
      TERMINATED: contracts.filter(c => c.status === "TERMINATED").length,
      CANCELLED: contracts.filter(c => c.status === "CANCELLED").length,
    };
  }, [contracts]);

  const handleAddClick = () => {
    router.push("/contracts/new");
  };

  const handleContractClick = (c: Contract) => {
    router.push(`/contracts/${c.id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN");
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hợp đồng</h1>
          <p className="text-muted-foreground">
            Quản lý hợp đồng thuê phòng
          </p>
        </div>
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" /> Thêm mới
        </Button>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto">
        {/* Filters */}
        <div className="grid gap-3 my-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Toà nhà</Label>
            <SearchableSelect
              options={[
                { value: "Tất cả", label: "Tất cả nhà" },
                ...buildings.map((b) => {
                  const fullAddress = [b.address, b.ward].filter(Boolean).join(", ") || "Chưa có địa chỉ";
                  return {
                    value: b.id,
                    label: `${b.name} - ${fullAddress}`,
                    displayLabel: b.name,
                  };
                }),
              ]}
              value={selectedBuildingId}
              onValueChange={(v) => setSelectedBuildingId(v || "Tất cả")}
              placeholder="Tất cả nhà"
              searchPlaceholder="Tìm kiếm nhà..."
              className="bg-background rounded-xl w-full h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Phòng</Label>
            <SearchableSelect
              options={[
                { value: "Tất cả", label: "Tất cả phòng" },
                ...rooms.map((r) => ({ value: r.id, label: r.name })),
              ]}
              value={selectedRoomId}
              onValueChange={(v) => setSelectedRoomId(v || "Tất cả")}
              placeholder="Chọn phòng"
              searchPlaceholder="Tìm kiếm phòng..."
              emptyMessage="Không tìm thấy phòng."
              disabled={selectedBuildingId === "Tất cả"}
              className="bg-background rounded-xl w-full h-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
          <Button 
            variant={activeTab === "ALL" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "ALL" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("ALL")}
          >
            Tất cả ({counts.ALL})
          </Button>
          <Button 
            variant={activeTab === "ACTIVE" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "ACTIVE" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("ACTIVE")}
          >
            Còn hạn ({counts.ACTIVE})
          </Button>
          <Button 
            variant={activeTab === "EXPIRING" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "EXPIRING" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("EXPIRING")}
          >
            Sắp hết hạn ({counts.EXPIRING})
          </Button>
          <Button 
            variant={activeTab === "DEPOSIT" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "DEPOSIT" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("DEPOSIT")}
          >
            Cọc ({counts.DEPOSIT})
          </Button>
          <Button 
            variant={activeTab === "EXPIRED" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "EXPIRED" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("EXPIRED")}
          >
            Hết hạn ({counts.EXPIRED})
          </Button>
          <Button 
            variant={activeTab === "TERMINATED" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "TERMINATED" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("TERMINATED")}
          >
            Đã thanh lý ({counts.TERMINATED})
          </Button>
          <Button 
            variant={activeTab === "CANCELLED" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "CANCELLED" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("CANCELLED")}
          >
            Đã hủy ({counts.CANCELLED})
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-10">{error}</div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {/* Empty State Vector Illustration matched loosely to the screenshot (Drawer & Bee) */}
            <div className="relative w-48 h-48 mb-4 opacity-50 flex items-center justify-center">
              <svg width="150" height="150" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M40 80 L160 80 L180 150 L20 150 Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>
                <path d="M20 150 L180 150" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                <path d="M40 80 L20 150" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                <path d="M160 80 L180 150" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                <rect x="20" y="150" width="160" height="40" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>
                <circle cx="100" cy="170" r="10" stroke="currentColor" strokeWidth="6"/>
                <path d="M70 170 L90 170" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                <path d="M110 170 L130 170" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                {/* Bee */}
                <path d="M140 50 C140 60 130 65 130 65 C130 65 120 60 120 50 C120 40 130 35 130 35 C130 35 140 40 140 50Z" stroke="currentColor" strokeWidth="4"/>
                <path d="M130 35 C125 25 135 15 140 25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M130 35 C135 25 125 15 120 25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M130 65 C120 80 100 80 80 80" stroke="currentColor" strokeWidth="4" strokeDasharray="6 6"/>
                <path d="M80 80 C60 80 60 60 40 60" stroke="currentColor" strokeWidth="4" strokeDasharray="6 6"/>
              </svg>
            </div>
            <p className="text-muted-foreground font-medium">Không tìm thấy hợp đồng nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredContracts.map(c => {
              const b = c.room?.floor?.building;
              const isTerminated = c.status === "TERMINATED";

              return (
              <Card 
                key={c.id} 
                className="hover:shadow-md transition-shadow cursor-pointer bg-card border shadow-sm rounded-xl overflow-hidden flex flex-col p-0 gap-0"
                onClick={() => handleContractClick(c)}
              >
                <div className="bg-primary/5 border-b border-primary/10 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="font-semibold text-primary truncate text-sm sm:text-base">
                    {c.representative_tenant?.name || "Khách thuê"}
                  </div>
                </div>
                <CardContent className="px-2.5 sm:px-4 pb-2 pt-3 space-y-2.5 flex-1">
                  {c.status === "ACTIVE" && isExpiring(c.end_date) ? (
                    <div className="flex items-center text-xs sm:text-sm text-amber-600 font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Sắp hết hạn</span>
                    </div>
                  ) : c.status === "ACTIVE" && isExpiredLocally(c.end_date) ? (
                    <div className="flex items-center text-xs sm:text-sm text-destructive font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Hết hạn</span>
                    </div>
                  ) : c.status === "EXPIRED" ? (
                    <div className="flex items-center text-xs sm:text-sm text-destructive font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Hết hạn</span>
                    </div>
                  ) : c.status === "ACTIVE" ? (
                    <div className="flex items-center text-xs sm:text-sm text-emerald-600 font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>{getRemainingTimeLabel(c.end_date)}</span>
                    </div>
                  ) : c.status === "NEW" ? (
                    <div className="flex items-center text-xs sm:text-sm text-blue-600 font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Đã cọc</span>
                    </div>
                  ) : c.status === "CANCELLED" ? (
                    <div className="flex items-center text-xs sm:text-sm text-destructive font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Đã hủy</span>
                    </div>
                  ) : c.status === "TERMINATED" ? (
                    <div className="flex items-center text-xs sm:text-sm text-muted-foreground font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Đã thanh lý</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs sm:text-sm text-muted-foreground font-medium">
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                      <span>Không rõ</span>
                    </div>
                  )}

                  <div className="flex items-start text-xs sm:text-sm text-primary font-bold">
                    <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                    <span className="truncate">{c.room?.name || "Phòng"}</span>
                  </div>
                  
                  <div className="flex items-start text-xs sm:text-sm text-muted-foreground font-medium">
                    <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                    <span className="truncate" title={b?.name}>{b?.name || "Chưa có toà nhà"}</span>
                  </div>

                  <div className="flex items-start text-xs sm:text-sm text-muted-foreground font-medium">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2 leading-relaxed">
                      {formatDate(c.start_date)} - {formatDate(c.end_date)}
                    </span>
                  </div>
                </CardContent>

                <div className="p-2 sm:p-4 pt-0 mt-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                  {isTerminated ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-md h-7 px-2 text-[10px] sm:text-xs text-muted-foreground"
                      disabled={true}
                    >
                      Đã thanh lý
                    </Button>
                  ) : c.status === "CANCELLED" ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-md h-7 px-2 text-[10px] sm:text-xs"
                      onClick={(e) => { e.stopPropagation(); handleReactivateContract(c); }}
                      disabled={reactivatingId === c.id || cancelingId === c.id}
                    >
                      {reactivatingId === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Kích hoạt lại
                    </Button>
                  ) : c.status === "ACTIVE" ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-md h-7 px-2 text-[10px] sm:text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); handleCancelContract(c); }}
                      disabled={cancelingId === c.id || reactivatingId === c.id}
                    >
                      {cancelingId === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                      Hủy
                    </Button>
                  ) : null}

                  {c.status === "ACTIVE" && isExpiring(c.end_date) && (
                    <>
                      {c.auto_renew_months ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-md h-7 px-2 text-[10px] sm:text-xs bg-muted opacity-80"
                          disabled={true}
                        >
                          Tự động gia hạn
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-md h-7 px-2 text-[10px] sm:text-xs text-primary border-primary/50 hover:bg-primary/10"
                          onClick={(e) => { e.stopPropagation(); setRenewingContract(c); }}
                        >
                          Gia hạn
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!renewingContract} onOpenChange={(open) => !open && setRenewingContract(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Gia hạn hợp đồng</DialogTitle>
            <DialogDescription>
              Chọn thời gian gia hạn cho hợp đồng phòng {renewingContract?.room.name}.
              Hợp đồng hiện tại hết hạn vào ngày {renewingContract && formatDate(renewingContract.end_date)}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 py-4">
            {[3, 6, 9, 12].map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                className="flex-1 py-6 rounded-xl border-primary/20 hover:border-primary hover:bg-primary/5 text-base font-semibold"
                disabled={isRenewing}
                onClick={() => handleRenew(m)}
              >
                {m} tháng
              </Button>
            ))}
          </div>

          {isRenewing && (
            <div className="flex items-center justify-center py-2 text-sm text-muted-foreground italic">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Đang thực hiện gia hạn...
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
