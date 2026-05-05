"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Search,
  Plus,
  Loader2,
  FileSignature,
  Eye,
  Ban,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

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
  status: "NEW" | "ACTIVE" | "EXPIRED" | "TERMINATED";
  document_photos: string[];
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

type TabKey = "ALL" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "DEPOSIT" | "TERMINATED";

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
    if (!window.confirm(`Bạn có chắc chắn muốn hủy hợp đồng phòng ${contract.room.name}?`)) return;
    
    try {
      setCancelingId(contract.id);
      await apiFetch(`/api/rooms/${contract.room.id}/contracts/${contract.id}/cancel`, {
        method: "POST"
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

  // Helper to categorize contracts
  const today = new Date();
  const twoMonthsLater = new Date();
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

  const isExpiring = (endDateStr: string) => {
    const end = new Date(endDateStr);
    return end >= today && end <= twoMonthsLater;
  };

  const isExpiredLocally = (endDateStr: string) => {
    const end = new Date(endDateStr);
    return end < today;
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
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "ALL" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("ALL")}
          >
            Tất cả ({counts.ALL})
          </Button>
          <Button 
            variant={activeTab === "ACTIVE" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "ACTIVE" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("ACTIVE")}
          >
            Còn hạn ({counts.ACTIVE})
          </Button>
          <Button 
            variant={activeTab === "EXPIRING" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "EXPIRING" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("EXPIRING")}
          >
            Sắp hết hạn ({counts.EXPIRING})
          </Button>
          <Button 
            variant={activeTab === "DEPOSIT" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "DEPOSIT" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("DEPOSIT")}
          >
            Cọc ({counts.DEPOSIT})
          </Button>
          <Button 
            variant={activeTab === "EXPIRED" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "EXPIRED" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("EXPIRED")}
          >
            Hết hạn ({counts.EXPIRED})
          </Button>
          <Button 
            variant={activeTab === "TERMINATED" ? "default" : "outline"} 
            className={`rounded-xl whitespace-nowrap px-4 ${activeTab === "TERMINATED" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setActiveTab("TERMINATED")}
          >
            Đã hủy ({counts.TERMINATED})
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContracts.map(c => {
              const b = c.room?.floor?.building;
              const fullAddress = b ? [b.address, b.ward, b.district, b.province].filter(Boolean).join(", ") : "";
              const isTerminated = c.status === "TERMINATED";

              return (
              <Card key={c.id} className="rounded-2xl border-none shadow-sm flex flex-col">
                <CardContent className="p-4 flex-1">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-lg truncate">{c.room?.name || "Phòng"}</h3>
                      <p className="text-xs text-muted-foreground truncate">{c.room?.floor?.name} {b?.name ? `- ${b.name}` : ""}</p>
                      {fullAddress && <p className="text-xs text-muted-foreground truncate mt-0.5" title={fullAddress}>• {fullAddress}</p>}
                    </div>
                    {c.status === "ACTIVE" && isExpiring(c.end_date) ? (
                       <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Sắp hết hạn</Badge>
                    ) : c.status === "ACTIVE" && isExpiredLocally(c.end_date) ? (
                      <Badge variant="destructive" className="border-none">Hết hạn</Badge>
                    ) : c.status === "EXPIRED" ? (
                      <Badge variant="destructive" className="border-none">Hết hạn</Badge>
                    ) : c.status === "ACTIVE" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Còn hạn</Badge>
                    ) : c.status === "NEW" ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Đã cọc</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-none bg-muted">Đã hủy</Badge>
                    )}
                  </div>
                  <div className="space-y-1 mt-3 text-sm">
                    <p><span className="text-muted-foreground">Khách thuê:</span> <span className="font-medium">{c.representative_tenant?.name}</span></p>
                    <p><span className="text-muted-foreground">Bắt đầu:</span> {formatDate(c.start_date)}</p>
                    <p><span className="text-muted-foreground">Kết thúc:</span> <span className={isExpiredLocally(c.end_date) ? "text-destructive font-medium" : ""}>{formatDate(c.end_date)}</span></p>
                    <p><span className="text-muted-foreground">Tiền phòng:</span> {formatCurrency(c.rent_amount)}</p>
                  </div>
                </CardContent>
                <div className="p-4 pt-0 mt-auto flex items-center justify-end gap-2">
                  {isTerminated ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-lg"
                      onClick={() => handleReactivateContract(c)}
                      disabled={reactivatingId === c.id || cancelingId === c.id}
                    >
                      {reactivatingId === c.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      Kích hoạt lại
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleCancelContract(c)}
                      disabled={cancelingId === c.id || reactivatingId === c.id}
                    >
                      {cancelingId === c.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                      Hủy hợp đồng
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    className="rounded-lg"
                    onClick={() => handleContractClick(c)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Xem chi tiết
                  </Button>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-background border-t md:hidden z-20">
        <Button 
          className="w-full rounded-2xl py-6 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg" 
          onClick={handleAddClick}
        >
          Thêm mới
        </Button>
      </div>
    </div>
  );
}
