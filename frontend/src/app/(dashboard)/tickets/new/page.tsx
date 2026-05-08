"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Upload, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useRef } from "react";

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
}

interface User {
  id: string;
  name: string;
  role: string;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<{ value: string; label: string }[]>([]);
  const [rooms, setRooms] = useState<{ value: string; label: string }[]>([]);
  const [techs, setTechs] = useState<{ value: string; label: string }[]>([]);
  const [allTechs, setAllTechs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");

  const [formData, setFormData] = useState({
    room_id: "",
    assigned_tech_id: "",
    title: "",
    description: "",
    priority: "MEDIUM",
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (photos.length + files.length > 5) {
      toast.error("Chỉ được tải tối đa 5 ảnh bằng chứng");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    const newPhotos = [...photos];
    try {
      for (let i = 0; i < files.length; i++) {
        if (newPhotos.length >= 5) break;
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUserRole(JSON.parse(userStr).role);
    }

    const fetchInitialData = async () => {
      try {
        const [buildingsData, usersData] = await Promise.all([
          apiFetch<{data: Building[], meta: any}>("/api/buildings?limit=1000"),
          apiFetch<User[]>("/api/users"),
        ]);

        setBuildings(
          buildingsData.data.map((b) => {
            const fullAddress = [b.address, b.ward, b.district, b.province].filter(Boolean).join(", ") || "Chưa có địa chỉ";
            return {
              value: b.id,
              label: fullAddress,
              displayLabel: fullAddress,
            };
          })
        );

        const filteredTechs = usersData.filter((u) => u.role === "TECHNICIAN");
        setAllTechs(filteredTechs);
        setTechs(
          filteredTechs.map((u) => ({
            value: u.id,
            label: `${u.name} (Kỹ thuật)`,
          }))
        );
      } catch (err: any) {
        toast.error("Lỗi tải dữ liệu: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchRoomsForBuilding = async () => {
      if (!selectedBuildingId) {
        setRooms([]);
        setFormData(prev => ({ ...prev, room_id: "" }));
        return;
      }

      setRoomsLoading(true);
      try {
        const [resRooms, resManagers] = await Promise.all([
          apiFetch<{data: Room[], meta: any}>(`/api/rooms?limit=1000&building_id=${selectedBuildingId}`),
          apiFetch<User[]>(`/api/buildings/${selectedBuildingId}/managers`)
        ]);

        setRooms(
          resRooms.data.map((r) => ({
            value: r.id,
            label: `${r.floor ? r.floor.name + " - " : ""}${r.name}`,
          }))
        );

        setTechs([
          ...resManagers.map((m) => ({ value: m.id, label: `${m.name} (Quản lý)` })),
          ...allTechs.map((u) => ({ value: u.id, label: `${u.name} (Kỹ thuật)` }))
        ]);

        // Reset room selection when building changes
        setFormData(prev => ({ ...prev, room_id: "" }));
      } catch (err: any) {
        toast.error("Lỗi tải danh sách phòng: " + err.message);
      } finally {
        setRoomsLoading(false);
      }
    };
    fetchRoomsForBuilding();
  }, [selectedBuildingId, allTechs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId || !formData.title) {
      toast.error("Vui lòng chọn tòa nhà và nhập tiêu đề công việc");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          building_id: selectedBuildingId,
          evidence_photos: photos,
        }),
      });
      toast.success("Tạo phiếu công việc thành công");
      router.push("/tickets");
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-2 flex flex-col min-h-[calc(100vh-140px)] relative">
      <Card className="rounded-2xl border-none shadow-md overflow-hidden flex-1 mb-20 md:mb-0">
        <CardContent className="p-6">
          <form id="new-ticket-form" onSubmit={handleSubmit} className="space-y-5">
            
            <div className="grid gap-2">
              <Label className="font-semibold text-foreground/90">Tòa nhà <span className="text-destructive">*</span></Label>
              <SearchableSelect
                options={buildings}
                value={selectedBuildingId}
                onValueChange={(val) => setSelectedBuildingId(val)}
                placeholder="Chọn tòa nhà..."
              />
            </div>

            <div className="grid gap-2 relative">
              <Label className="font-semibold text-foreground/90">Phòng (Tùy chọn)</Label>
              <div className="relative">
                <SearchableSelect
                  options={rooms}
                  value={formData.room_id}
                  onValueChange={(val) => setFormData({ ...formData, room_id: val })}
                  placeholder={selectedBuildingId ? "Chọn phòng..." : "Vui lòng chọn tòa nhà trước"}
                  disabled={!selectedBuildingId || roomsLoading}
                />
                {roomsLoading && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title" className="font-semibold text-foreground/90">Tiêu đề công việc <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="VD: Hỏng điều hòa, Thay bóng đèn..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="font-semibold text-foreground/90">Mô tả chi tiết</Label>
              <Textarea
                id="description"
                placeholder="Nhập mô tả tình trạng công việc (tùy chọn)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px] resize-y"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority" className="font-semibold text-foreground/90">Mức độ ưu tiên <span className="text-destructive">*</span></Label>
              <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val || "MEDIUM" })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Chọn mức độ ưu tiên" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="LOW">Thấp</SelectItem>
                  <SelectItem value="MEDIUM">Trung bình</SelectItem>
                  <SelectItem value="HIGH">Cao</SelectItem>
                  <SelectItem value="URGENT">Khẩn cấp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {userRole === "TECHNICIAN" && (
              <div className="grid gap-2">
                <Label className="font-semibold text-foreground/90">Ảnh bằng chứng <span className="text-muted-foreground text-sm font-normal">(Tối đa 5 ảnh)</span></Label>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleUploadPhoto}
                />
                
                {uploading && <p className="text-xs text-muted-foreground mb-2">Đang tải ảnh lên...</p>}
                
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {photos.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group bg-muted">
                        <img 
                          src={url} 
                          alt="Evidence" 
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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-6 h-6 mb-2 opacity-50" />
                    <span className="text-xs">Chưa có ảnh nào</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="assigned_tech_id" className="font-semibold text-foreground/90">Người phụ trách (Tùy chọn)</Label>
              <SearchableSelect
                options={techs}
                value={formData.assigned_tech_id}
                onValueChange={(val) => setFormData({ ...formData, assigned_tech_id: val || "" })}
                placeholder="Chọn người phụ trách"
                searchPlaceholder="Tìm kiếm người phụ trách..."
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Footer Add Button - Sticky on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border/50 md:sticky md:bg-transparent md:backdrop-blur-none md:border-t-0 md:p-0 md:pt-6 md:mt-auto z-10">
        <Button 
          type="submit" 
          form="new-ticket-form"
          disabled={submitting || !selectedBuildingId || !formData.title} 
          className="w-full shadow-md rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:opacity-90 transition-opacity"
        >
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Lưu phiếu
        </Button>
      </div>
    </div>
  );
}
