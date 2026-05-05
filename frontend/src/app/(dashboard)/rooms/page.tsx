"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Search,
  Filter,
  Loader2,
  DoorOpen,
  FileSignature
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
        return <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">Đang ở</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">


      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> Chọn tòa nhà
              </label>
              <SearchableSelect
                options={[
                  { value: "ALL", label: "Tất cả" },
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
                  })),
                ]}
                value={filterBuilding}
                onValueChange={(val) => {
                  setFilterBuilding(val || "ALL");
                  setPage(1);
                }}
                placeholder="Tất cả"
                searchPlaceholder="Tìm kiếm nhà..."
              />
            </div>
            
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Filter className="w-4 h-4" /> Trạng thái
              </label>
              <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val || "ALL"); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tất cả">
                    {filterStatus === "ALL" ? "Tất cả" : 
                     filterStatus === "EMPTY" ? "Phòng trống" :
                     filterStatus === "DEPOSITED" ? "Đã cọc" :
                     filterStatus === "OCCUPIED" ? "Đang ở" : "Tất cả"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  <SelectItem value="EMPTY">Phòng trống</SelectItem>
                  <SelectItem value="DEPOSITED">Đã cọc</SelectItem>
                  <SelectItem value="OCCUPIED">Đang ở</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow flex flex-col h-full border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-xl font-bold">{room.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {room.floor ? `${buildings.find(b => b.id === room.floor.building_id)?.name || ""} - ${room.floor.name}` : "Chưa xếp tầng"}
                  </p>
                </div>
                {getStatusBadge(room.status)}
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 mb-4 space-y-1.5">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Giá thuê: </span>
                    <span className="font-semibold text-primary">{formatCurrency(room.base_rent)}</span>
                  </p>
                  {room.room_class && (
                    <p className="text-sm text-muted-foreground">Loại: {room.room_class.name}</p>
                  )}
                </div>
                
                {(room.status === "EMPTY" || room.status === "DEPOSITED") && (
                  <Button 
                    variant="default" 
                    className="w-full mt-auto" 
                    onClick={() => router.push(`/contracts/new?building_id=${room.floor?.building_id}&room_id=${room.id}`)}
                  >
                    <FileSignature className="w-4 h-4 mr-2" />
                    Ký hợp đồng
                  </Button>
                )}
                {room.status === "OCCUPIED" && (
                  <Button 
                    variant="secondary" 
                    className="w-full mt-auto opacity-50 cursor-not-allowed" 
                    disabled
                  >
                    Đã có người ở
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
