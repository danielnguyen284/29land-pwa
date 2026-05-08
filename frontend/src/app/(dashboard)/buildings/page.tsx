"use client";

import { AddBuildingWizard } from "@/components/buildings/AddBuildingWizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api";
import { Building2, Home, Info, Loader2, MapPin, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Building {
  id: string;
  name: string;
  address: string;
  province?: string;
  district?: string;
  ward?: string;
  invoice_closing_date: number;
  rooms_count?: number;
}

export default function BuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userRole, setUserRole] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRole(user.role);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const fetchBuildings = async (pageToFetch = page) => {
    setLoading(true);
    try {
      let url = `/api/buildings?page=${pageToFetch}&limit=12`;
      if (filterSearch) url += `&search=${filterSearch}`;
      const res = await apiFetch<{data: Building[], meta: any}>(url);
      setBuildings(res.data);
      setTotalPages(res.meta.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải danh sách tòa nhà");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBuildings(page);
    }, 300);
    return () => clearTimeout(timer);
  }, [page, filterSearch]);

  return (
    <div className="md:space-y-6">
      <div className="hidden md:flex items-center justify-between">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold tracking-tight">Nhà</h1>
          <p className="text-muted-foreground">
            Quản lý danh sách tòa nhà và phòng trọ
          </p>
        </div>
        {userRole === "ADMIN" && (
          <Button className="hidden md:flex" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm tòa nhà
          </Button>
        )}
        <AddBuildingWizard open={open} onOpenChange={setOpen} onSuccess={fetchBuildings} />
      </div>

      {/* Filters */}
      <div className="grid gap-3 my-3">
        <div className="space-y-1.5 relative">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Tìm kiếm nhà</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nhập tên nhà..."
              className="pl-9 bg-background rounded-xl h-10 w-full"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center text-destructive p-4">{error}</div>
      ) : buildings.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
          <h3 className="font-semibold text-lg">Chưa có tòa nhà nào</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Bắt đầu bằng việc thêm tòa nhà đầu tiên của bạn
          </p>
          {userRole === "ADMIN" && (
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Thêm tòa nhà
            </Button>
          )}
        </Card>
      ) : (
        <div className="pb-24 md:pb-0">
          <p className="text-muted-foreground font-medium mb-4 md:hidden">
            Tổng số nhà: {buildings.length}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3">
            {buildings.map((building) => (
              <Card 
                key={building.id} 
                className="hover:shadow-md transition-shadow cursor-pointer bg-card border shadow-sm rounded-xl overflow-hidden p-0 gap-0 flex flex-col"
                onClick={() => router.push(`/buildings/${building.id}`)}
              >
                <div className="bg-primary/5 border-b border-primary/10 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="font-semibold text-primary truncate text-sm sm:text-base">
                    {building.name}
                  </div>
                </div>
                <CardContent className="px-2.5 sm:px-4 pb-4 pt-3 space-y-2.5">
                  <div className="flex items-center text-xs sm:text-sm text-emerald-600 font-medium">
                    <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                    <span>Hoạt động</span>
                  </div>
                  <div className="flex items-start text-xs sm:text-sm text-primary font-bold">
                    <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                    <span>{building.rooms_count || 0} phòng</span>
                  </div>
                  <div className="flex items-start text-xs sm:text-sm text-muted-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2 leading-relaxed" title={[building.address, building.ward, building.district, building.province].filter(Boolean).join(", ")}>
                      {[building.address, building.ward, building.district, building.province].filter(Boolean).join(", ") || "Chưa có địa chỉ"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
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
      )}

      {/* Mobile Fixed Bottom Actions */}
      {userRole === "ADMIN" && (
        <div className="fixed bottom-0 left-0 w-full p-4 bg-background border-t md:hidden z-20">
          <Button className="w-full rounded-xl py-6 text-base font-semibold" onClick={() => setOpen(true)}>
            Thêm mới
          </Button>
        </div>
      )}
    </div>
  );
}
