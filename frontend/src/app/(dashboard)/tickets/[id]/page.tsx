"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { Ticket, User } from "@/lib/types";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Camera, CheckCircle, Loader2, Phone, Plus, RefreshCw, Send, Upload, X, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string, color: string }> = {
  PENDING: { label: "Chờ xử lý", color: "bg-amber-100 text-amber-800" },
  WAITING_APPROVAL: { label: "Chờ duyệt", color: "bg-purple-100 text-purple-800" },
  COMPLETED: { label: "Hoàn thành", color: "bg-emerald-100 text-emerald-800" },
  OVERDUE: { label: "Quá hạn", color: "bg-red-100 text-red-800" },
};

const priorityConfig: Record<string, { label: string, color: string }> = {
  LOW: { label: "Ưu tiên: Thấp", color: "bg-slate-100 text-slate-800" },
  MEDIUM: { label: "Ưu tiên: Trung bình", color: "bg-blue-100 text-blue-800" },
  HIGH: { label: "Ưu tiên: Cao", color: "bg-orange-100 text-orange-800" },
  URGENT: { label: "Khẩn cấp", color: "bg-rose-100 text-rose-800 border-rose-200" },
};

const expenseStatusConfig: Record<string, { label: string, color: string }> = {
  PENDING: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", color: "bg-emerald-100 text-emerald-800" },
};

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [techs, setTechs] = useState<{value: string, label: string}[]>([]);
  
  const [newPriority, setNewPriority] = useState("");
  const [assignTechId, setAssignTechId] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState("");
  const [savingTicket, setSavingTicket] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // Expense Form State
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAccountingPeriod, setExpenseAccountingPeriod] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  const expenseFileInputRef = useRef<HTMLInputElement>(null);
  const evidenceFileInputRef = useRef<HTMLInputElement>(null);

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      setUserRole(u.role);
    }
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const t = await apiFetch<Ticket>(`/api/tickets/${params.id}`);
      setTicket(t);

      const localUserStr = localStorage.getItem("user");
      if (localUserStr && ["ADMIN", "MANAGER", "OWNER"].includes(JSON.parse(localUserStr).role)) {
        const buildingId = t.building_id;
        let buildingManagers: User[] = [];
        if (buildingId) {
          try {
            buildingManagers = await apiFetch<User[]>(`/api/buildings/${buildingId}/managers`);
          } catch (e) {
            console.warn("Failed to fetch building managers", e);
          }
        }
        const usersData = await apiFetch<User[]>("/api/users");
        
        setTechs([
          ...buildingManagers.map((m) => ({ value: m.id, label: `${m.name} (Quản lý)` })),
          ...usersData.filter(u => u.role === "TECHNICIAN").map(u => ({ value: u.id, label: `${u.name} (Kỹ thuật)` }))
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải phiếu");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploadingEvidence(true);
    try {
      const currentPhotos = [...(ticket?.evidence_photos || [])];
      for (let i = 0; i < files.length; i++) {
        if (currentPhotos.length >= 10) break;
        const file = files[i];
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const res = await apiFetch<{url: string}>("/api/upload", {
          method: "POST",
          body: JSON.stringify({ image: base64 })
        });
        currentPhotos.push(res.url);
      }
      
      await apiFetch(`/api/tickets/${ticket?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ evidence_photos: currentPhotos })
      });
      
      fetchData();
      toast.success("Đã cập nhật ảnh bằng chứng");
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setIsUploadingEvidence(false);
      if (evidenceFileInputRef.current) evidenceFileInputRef.current.value = "";
    }
  };

  const handleSaveTicket = async () => {
    if (!editingTitle.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    setSavingTicket(true);
    try {
      await apiFetch(`/api/tickets/${ticket?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editingTitle,
          description: editingDesc,
          priority: newPriority,
          assigned_tech_id: assignTechId || null
        })
      });
      toast.success("Đã cập nhật thông tin công việc");
      setIsEditDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingTicket(false);
    }
  };

  const handleUpdatePriority = async () => {
    if (!newPriority) return;
    setUpdatingPriority(true);
    try {
      await apiFetch(`/api/tickets/${ticket?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ priority: newPriority })
      });
      toast.success("Đã cập nhật mức độ ưu tiên");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleSubmitApprovalOrComplete = async () => {
    const isSubmitApproval = ticket?.expenses && ticket.expenses.length > 0;
    const newStatus = isSubmitApproval ? "WAITING_APPROVAL" : "COMPLETED";

    try {
      await apiFetch(`/api/tickets/${ticket?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(isSubmitApproval ? "Đã gửi chờ duyệt chi phí" : "Đã đánh dấu hoàn thành");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (photos.length + files.length > 3) {
      toast.error("Chỉ được tải tối đa 3 ảnh");
      if (expenseFileInputRef.current) expenseFileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    const newPhotos = [...photos];
    try {
      for (let i = 0; i < files.length; i++) {
        if (newPhotos.length >= 3) break;
        const file = files[i];
        const reader = new FileReader();
        
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const res = await apiFetch<{url: string}>("/api/upload", {
          method: "POST",
          body: JSON.stringify({ image: base64 })
        });
        
        newPhotos.push(res.url);
      }
      setPhotos(newPhotos);
    } catch (err) {
      toast.error("Lỗi upload ảnh");
    } finally {
      setUploading(false);
      if (expenseFileInputRef.current) expenseFileInputRef.current.value = "";
    }
  };

  const handleSubmitExpense = async () => {
    if (!expenseAmount) {
      toast.error("Vui lòng nhập số tiền");
      return;
    }
    setSubmittingExpense(true);
    try {
      if (editingExpenseId) {
        await apiFetch(`/api/tickets/expenses/${editingExpenseId}`, {
          method: "PATCH",
          body: JSON.stringify({
            amount: parseFloat(expenseAmount),
            description: expenseDesc,
            accounting_period: expenseAccountingPeriod,
            receipt_photos: photos
          })
        });
        toast.success("Đã cập nhật chi phí");
      } else {
        await apiFetch(`/api/tickets/${ticket?.id}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            amount: parseFloat(expenseAmount),
            description: expenseDesc,
            accounting_period: expenseAccountingPeriod,
            receipt_photos: photos
          })
        });
        toast.success("Đã báo cáo chi phí");
      }
      setIsExpenseDialogOpen(false);
      setEditingExpenseId(null);
      setExpenseAmount("");
      setExpenseDesc("");
      setExpenseAccountingPeriod("");
      setPhotos([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    try {
      await apiFetch(`/api/tickets/expenses/${expenseId}/approve`, {
        method: "PATCH",
        body: JSON.stringify({})
      });
      toast.success("Đã duyệt chi phí");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-primary"/></div>;
  if (!ticket) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy phiếu</div>;

  const status = statusConfig[ticket.status] || { label: ticket.status, color: "bg-gray-100 text-gray-700" };
  const priority = priorityConfig[ticket.priority] || priorityConfig["MEDIUM"];
  const hasUnsettledExpenses = ticket.expenses?.some(exp => exp.status !== "APPROVED");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">{ticket.title}</h1>
            <p className="text-muted-foreground text-sm">Tạo lúc: {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {["ADMIN", "MANAGER"].includes(userRole) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setEditingTitle(ticket.title);
                setEditingDesc(ticket.description || "");
                setNewPriority(ticket.priority);
                setAssignTechId(ticket.assigned_tech_id || "");
                setIsEditDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2 rotate-45 group-hover:rotate-0 transition-transform"/> Sửa thông tin
            </Button>
          )}
          <Badge variant="outline" className={`${status.color} border-none font-medium px-3 py-1`}>
            {status.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Thông tin chi tiết</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Tòa nhà / Phòng</span>
                  <span className="font-semibold">{ticket.building?.name || "N/A"} {ticket.room ? `- P.${ticket.room.name}` : ""}</span>
                  {ticket.building && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {[ticket.building.address, ticket.building.ward, ticket.building.district, ticket.building.province].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {ticket.representative_tenant && (
                    <div className="mt-2 pt-2 border-t border-dashed">
                      <span className="text-muted-foreground block mb-1 text-xs">Khách thuê (Đại diện)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ticket.representative_tenant.name}</span>
                        <a 
                          href={`tel:${ticket.representative_tenant.phone}`} 
                          className="text-emerald-600 hover:underline flex items-center gap-1 text-xs"
                        >
                          <Phone className="w-3 h-3" />
                          {ticket.representative_tenant.phone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 text-xs sm:text-sm">Người phụ trách & Người tạo</span>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{ticket.assigned_tech ? ticket.assigned_tech.name : "Chưa gán"}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">Thợ</span>
                    </div>
                    
                    {ticket.creator && (
                      <div className="pt-2 border-t border-dashed">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{ticket.creator.name}</span>
                          <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded uppercase font-bold">Người tạo</span>
                        </div>
                        <a 
                          href={`tel:${ticket.creator.phone}`} 
                          className="text-emerald-600 hover:underline flex items-center gap-1 text-xs"
                        >
                          <Phone className="w-3 h-3" />
                          {ticket.creator.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-1">Mức độ ưu tiên</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${priority.color} border-none font-medium px-3 py-1`}>
                      {priority.label}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1 text-sm">Mô tả công việc</span>
                <p className="bg-muted/50 p-3 rounded-lg text-sm">{ticket.description || "Không có mô tả"}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground block text-sm">Ảnh hiện trạng / Bằng chứng</span>
                  {userRole === "TECHNICIAN" && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs text-primary"
                        onClick={() => evidenceFileInputRef.current?.click()}
                        disabled={isUploadingEvidence}
                      >
                        {isUploadingEvidence ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Upload className="w-3 h-3 mr-1"/>}
                        Thêm ảnh
                      </Button>
                      <input 
                        type="file" 
                        ref={evidenceFileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={handleUploadEvidence} 
                      />
                    </>
                  )}
                </div>
                
                {ticket.evidence_photos && ticket.evidence_photos.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {ticket.evidence_photos.map((p, i) => (
                      <div key={i} className="relative group">
                        <a href={p} target="_blank" rel="noreferrer">
                          <img src={p} alt="evidence" className="w-24 h-24 object-cover rounded-xl border hover:opacity-80 transition-opacity" />
                        </a>
                        {userRole === "TECHNICIAN" && (
                          <button 
                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            onClick={async (e) => {
                              e.preventDefault();
                              if (!confirm("Xóa ảnh này?")) return;
                              const newPhotos = ticket.evidence_photos.filter((_, idx) => idx !== i);
                              await apiFetch(`/api/tickets/${ticket.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ evidence_photos: newPhotos })
                              });
                              fetchData();
                            }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Chưa có ảnh bằng chứng</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Chi phí & Biên lai</CardTitle>
              {["TECHNICIAN", "MANAGER", "ADMIN"].includes(userRole) && ticket.status !== "COMPLETED" && (
                <>
                  <Button size="sm" onClick={() => {
                    setEditingExpenseId(null);
                    setExpenseAmount("");
                    setExpenseDesc("");
                    setExpenseAccountingPeriod("");
                    setPhotos([]);
                    setIsExpenseDialogOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-1"/> Báo chi phí
                  </Button>

                  <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editingExpenseId ? "Chỉnh sửa chi phí" : "Báo cáo chi phí"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Số tiền (VND) <span className="text-red-500">*</span></Label>
                          <Input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="50000" />
                        </div>
                        <div>
                          <Label>Tháng hoạch toán</Label>
                          <Select value={expenseAccountingPeriod} onValueChange={val => setExpenseAccountingPeriod(val || "")}>
                            <SelectTrigger>
                              <span data-slot="select-value">
                                {expenseAccountingPeriod 
                                  ? `Tháng ${format(new Date(expenseAccountingPeriod), "MM/yyyy")}` 
                                  : "Chọn tháng"}
                              </span>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {Array.from({ length: 25 }).map((_, i) => {
                                const d = new Date();
                                d.setMonth(d.getMonth() - 12 + i);
                                const val = format(d, "yyyy-MM");
                                const lbl = `Tháng ${format(d, "MM/yyyy")}`;
                                return <SelectItem key={val} value={val}>{lbl}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Mô tả (linh kiện, công...)</Label>
                        <Textarea value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <Label>Hình ảnh hóa đơn / kết quả ({photos.length}/3)</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => expenseFileInputRef.current?.click()} disabled={uploading || photos.length >= 3}>
                            <Upload className="w-4 h-4 mr-2" />
                            Tải lên
                          </Button>
                          <input 
                            type="file" 
                            ref={expenseFileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            multiple 
                            onChange={handleUploadPhoto} 
                            disabled={uploading || photos.length >= 3}
                          />
                        </div>
                        
                        {uploading && <p className="text-xs text-muted-foreground mb-2">Đang tải ảnh lên...</p>}
                        
                        {photos.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {photos.map((url, idx) => (
                              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group bg-muted">
                                <img 
                                  src={url} 
                                  alt="Receipt doc" 
                                  className="w-full h-full object-cover" 
                                />
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                                  className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full shadow-sm hover:bg-black/80 transition-colors z-10"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div 
                            className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => expenseFileInputRef.current?.click()}
                          >
                            <Camera className="w-6 h-6 mb-2 opacity-50" />
                            <span className="text-xs">Chưa có ảnh nào</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Hủy</Button>
                      <Button onClick={handleSubmitExpense} disabled={submittingExpense || !expenseAmount}>
                        {submittingExpense && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Lưu
                      </Button>
                    </DialogFooter>
                    </DialogContent>
                  </Dialog>
 
                  {/* Unified Edit Dialog */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>Chỉnh sửa công việc</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Tiêu đề <span className="text-red-500">*</span></Label>
                          <Input value={editingTitle} onChange={e => setEditingTitle(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Mô tả chi tiết</Label>
                          <Textarea value={editingDesc} onChange={e => setEditingDesc(e.target.value)} rows={4} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Mức độ ưu tiên</Label>
                            <Select value={newPriority} onValueChange={(val) => setNewPriority(val || "")}>
                              <SelectTrigger>
                                <span data-slot="select-value">
                                  {newPriority === "LOW" && "Thấp"}
                                  {newPriority === "MEDIUM" && "Trung bình"}
                                  {newPriority === "HIGH" && "Cao"}
                                  {newPriority === "URGENT" && "Khẩn cấp"}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LOW">Thấp</SelectItem>
                                <SelectItem value="MEDIUM">Trung bình</SelectItem>
                                <SelectItem value="HIGH">Cao</SelectItem>
                                <SelectItem value="URGENT">Khẩn cấp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Người phụ trách</Label>
                            <SearchableSelect options={techs} value={assignTechId} onValueChange={setAssignTechId} placeholder="Chọn..." />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Hủy</Button>
                        <Button onClick={handleSaveTicket} disabled={savingTicket}>
                          {savingTicket && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Lưu thay đổi
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </CardHeader>
            <CardContent>
              {ticket.expenses && ticket.expenses.length > 0 ? (
                <div className="space-y-4">
                  {ticket.expenses.map(exp => {
                    const expStatus = expenseStatusConfig[exp.status];
                    const isEditable = exp.status === "PENDING" && ["TECHNICIAN", "MANAGER", "ADMIN"].includes(userRole);
                    
                    return (
                      <div 
                        key={exp.id} 
                        className={`border rounded-lg p-4 space-y-3 transition-colors ${isEditable ? "cursor-pointer hover:border-primary/50 hover:bg-muted/30 group" : ""}`}
                        onClick={() => {
                          if (isEditable) {
                            setEditingExpenseId(exp.id);
                            setExpenseAmount(exp.amount.toString());
                            setExpenseDesc(exp.description || "");
                            setExpenseAccountingPeriod(exp.accounting_period || "");
                            setPhotos(exp.receipt_photos || []);
                            setIsExpenseDialogOpen(true);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base group-hover:text-primary transition-colors">
                              Chi tiết khoản chi
                            </span>
                            {isEditable && (
                              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                (Nhấn để sửa)
                              </span>
                            )}
                          </div>
                          <Badge variant="outline" className={expStatus.color}>{expStatus.label}</Badge>
                        </div>

                        <div className="space-y-2 text-sm mt-2">
                          <div className="flex">
                            <span className="text-muted-foreground w-24 shrink-0">Số tiền:</span>
                            <span className="font-bold text-primary text-base">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(exp.amount)}
                            </span>
                          </div>
                          
                          {exp.accounting_period && (
                            <div className="flex">
                              <span className="text-muted-foreground w-24 shrink-0">Hoạch toán:</span>
                              <span className="flex-1 font-medium text-emerald-700">Tháng {format(new Date(exp.accounting_period), "MM/yyyy")}</span>
                            </div>
                          )}

                          {exp.description && (
                            <div className="flex">
                              <span className="text-muted-foreground w-24 shrink-0">Mô tả:</span>
                              <span className="flex-1">{exp.description}</span>
                            </div>
                          )}
                          
                          {exp.receipt_photos && exp.receipt_photos.length > 0 && (
                            <div className="flex pt-1">
                              <span className="text-muted-foreground w-24 shrink-0 pt-1">Hình ảnh:</span>
                              <div className="flex flex-wrap gap-2">
                                {exp.receipt_photos.map((p, i) => (
                                  <a key={i} href={p} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                    <img src={p} alt="receipt" className="w-14 h-14 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Owner Actions */}
                        {userRole === "OWNER" && exp.status === "PENDING" && (
                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 w-full" onClick={(e) => { e.stopPropagation(); handleApproveExpense(exp.id); }}>
                              <CheckCircle className="w-4 h-4 mr-1"/> Duyệt
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6">Chưa có chi phí nào được báo cáo</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Hành động</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ticket.status !== "COMPLETED" && ticket.status !== "WAITING_APPROVAL" && (userRole === "TECHNICIAN" || ["ADMIN", "MANAGER", "OWNER"].includes(userRole)) && (
                <div className="space-y-2">
                  <Button 
                    className="w-full whitespace-normal h-auto py-2" 
                    variant="outline" 
                    onClick={handleSubmitApprovalOrComplete}
                  >
                    <CheckCircle className="w-4 h-4 mr-2 shrink-0"/> 
                    <span>{ticket.expenses && ticket.expenses.length > 0 ? "Gửi chờ duyệt" : "Đánh dấu hoàn thành"}</span>
                  </Button>
                </div>
              )}
              {ticket.status === "WAITING_APPROVAL" && (
                <div className="flex flex-col items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-lg text-center border border-purple-100">
                  <Send className="w-8 h-8 mb-2"/>
                  <p className="font-semibold">Đã gửi chờ duyệt chi phí</p>
                </div>
              )}
              {ticket.status === "COMPLETED" && (
                <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 text-emerald-700 rounded-lg text-center">
                  <CheckCircle className="w-8 h-8 mb-2"/>
                  <p className="font-semibold">Phiếu đã hoàn thành</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
