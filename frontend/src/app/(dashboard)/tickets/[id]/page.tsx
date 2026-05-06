"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Loader2, ArrowLeft, Image as ImageIcon, CheckCircle, XCircle, RefreshCw, Plus, Wrench, Send, Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api";
import { Ticket, TicketExpense, User } from "@/lib/types";

const statusConfig = {
  PENDING: { label: "Chờ xử lý", color: "bg-amber-100 text-amber-800" },
  IN_PROGRESS: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800" },
  WAITING_APPROVAL: { label: "Chờ duyệt", color: "bg-purple-100 text-purple-800" },
  NEEDS_EXPLANATION: { label: "Cần giải trình", color: "bg-rose-100 text-rose-800" },
  COMPLETED: { label: "Hoàn thành", color: "bg-emerald-100 text-emerald-800" },
  OVERDUE: { label: "Quá hạn", color: "bg-red-100 text-red-800" },
};

const expenseStatusConfig = {
  PENDING: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Từ chối", color: "bg-rose-100 text-rose-800" },
};

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [techs, setTechs] = useState<{value: string, label: string}[]>([]);
  
  // Dialog States
  const [assignTechId, setAssignTechId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Expense Form State
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [uploading, setUploading] = useState(false);
  const expenseFileInputRef = useRef<HTMLInputElement>(null);

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  // Reject / Resubmit State
  const [rejectReason, setRejectReason] = useState("");
  const [resubmitComment, setResubmitComment] = useState("");
  const [activeExpenseId, setActiveExpenseId] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isResubmitDialogOpen, setIsResubmitDialogOpen] = useState(false);

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
        const usersData = await apiFetch<User[]>("/api/users");
        setTechs(usersData.filter(u => u.role === "TECHNICIAN").map(u => ({ value: u.id, label: u.name })));
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải phiếu");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignTechId) {
      toast.error("Vui lòng chọn kỹ thuật viên");
      return;
    }
    setAssigning(true);
    try {
      await apiFetch(`/api/tickets/${ticket?.id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_tech_id: assignTechId })
      });
      toast.success("Đã phân công kỹ thuật viên");
      setIsAssignDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
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
            receipt_photos: photos
          })
        });
        toast.success("Đã báo cáo chi phí");
      }
      setIsExpenseDialogOpen(false);
      setEditingExpenseId(null);
      setExpenseAmount("");
      setExpenseDesc("");
      setPhotos([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleApproveExpense = async (expenseId: string, approved: boolean) => {
    try {
      await apiFetch(`/api/tickets/expenses/${expenseId}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ approved, reject_reason: rejectReason })
      });
      toast.success(approved ? "Đã duyệt chi phí" : "Đã từ chối chi phí");
      setIsRejectDialogOpen(false);
      setRejectReason("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResubmitExpense = async () => {
    try {
      await apiFetch(`/api/tickets/expenses/${activeExpenseId}/resubmit`, {
        method: "PATCH",
        body: JSON.stringify({ technician_comment: resubmitComment })
      });
      toast.success("Đã nộp lại giải trình");
      setIsResubmitDialogOpen(false);
      setResubmitComment("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-primary"/></div>;
  if (!ticket) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy phiếu</div>;

  const status = statusConfig[ticket.status] || { label: ticket.status, color: "bg-gray-100 text-gray-700" };
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
        <Badge variant="outline" className={`${status.color} border-none font-medium px-3 py-1`}>
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Thông tin chi tiết</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Phòng</span>
                  <span className="font-semibold">{ticket.room?.name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Kỹ thuật viên</span>
                  {ticket.assigned_tech ? (
                    <span className="font-semibold">{ticket.assigned_tech.name}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground italic">Chưa gán</span>
                      {["ADMIN", "MANAGER"].includes(userRole) && (
                        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                          <DialogTrigger render={<Button size="sm" variant="outline" className="h-7 px-2 text-xs" />}>
                            Gán ngay
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Phân công kỹ thuật viên</DialogTitle></DialogHeader>
                            <div className="py-4">
                              <Label>Chọn kỹ thuật viên</Label>
                              <SearchableSelect options={techs} value={assignTechId} onValueChange={setAssignTechId} placeholder="Chọn..." />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Hủy</Button>
                              <Button onClick={handleAssign} disabled={assigning}>
                                {assigning && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Lưu
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1 text-sm">Mô tả sự cố</span>
                <p className="bg-muted/50 p-3 rounded-lg text-sm">{ticket.description || "Không có mô tả"}</p>
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
                    setPhotos([]);
                    setIsExpenseDialogOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-1"/> Báo chi phí
                  </Button>
                  <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editingExpenseId ? "Chỉnh sửa chi phí" : "Báo cáo chi phí"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Số tiền (VND) <span className="text-red-500">*</span></Label>
                        <Input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="50000" />
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

                        {exp.reject_reason && (
                          <div className="bg-rose-50 text-rose-800 p-2 rounded text-sm mt-2">
                            <span className="font-semibold">Lý do từ chối:</span> {exp.reject_reason}
                          </div>
                        )}

                        {exp.technician_comment && (
                          <div className="bg-blue-50 text-blue-800 p-2 rounded text-sm mt-2">
                            <span className="font-semibold">Giải trình:</span> {exp.technician_comment}
                          </div>
                        )}

                        {/* Owner Actions */}
                        {userRole === "OWNER" && exp.status === "PENDING" && (
                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveExpense(exp.id, true)}>
                              <CheckCircle className="w-4 h-4 mr-1"/> Duyệt
                            </Button>
                            
                            <Dialog open={isRejectDialogOpen && activeExpenseId === exp.id} onOpenChange={(open) => { setIsRejectDialogOpen(open); setActiveExpenseId(exp.id); }}>
                              <DialogTrigger render={<Button size="sm" variant="destructive" />}>
                                <XCircle className="w-4 h-4 mr-1"/> Từ chối
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Từ chối chi phí</DialogTitle></DialogHeader>
                                <div className="py-4">
                                  <Label>Lý do từ chối (Bắt buộc)</Label>
                                  <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Hủy</Button>
                                  <Button variant="destructive" onClick={() => handleApproveExpense(exp.id, false)} disabled={!rejectReason.trim()}>Xác nhận từ chối</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}

                        {/* Tech/Manager Actions */}
                        {["TECHNICIAN", "MANAGER", "ADMIN"].includes(userRole) && exp.status === "REJECTED" && (
                          <div className="pt-2 border-t">
                             <Dialog open={isResubmitDialogOpen && activeExpenseId === exp.id} onOpenChange={(open) => { setIsResubmitDialogOpen(open); setActiveExpenseId(exp.id); }}>
                              <DialogTrigger render={<Button size="sm" variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50" />}>
                                <RefreshCw className="w-4 h-4 mr-1"/> Giải trình & Nộp lại
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Giải trình chi phí</DialogTitle></DialogHeader>
                                <div className="py-4 space-y-4">
                                  <div className="bg-rose-50 text-rose-800 p-3 rounded text-sm">
                                    <span className="font-semibold">Lý do từ chối trước đó:</span> {exp.reject_reason}
                                  </div>
                                  <div>
                                    <Label>Nhập giải trình của bạn</Label>
                                    <Textarea value={resubmitComment} onChange={e => setResubmitComment(e.target.value)} />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsResubmitDialogOpen(false)}>Hủy</Button>
                                  <Button onClick={handleResubmitExpense} disabled={!resubmitComment.trim()}>Gửi giải trình</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
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
                    className="w-full" 
                    variant="outline" 
                    onClick={handleSubmitApprovalOrComplete}
                  >
                    <CheckCircle className="w-4 h-4 mr-2"/> 
                    {ticket.expenses && ticket.expenses.length > 0 ? "Gửi chờ duyệt" : "Đánh dấu hoàn thành"}
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
