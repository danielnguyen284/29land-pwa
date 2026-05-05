"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { AddBuildingWizard } from "@/components/buildings/AddBuildingWizard";
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
      const res = await apiFetch<{data: Building[], meta: any}>(`/api/buildings?page=${pageToFetch}&limit=12`);
      setBuildings(res.data);
      setTotalPages(res.meta.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải danh sách tòa nhà");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings(page);
  }, [page]);

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {buildings.map((building) => (
              <Card 
                key={building.id} 
                className="hover:shadow-md transition-shadow cursor-pointer bg-primary/5 border-none shadow-sm rounded-xl overflow-hidden"
                onClick={() => router.push(`/buildings/${building.id}`)}
              >
                <div className="flex flex-row items-center justify-between p-4 pb-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <span className="text-base font-semibold text-foreground">{building.name}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardContent className="px-4 pb-4 pt-1">
                  <p className="text-sm text-muted-foreground mb-1 line-clamp-2" title={[building.address, building.ward, building.district, building.province].filter(Boolean).join(", ")}>
                    • {[building.address, building.ward, building.district, building.province].filter(Boolean).join(", ") || "Chưa có địa chỉ"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    • {building.rooms_count || 0} phòng
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="text-[11px] font-medium text-emerald-600 border border-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Đang hoạt động
                    </div>
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
