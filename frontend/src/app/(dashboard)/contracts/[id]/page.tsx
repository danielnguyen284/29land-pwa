"use client";

import { AccompanyingTenant, AccompanyingTenantsSection } from "@/components/AccompanyingTenantsSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { addMonths, endOfMonth, format, subDays } from "date-fns";
import {
  Camera,
  Download,
  Loader2,
  Upload,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

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
  tenants: Tenant[];
  room: {
    id: string;
    name: string;
    building_id?: string;
    floor?: { building?: { name: string } };
  };
}

export default function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  
  // Data for selects
  const [formTenants, setFormTenants] = useState<Tenant[]>([]);
  
  // Original contract data to fetch tenant list properly
  const [contract, setContract] = useState<Contract | null>(null);

  // Form state
  const [formTenantId, setFormTenantId] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formRent, setFormRent] = useState("");
  const [formDeposit, setFormDeposit] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [formAccompanyingTenants, setFormAccompanyingTenants] = useState<AccompanyingTenant[]>([]);
  const [formStatus, setFormStatus] = useState<string>("ACTIVE");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Terminate Dialog State
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [terminateDate, setTerminateDate] = useState("");
  const [terminateLastMonthRent, setTerminateLastMonthRent] = useState("");
  const [terminateDamageFees, setTerminateDamageFees] = useState("");
  const [terminateNotes, setTerminateNotes] = useState("");

  // Cancel Dialog State
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelNotes, setCancelNotes] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (val: string) => {
    const num = val.toString().replace(/\D/g, "");
    if (!num) return "";
    return parseInt(num, 10).toLocaleString("vi-VN");
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `chung-tu-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const setDuration = (months: number) => {
    if (!formStartDate) {
      alert("Vui lòng chọn ngày bắt đầu trước");
      return;
    }
    const start = new Date(formStartDate);
    const targetDate = addMonths(start, months);
    const finalEnd = endOfMonth(subDays(targetDate, 1));
    setFormEndDate(format(finalEnd, "yyyy-MM-dd"));
  };

  useEffect(() => {
    fetchContractDetails();
  }, [id]);

  const fetchContractDetails = async () => {
    try {
      setLoading(true);
      // Use the new single contract endpoint
      const currentContract = await apiFetch<Contract>(`/api/contracts/${id}`);
      
      if (currentContract) {
        setContract(currentContract);
        setFormTenantId(currentContract.representative_tenant_id);
        setFormStartDate(currentContract.start_date);
        setFormEndDate(currentContract.end_date);
        setFormRent(currentContract.rent_amount.toString());
        setFormDeposit(currentContract.deposit_amount.toString());
        setFormPhotos(currentContract.document_photos || []);
        setFormStatus(currentContract.status);

        // Initialize accompanying tenants (exclude representative)
        const others = (currentContract.tenants || [])
          .filter(t => t.id !== currentContract.representative_tenant_id)
          .map(t => ({
            id: t.id,
            mode: "existing" as const,
            name: t.name,
            phone: t.phone || "",
            cccd: t.cccd || ""
          }));
        setFormAccompanyingTenants(others);

        // Fetch tenants for this room
        fetchTenants(currentContract.room_id);
      } else {
        alert("Không tìm thấy hợp đồng");
        router.push("/contracts");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi tải thông tin hợp đồng");
    } finally {
      setLoading(false);
    }
  };

  const openTerminateDialog = () => {
    setTerminateDate(new Date().toISOString().split("T")[0]);
    setTerminateLastMonthRent("");
    setTerminateDamageFees("");
    setTerminateNotes("");
    setShowTerminateDialog(true);
  };

  const handleTerminate = async () => {
    if (!contract) return;
    setFormLoading(true);
    try {
      await apiFetch(`/api/rooms/${contract.room_id}/contracts/${id}/terminate`, {
        method: "POST",
        body: JSON.stringify({
          actual_end_date: terminateDate,
          last_month_rent: Number(terminateLastMonthRent.replace(/\D/g, "") || 0),
          damage_fees: Number(terminateDamageFees.replace(/\D/g, "") || 0),
          notes: terminateNotes
        })
      });
      setShowTerminateDialog(false);
      fetchContractDetails();
    } catch (err) {
      alert("Lỗi thanh lý hợp đồng");
    } finally {
      setFormLoading(false);
    }
  };

  const openCancelDialog = () => {
    setCancelNotes("");
    setShowCancelDialog(true);
  };

  const handleCancel = async () => {
    if (!contract) return;
    if (!cancelNotes.trim()) {
      alert("Vui lòng nhập lý do hủy hợp đồng");
      return;
    }
    setFormLoading(true);
    try {
      await apiFetch(`/api/rooms/${contract.room_id}/contracts/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ notes: cancelNotes })
      });
      setShowCancelDialog(false);
      fetchContractDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi hủy hợp đồng");
    } finally {
      setFormLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!contract) return;
    if (!confirm("Bạn có chắc chắn muốn kích hoạt lại hợp đồng này?")) return;
    setFormLoading(true);
    try {
      await apiFetch(`/api/rooms/${contract.room_id}/contracts/${id}/reactivate`, {
        method: "POST"
      });
      fetchContractDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi kích hoạt hợp đồng");
    } finally {
      setFormLoading(false);
    }
  };

  const fetchTenants = async (roomId: string) => {
    try {
      const data = await apiFetch<Tenant[]>(`/api/rooms/${roomId}/tenants`);
      setFormTenants(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setFormLoading(true);
    try {
      const newPhotos = [...formPhotos];
      for (let i = 0; i < files.length; i++) {
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
      setFormPhotos(newPhotos);
    } catch (err) {
      alert("Lỗi tải ảnh lên");
    } finally {
      setFormLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...formPhotos];
    newPhotos.splice(index, 1);
    setFormPhotos(newPhotos);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    if (!formTenantId) {
      alert("Vui lòng chọn khách thuê"); return;
    }

    setFormLoading(true);
    try {
      // 1. Handle accompanying tenants
      const finalAccompanyingIds: string[] = [];
      for (const at of formAccompanyingTenants) {
        if (at.mode === "new") {
          // Create new accompanying tenant
          const res = await apiFetch<{id: string}>(`/api/rooms/${contract.room_id}/tenants`, {
            method: "POST",
            body: JSON.stringify({ name: at.name, phone: at.phone, cccd: at.cccd, is_representative: false })
          });
          finalAccompanyingIds.push(res.id);
        } else if (at.id) {
          // Use existing ID
          finalAccompanyingIds.push(at.id);
        }
      }

      const payload = {
        representative_tenant_id: formTenantId,
        start_date: formStartDate,
        end_date: formEndDate,
        rent_amount: Number(formRent),
        deposit_amount: Number(formDeposit),
        document_photos: formPhotos,
        tenant_ids: [formTenantId, ...finalAccompanyingIds],
        status: formStatus
      };

      await apiFetch(`/api/rooms/${contract.room_id}/contracts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      
      router.push("/contracts");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi cập nhật hợp đồng");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div className="space-y-6 pb-36 md:pb-0">
      <div className="flex-1 w-full max-w-3xl mx-auto">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-6">
            <h2 className="font-semibold text-lg">Thông tin chung</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tòa nhà</Label>
                <div className="h-10 px-3 py-2 bg-muted rounded-md border text-sm flex items-center font-medium">
                  {contract.room?.floor?.building?.name || "Không rõ"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phòng</Label>
                <div className="h-10 px-3 py-2 bg-muted rounded-md border text-sm flex items-center font-medium">
                  {contract.room?.name || "Không rõ"}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-base font-semibold mt-2 inline-block">Khách thuê đại diện <span className="text-destructive">*</span></Label>
              <SearchableSelect
                options={formTenants.map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.phone ? ` - ${t.phone}` : ""}`,
                }))}
                value={formTenantId}
                onValueChange={(v) => setFormTenantId(v)}
                placeholder="Chọn khách từ danh sách phòng"
                searchPlaceholder="Tìm kiếm khách thuê..."
                emptyMessage="Không tìm thấy khách thuê."
              />

              <div className="pt-4 border-t mt-4">
                <AccompanyingTenantsSection 
                  buildingId={contract.room?.building_id || ""}
                  tenants={formAccompanyingTenants}
                  onChange={setFormAccompanyingTenants}
                  excludeIds={[formTenantId].filter(Boolean)}
                />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-5">
            <h2 className="font-semibold text-lg">Thông tin hợp đồng</h2>
            
            <div className="space-y-2 mb-4">
              <Label>Trạng thái</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v || "")} disabled={true}>
                <SelectTrigger className="w-full font-medium opacity-100 disabled:cursor-default">
                  <SelectValue placeholder="Chọn trạng thái">
                    {formStatus === "NEW" ? "Mới (Đã cọc)" :
                     formStatus === "ACTIVE" ? "Còn hạn" :
                     formStatus === "EXPIRED" ? "Hết hạn" :
                     formStatus === "TERMINATED" ? "Đã thanh lý" : 
                     formStatus === "CANCELLED" ? "Đã hủy" : "Chọn trạng thái"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">Mới (Đã cọc)</SelectItem>
                  <SelectItem value="ACTIVE">Còn hạn</SelectItem>
                  <SelectItem value="EXPIRED">Hết hạn</SelectItem>
                  <SelectItem value="TERMINATED">Đã thanh lý</SelectItem>
                  <SelectItem value="CANCELLED">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ngày bắt đầu <span className="text-destructive">*</span></Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Ngày kết thúc <span className="text-destructive">*</span></Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="xs" className="h-6 px-2 text-[10px]" onClick={() => setDuration(3)}>3T</Button>
                    <Button type="button" variant="outline" size="xs" className="h-6 px-2 text-[10px]" onClick={() => setDuration(6)}>6T</Button>
                    <Button type="button" variant="outline" size="xs" className="h-6 px-2 text-[10px]" onClick={() => setDuration(12)}>12T</Button>
                  </div>
                </div>
                <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Tiền phòng (VND)</Label>
                <Input type="text" value={formatCurrency(formRent)} onChange={e => setFormRent(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="space-y-2">
                <Label>Tiền cọc (VND)</Label>
                <Input type="text" value={formatCurrency(formDeposit)} onChange={e => setFormDeposit(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Hình ảnh chứng từ</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Tải lên
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={handleFileUpload} 
              />
            </div>
            
            {formPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {formPhotos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group bg-muted">
                    <img 
                      src={url} 
                      alt="Contract doc" 
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                      onClick={() => setPreviewImage(url)} 
                    />
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full shadow-sm hover:bg-black/80 transition-colors z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-8 h-8 mb-3 opacity-50" />
                <span className="text-sm">Chưa có ảnh nào</span>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50 flex flex-col gap-3 pb-8 md:static md:p-0 md:bg-transparent md:border-none md:shadow-none md:pb-10">
            <Button type="submit" disabled={formLoading} className="w-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:opacity-90 text-primary-foreground">
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>

            {(formStatus === "ACTIVE" || formStatus === "NEW") && (
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={openCancelDialog} disabled={formLoading}>
                  Hủy hợp đồng
                </Button>
                <Button type="button" variant="destructive" className="flex-1" onClick={openTerminateDialog} disabled={formLoading}>
                  Thanh lý / Trả phòng
                </Button>
              </div>
            )}

            {formStatus === "CANCELLED" && (
              <Button type="button" variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" onClick={handleReactivate} disabled={formLoading}>
                Kích hoạt lại
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl w-[90vw] p-0 overflow-hidden bg-black border-none [&>button]:text-white">
          <DialogTitle className="sr-only">Xem ảnh</DialogTitle>
          {previewImage && (
            <div className="relative w-full h-[80vh] flex flex-col">
              <div className="flex-1 overflow-auto flex items-center justify-center p-2">
                <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-4 bg-black/80 border-t border-white/10 flex justify-center">
                <Button variant="secondary" onClick={() => handleDownload(previewImage)} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Lưu về máy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Terminate Modal */}
      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>Thanh lý hợp đồng</DialogTitle>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Ngày trả phòng thực tế</Label>
              <Input type="date" value={terminateDate} onChange={e => setTerminateDate(e.target.value)} />
            </div>
            
            <div className="bg-muted p-3 rounded-md text-sm border flex justify-between">
              <span className="font-medium">Tiền cọc ban đầu:</span>
              <span className="font-semibold">{formatCurrency(contract?.deposit_amount?.toString() || "0")} đ</span>
            </div>

            <div className="space-y-2">
              <Label>Truy thu tiền nhà tháng cuối (VND)</Label>
              <Input 
                type="text" 
                placeholder="Nhập nếu khách còn nợ tiền nhà"
                value={terminateLastMonthRent} 
                onChange={e => setTerminateLastMonthRent(formatCurrency(e.target.value))} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Phí khấu trừ / Hư hỏng (VND)</Label>
              <Input 
                type="text" 
                placeholder="Trừ tiền hư hỏng đồ đạc, dọn dẹp..."
                value={terminateDamageFees} 
                onChange={e => setTerminateDamageFees(formatCurrency(e.target.value))} 
              />
            </div>

            <div className="bg-primary/10 p-3 rounded-md text-sm border border-primary/20 flex justify-between">
              <span className="font-medium text-primary">Tiền hoàn cọc dự kiến:</span>
              <span className="font-bold text-primary">
                {formatCurrency((
                  (contract?.deposit_amount || 0) - 
                  Number(terminateLastMonthRent.replace(/\D/g, "") || 0) - 
                  Number(terminateDamageFees.replace(/\D/g, "") || 0)
                ).toString())} đ
              </span>
            </div>

            <div className="space-y-2">
              <Label>Ghi chú thêm</Label>
              <Input 
                placeholder="Lý do trả phòng..."
                value={terminateNotes} 
                onChange={e => setTerminateNotes(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowTerminateDialog(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleTerminate} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xác nhận trả phòng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Cancel Modal */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>Hủy hợp đồng</DialogTitle>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Lý do hủy hợp đồng <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="Khách không đến nhận phòng, sai thông tin..."
                value={cancelNotes} 
                onChange={e => setCancelNotes(e.target.value)} 
              />
            </div>
            <p className="text-sm text-muted-foreground">Khách thuê sẽ bị chuyển sang không hoạt động. Bạn có thể kích hoạt lại sau này nếu cần.</p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Đóng</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xác nhận Hủy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
