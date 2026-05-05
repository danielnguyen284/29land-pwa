"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  base_rent: number;
}

interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  cccd: string | null;
}

function NewContractForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialBuildingId = searchParams?.get("building_id") || "";
  const initialRoomId = searchParams?.get("room_id") || "";
  
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [formRooms, setFormRooms] = useState<Room[]>([]);
  const [formTenants, setFormTenants] = useState<Tenant[]>([]);

  const [formLoading, setFormLoading] = useState(false);
  
  // Form state
  const [formBuildingId, setFormBuildingId] = useState<string>(initialBuildingId);
  const [formRoomId, setFormRoomId] = useState<string>(initialRoomId);
  const [formTenantMode, setFormTenantMode] = useState<"existing" | "new">("existing");
  const [formTenantId, setFormTenantId] = useState<string>("");
  const [formNewTenant, setFormNewTenant] = useState({ name: "", phone: "", cccd: "" });
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formRent, setFormRent] = useState("");
  const [formDeposit, setFormDeposit] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
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
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (formBuildingId) {
      fetchRooms(formBuildingId, setFormRooms);
    } else {
      setFormRooms([]);
      setFormRoomId("");
    }
  }, [formBuildingId]);

  useEffect(() => {
    if (formRoomId) {
      fetchTenants(formRoomId, setFormTenants);
      const selectedRoom = formRooms.find(r => r.id === formRoomId);
      if (selectedRoom) {
        setFormRent(selectedRoom.base_rent.toString());
        setFormDeposit(selectedRoom.base_rent.toString());
      }
    } else {
      setFormTenants([]);
      setFormTenantId("");
      setFormRent("");
      setFormDeposit("");
    }
  }, [formRoomId, formRooms]);

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

  const fetchTenants = async (roomId: string, setter: (tenants: Tenant[]) => void) => {
    try {
      const data = await apiFetch<Tenant[]>(`/api/rooms/${roomId}/tenants`);
      setter(data);
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
    if (!formRoomId) {
      alert("Vui lòng chọn phòng"); return;
    }
    if (formTenantMode === "existing" && !formTenantId) {
      alert("Vui lòng chọn khách thuê"); return;
    }
    if (formTenantMode === "new" && !formNewTenant.name) {
      alert("Vui lòng nhập tên khách thuê"); return;
    }

    setFormLoading(true);
    try {
      let finalTenantId = formTenantId;
      
      if (formTenantMode === "new") {
        const tenantRes = await apiFetch<{id: string}>(`/api/rooms/${formRoomId}/tenants`, {
          method: "POST",
          body: JSON.stringify({ ...formNewTenant, is_representative: true })
        });
        finalTenantId = tenantRes.id;
      }

      const payload = {
        representative_tenant_id: finalTenantId,
        start_date: formStartDate,
        end_date: formEndDate,
        rent_amount: Number(formRent),
        deposit_amount: Number(formDeposit),
        document_photos: formPhotos,
        status: "ACTIVE" // Default status for new contract
      };

      await apiFetch(`/api/rooms/${formRoomId}/contracts`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      router.push("/contracts");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi lưu hợp đồng");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex-1 w-full max-w-3xl mx-auto">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-5">
            <h2 className="font-semibold text-lg">Thông tin phòng thuê</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nhà <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  options={buildings.map((b) => ({
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
                  }))}
                  value={formBuildingId}
                  onValueChange={(v) => setFormBuildingId(v)}
                  placeholder="Chọn nhà"
                  searchPlaceholder="Tìm kiếm nhà..."
                  emptyMessage="Không tìm thấy nhà."
                />
              </div>
              <div className="space-y-2">
                <Label>Phòng <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  options={formRooms.map((r) => ({ value: r.id, label: r.name }))}
                  value={formRoomId}
                  onValueChange={(v) => setFormRoomId(v)}
                  placeholder="Chọn phòng"
                  searchPlaceholder="Tìm kiếm phòng..."
                  emptyMessage="Không tìm thấy phòng."
                  disabled={!formBuildingId}
                />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Khách thuê đại diện <span className="text-destructive">*</span></Label>
              <div className="flex bg-muted p-1 rounded-lg">
                <button 
                  type="button" 
                  onClick={() => setFormTenantMode("existing")}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${formTenantMode === "existing" ? "bg-background shadow" : "text-muted-foreground"}`}
                >
                  Khách cũ
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormTenantMode("new")}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${formTenantMode === "new" ? "bg-background shadow" : "text-muted-foreground"}`}
                >
                  Tạo mới
                </button>
              </div>
            </div>
            
            {formTenantMode === "existing" ? (
              <SearchableSelect
                options={formTenants.map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.phone ? ` - ${t.phone}` : ""}`,
                }))}
                value={formTenantId}
                onValueChange={(v) => setFormTenantId(v)}
                placeholder="Chọn khách từ danh sách phòng"
                searchPlaceholder="Tìm kiếm khách thuê..."
                emptyMessage={formTenants.length === 0 ? "Phòng chưa có khách nào" : "Không tìm thấy khách thuê."}
                disabled={!formRoomId}
              />
            ) : (
              <div className="grid gap-4">
                <Input 
                  placeholder="Họ và tên" 
                  value={formNewTenant.name} 
                  onChange={e => setFormNewTenant({...formNewTenant, name: e.target.value})} 
                  required={formTenantMode === "new"}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    placeholder="Số điện thoại" 
                    value={formNewTenant.phone} 
                    onChange={e => setFormNewTenant({...formNewTenant, phone: e.target.value})} 
                  />
                  <Input 
                    placeholder="CCCD/CMND" 
                    value={formNewTenant.cccd} 
                    onChange={e => setFormNewTenant({...formNewTenant, cccd: e.target.value})} 
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-5">
            <h2 className="font-semibold text-lg">Thông tin hợp đồng</h2>
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
            <Button type="submit" disabled={formLoading} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo hợp đồng
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
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <NewContractForm />
    </Suspense>
  );
}
