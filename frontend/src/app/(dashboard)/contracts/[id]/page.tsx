"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Loader2,
  Camera,
  Upload,
  X,
  Download
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { apiFetch } from "@/lib/api";

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
  const [formStatus, setFormStatus] = useState<string>("ACTIVE");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Terminate Dialog State
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [terminateDate, setTerminateDate] = useState("");
  const [terminateLastMonthRent, setTerminateLastMonthRent] = useState("");
  const [terminateDamageFees, setTerminateDamageFees] = useState("");
  const [terminateNotes, setTerminateNotes] = useState("");
  
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

  useEffect(() => {
    fetchContractDetails();
  }, [id]);

  const fetchContractDetails = async () => {
    try {
      setLoading(true);
      // Currently the backend has GET /api/contracts which returns a list. 
      // It might not have a GET /api/contracts/:id or GET /api/rooms/:roomId/contracts/:id yet.
      // But we can fetch all contracts and filter, or we can fetch room contracts if we know the room.
      // Easiest is to fetch all contracts and find it since there's no direct single contract endpoint requested.
      const data = await apiFetch<Contract[]>("/api/contracts");
      const currentContract = data.find(c => c.id === id);
      
      if (currentContract) {
        setContract(currentContract);
        setFormTenantId(currentContract.representative_tenant_id);
        setFormStartDate(currentContract.start_date);
        setFormEndDate(currentContract.end_date);
        setFormRent(currentContract.rent_amount.toString());
        setFormDeposit(currentContract.deposit_amount.toString());
        setFormPhotos(currentContract.document_photos || []);
        setFormStatus(currentContract.status);

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
      const payload = {
        representative_tenant_id: formTenantId,
        start_date: formStartDate,
        end_date: formEndDate,
        rent_amount: Number(formRent),
        deposit_amount: Number(formDeposit),
        document_photos: formPhotos,
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
    <div className="space-y-6 pb-20 md:pb-0">
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
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-5">
            <h2 className="font-semibold text-lg">Thông tin hợp đồng</h2>
            
            <div className="space-y-2 mb-4">
              <Label>Trạng thái</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v || "")}>
                <SelectTrigger className="w-full font-medium">
                  <SelectValue placeholder="Chọn trạng thái">
                    {formStatus === "NEW" ? "Mới (Đã cọc)" :
                     formStatus === "ACTIVE" ? "Còn hạn" :
                     formStatus === "EXPIRED" ? "Hết hạn" :
                     formStatus === "TERMINATED" ? "Đã hủy/Trả phòng" : "Chọn trạng thái"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">Mới (Đã cọc)</SelectItem>
                  <SelectItem value="ACTIVE">Còn hạn</SelectItem>
                  <SelectItem value="EXPIRED">Hết hạn</SelectItem>
                  <SelectItem value="TERMINATED">Đã hủy/Trả phòng</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ngày bắt đầu <span className="text-destructive">*</span></Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Ngày kết thúc <span className="text-destructive">*</span></Label>
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

          <div className="flex gap-4 pt-4 pb-10">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.push("/contracts")}>Hủy</Button>
            
            {(formStatus === "ACTIVE" || formStatus === "NEW") && (
              <Button type="button" variant="destructive" className="flex-1" onClick={openTerminateDialog}>
                Thanh lý / Trả phòng
              </Button>
            )}

            <Button type="submit" disabled={formLoading} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cập nhật
            </Button>
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
    </div>
  );
}
