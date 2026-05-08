"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api";
import {
  DoorOpen,
  FileSignature,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  status: "EMPTY" | "DEPOSITED" | "OCCUPIED";
  base_rent: number;
  floor: { name: string; building_id: string };
  room_class?: { name: string };
}

export default function RoomsPage() {
  const router = useRouter();
  
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  
  const [filterBuilding, setFilterBuilding] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const fetchBuildings = async () => {
    try {
      const res = await apiFetch<{data: Building[], meta: any}>("/api/buildings?limit=1000");
      setBuildings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBuildingsLoading(false);
    }
  };

  const fetchRooms = async () => {
    setLoading(true);
    try {
      let url = `/api/rooms?page=${page}&limit=12`;
      const params = new URLSearchParams();
      if (filterBuilding !== "ALL") params.append("building_id", filterBuilding);
      if (filterStatus !== "ALL") params.append("status", filterStatus);
      
      if (params.toString()) {
        url += `&${params.toString()}`;
      }
      
      const res = await apiFetch<{data: Room[], meta: any}>(url);
      setRooms(res.data);
      setTotalPages(res.meta.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [page, filterBuilding, filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EMPTY":
        return <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-md">Phòng trống</span>;
      case "DEPOSITED":
        return <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md">Đã cọc</span>;
      case "OCCUPIED":
        return <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">Đang thuê</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">


      {/* Filters */}
      <div className="grid gap-3 my-3">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Toà nhà</Label>
          <SearchableSelect
            options={[
              { value: "ALL", label: "Tất cả nhà" },
              ...buildings.map((b) => {
                const fullAddress = [b.address, b.ward].filter(Boolean).join(", ") || "Chưa có địa chỉ";
                return {
                  value: b.id,
                  label: `${b.name} - ${fullAddress}`,
                  displayLabel: b.name,
                };
              }),
            ]}
            value={filterBuilding}
            onValueChange={(val) => {
              setFilterBuilding(val || "ALL");
              setPage(1);
            }}
            placeholder="Tất cả nhà"
            searchPlaceholder="Tìm kiếm nhà..."
            className="bg-background rounded-xl w-full h-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
        <Button 
          variant={filterStatus === "ALL" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "ALL" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("ALL"); setPage(1); }}
        >
          Tất cả
        </Button>
        <Button 
          variant={filterStatus === "EMPTY" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "EMPTY" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("EMPTY"); setPage(1); }}
        >
          Phòng trống
        </Button>
        <Button 
          variant={filterStatus === "DEPOSITED" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "DEPOSITED" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("DEPOSITED"); setPage(1); }}
        >
          Đã cọc
        </Button>
        <Button 
          variant={filterStatus === "OCCUPIED" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "OCCUPIED" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("OCCUPIED"); setPage(1); }}
        >
          Đang thuê
        </Button>
      </div>

      {/* Room List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rooms.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed">
          <DoorOpen className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h3 className="font-semibold text-xl mb-1">Không có dữ liệu</h3>
          <p className="text-muted-foreground">Không tìm thấy phòng nào phù hợp với bộ lọc hiện tại.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow bg-card border shadow-sm rounded-xl overflow-hidden flex flex-col h-full p-0 gap-0">
              <div className="bg-primary/5 border-b border-primary/10 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="font-semibold text-primary truncate text-sm sm:text-base">
                  {room.name}
                </div>
              </div>
              
              <CardContent className="px-2.5 sm:px-4 pb-3 pt-3 flex-1 flex flex-col space-y-2.5">
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {room.floor ? `${buildings.find(b => b.id === room.floor.building_id)?.name || ""} - ${room.floor.name}` : "Chưa xếp tầng"}
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="text-muted-foreground">Giá thuê: </span>
                    <span className="font-semibold text-primary">{formatCurrency(room.base_rent)}</span>
                  </p>
                  {room.room_class && (
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Loại: {room.room_class.name}</p>
                  )}
                  <div className="pt-1.5">
                    {getStatusBadge(room.status)}
                  </div>
                </div>
                
                {(room.status === "EMPTY" || room.status === "DEPOSITED") && (
                  <Button 
                    variant="default" 
                    className="w-full mt-auto px-2" 
                    onClick={() => router.push(`/contracts/new?building_id=${room.floor?.building_id}&room_id=${room.id}`)}
                  >
                    <FileSignature className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                    <span className="truncate">Ký hợp đồng</span>
                  </Button>
                )}
                {room.status === "OCCUPIED" && (
                  <Button 
                    variant="secondary" 
                    className="w-full mt-auto opacity-50 cursor-not-allowed px-2" 
                    disabled
                  >
                    <span className="truncate">Đang thuê</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <div className="mt-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink 
                    isActive={page === i + 1}
                    onClick={() => setPage(i + 1)}
                    className="cursor-pointer"
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
