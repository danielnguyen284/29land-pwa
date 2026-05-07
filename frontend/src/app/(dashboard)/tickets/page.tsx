"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, AlertCircle, Wrench, Clock, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { Ticket } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const statusConfig = {
  PENDING: { label: "Chờ xử lý", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", badgeColor: "bg-amber-100 text-amber-700", icon: Clock },
  IN_PROGRESS: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", badgeColor: "bg-blue-100 text-blue-700", icon: Wrench },
  WAITING_APPROVAL: { label: "Chờ duyệt", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", badgeColor: "bg-purple-100 text-purple-700", icon: Clock },
  NEEDS_EXPLANATION: { label: "Cần giải trình", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300", badgeColor: "bg-rose-100 text-rose-700", icon: MessageSquareWarning },
  COMPLETED: { label: "Hoàn thành", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", badgeColor: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  OVERDUE: { label: "Quá hạn", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", badgeColor: "bg-red-100 text-red-700", icon: AlertCircle },
};

const priorityConfig: Record<string, { label: string, color: string }> = {
  LOW: { label: "Thấp", color: "bg-slate-100 text-slate-700" },
  MEDIUM: { label: "Trung bình", color: "bg-blue-100 text-blue-700" },
  HIGH: { label: "Cao", color: "bg-orange-100 text-orange-700" },
  URGENT: { label: "Khẩn cấp", color: "bg-rose-100 text-rose-700 border-rose-200" },
};

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterBuilding, setFilterBuilding] = useState<string>("ALL");
  const [buildings, setBuildings] = useState<{ id: string; name: string; address?: string; ward?: string; district?: string; province?: string; }[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const res = await apiFetch<{data: any[], meta: any}>("/api/buildings?limit=1000");
        setBuildings(res.data);
      } catch (err) {
        console.error("Failed to fetch buildings", err);
      }
    };
    fetchBuildings();
  }, []);

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

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let url = `/api/tickets?page=${page}&limit=12`;
      if (filterStatus !== "ALL") {
        url += `&status=${filterStatus}`;
      }
      if (filterPriority !== "ALL") {
        url += `&priority=${filterPriority}`;
      }
      if (filterBuilding !== "ALL") {
        url += `&building_id=${filterBuilding}`;
      }
      const res = await apiFetch<{data: Ticket[], meta: any}>(url);
      setTickets(res.data);
      setTotalPages(res.meta.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/tickets/${ticketId}/expenses/approve-all`, { method: "POST" });
      toast.success("Đã duyệt tất cả chi phí cho phiếu này");
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Lỗi duyệt chi phí");
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, filterStatus, filterPriority, filterBuilding]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-destructive gap-2">
        <AlertCircle className="h-10 w-10" />
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  const getStatusBadge = (status: keyof typeof statusConfig) => {
    const conf = statusConfig[status];
    if (!conf) return null;
    return <span className={`text-xs font-medium px-2 py-1 rounded-md ${conf.badgeColor}`}>{conf.label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const conf = priorityConfig[priority] || priorityConfig["MEDIUM"];
    return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-sm border ${conf.color}`}>{conf.label}</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-140px)]">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Toà nhà</Label>
          <SearchableSelect
            options={[
              { value: "ALL", label: "Tất cả nhà" },
              ...buildings.map((b) => {
                const fullAddress = [b.address, b.ward, b.district, b.province].filter(Boolean).join(", ") || "Chưa có địa chỉ";
                return {
                  value: b.id,
                  label: fullAddress,
                  displayLabel: fullAddress,
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

        {["MANAGER", "OWNER", "ADMIN"].includes(userRole) && (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Mức độ ưu tiên</Label>
            <SearchableSelect
              options={[
                { value: "ALL", label: "Tất cả mức độ" },
                { value: "LOW", label: "Thấp" },
                { value: "MEDIUM", label: "Trung bình" },
                { value: "HIGH", label: "Cao" },
                { value: "URGENT", label: "Khẩn cấp" },
              ]}
              value={filterPriority}
              onValueChange={(val) => {
                setFilterPriority(val || "ALL");
                setPage(1);
              }}
              placeholder="Tất cả mức độ"
              className="bg-background rounded-xl w-full h-10"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-2 pb-2">
        <Button 
          variant={filterStatus === "ALL" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "ALL" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("ALL"); setPage(1); }}
        >
          Tất cả
        </Button>
        <Button 
          variant={filterStatus === "PENDING" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "PENDING" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("PENDING"); setPage(1); }}
        >
          Chờ xử lý
        </Button>
        <Button 
          variant={filterStatus === "IN_PROGRESS" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "IN_PROGRESS" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("IN_PROGRESS"); setPage(1); }}
        >
          Đang xử lý
        </Button>
        <Button 
          variant={filterStatus === "NEEDS_EXPLANATION" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "NEEDS_EXPLANATION" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("NEEDS_EXPLANATION"); setPage(1); }}
        >
          Cần giải trình
        </Button>
        <Button 
          variant={filterStatus === "WAITING_APPROVAL" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "WAITING_APPROVAL" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("WAITING_APPROVAL"); setPage(1); }}
        >
          Chờ duyệt
        </Button>
        <Button 
          variant={filterStatus === "COMPLETED" ? "default" : "outline"} 
          className={`rounded-xl whitespace-nowrap px-4 ${filterStatus === "COMPLETED" ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" : "bg-background"}`}
          onClick={() => { setFilterStatus("COMPLETED"); setPage(1); }}
        >
          Hoàn thành
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 h-[40vh] border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground gap-3">
          <Wrench className="h-12 w-12 opacity-20" />
          <p className="font-medium">Không có phiếu công việc nào</p>
        </div>
      ) : (
        <div className="flex-1 pb-20 md:pb-0">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {tickets.map((ticket) => {
              return (
                <Card 
                  key={ticket.id} 
                  className="hover:shadow-md transition-shadow bg-card border shadow-sm rounded-xl overflow-hidden flex flex-col h-full p-0 gap-0 cursor-pointer"
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                >
                  <div className={`border-b px-3 py-2.5 sm:px-4 sm:py-3 ${ticket.status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/20' : ticket.status === 'NEEDS_EXPLANATION' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-primary/5 border-primary/10'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className={`font-semibold truncate text-sm sm:text-base ${ticket.status === 'COMPLETED' ? 'text-emerald-700' : ticket.status === 'NEEDS_EXPLANATION' ? 'text-rose-700' : 'text-primary'}`}>
                        {ticket.title}
                      </div>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                  
                  <CardContent className="px-2.5 sm:px-4 pb-3 pt-3 flex-1 flex flex-col space-y-2.5">
                    <div className="flex-1 space-y-1.5">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Tòa nhà: <span className="font-medium text-foreground">{ticket.building?.name || "N/A"}</span> {ticket.room ? `- P.${ticket.room.name}` : ""}
                      </p>
                      <p className="text-[11px] sm:text-xs">
                        <span className="text-muted-foreground">Người phụ trách: </span>
                        <span className="font-semibold text-primary truncate max-w-[100px] inline-block align-bottom">{ticket.assigned_tech?.name || "Chưa gán"}</span>
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground">
                        Ngày tạo: {format(new Date(ticket.created_at), "dd/MM/yyyy", { locale: vi })}
                      </p>
                      <div className="pt-1.5 flex flex-col gap-2 items-start">
                        {getStatusBadge(ticket.status)}
                        {["OWNER", "ADMIN"].includes(userRole) && ticket.expenses && ticket.expenses.length > 0 && (
                          ticket.expenses.some(exp => exp.status === "PENDING") ? (
                            <Button 
                              size="sm" 
                              variant="default"
                              className="h-7 text-xs px-3 w-full"
                              onClick={(e) => handleApproveAll(e, ticket.id)}
                            >
                              Duyệt tất cả
                            </Button>
                          ) : (
                            <div className="h-7 w-full flex items-center justify-center px-3 text-xs font-medium text-emerald-700 bg-emerald-100/50 rounded-md border border-emerald-200">
                              Đã duyệt
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 mb-4">
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

      {/* Footer Add Button */}
      {["ADMIN", "MANAGER"].includes(userRole) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border/50 md:static md:bg-transparent md:backdrop-blur-none md:border-t-0 md:p-0 md:pt-4 md:mt-auto z-10">
          <Button 
            onClick={() => router.push("/tickets/new")} 
            className="w-full shadow-md rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:opacity-90 transition-opacity max-w-5xl mx-auto flex"
          >
            <Plus className="mr-2 h-5 w-5" />
            Tạo phiếu mới
          </Button>
        </div>
      )}
    </div>
  );
}
