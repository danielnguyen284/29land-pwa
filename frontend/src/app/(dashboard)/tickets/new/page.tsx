"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");

  const [formData, setFormData] = useState({
    room_id: "",
    assigned_tech_id: "",
    title: "",
    description: "",
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [buildingsData, usersData] = await Promise.all([
          apiFetch<{data: Building[], meta: any}>("/api/buildings?limit=1000"),
          apiFetch<User[]>("/api/users"),
        ]);

        setBuildings(
          buildingsData.data.map((b) => ({
            value: b.id,
            label: `${b.name}${
              [b.address, b.ward, b.district, b.province].filter(Boolean).join(", ")
                ? ` - ${[b.address, b.ward, b.district, b.province]
                    .filter(Boolean)
                    .join(", ")}`
                : ""
            }`,
            displayLabel: b.name,
          }))
        );

        setTechs(
          usersData
            .filter((u) => u.role === "TECHNICIAN")
            .map((u) => ({
              value: u.id,
              label: u.name,
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
        const res = await apiFetch<{data: Room[], meta: any}>(`/api/rooms?limit=1000&building_id=${selectedBuildingId}`);
        setRooms(
          res.data.map((r) => ({
            value: r.id,
            label: `${r.floor ? r.floor.name + " - " : ""}${r.name}`,
          }))
        );
        // Reset room selection when building changes
        setFormData(prev => ({ ...prev, room_id: "" }));
      } catch (err: any) {
        toast.error("Lỗi tải danh sách phòng: " + err.message);
      } finally {
        setRoomsLoading(false);
      }
    };

    fetchRoomsForBuilding();
  }, [selectedBuildingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_id || !formData.title) {
      toast.error("Vui lòng nhập đầy đủ phòng và tiêu đề sự cố");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      toast.success("Tạo phiếu sửa chữa thành công");
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
              <Label className="font-semibold text-foreground/90">Phòng <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="title" className="font-semibold text-foreground/90">Tiêu đề sự cố <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="VD: Hỏng điều hòa, Rò rỉ nước..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="font-semibold text-foreground/90">Mô tả chi tiết</Label>
              <Textarea
                id="description"
                placeholder="Nhập mô tả tình trạng sự cố (tùy chọn)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px] resize-y"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assigned_tech_id" className="font-semibold text-foreground/90">Kỹ thuật viên (Có thể gán sau)</Label>
              <SearchableSelect
                options={techs}
                value={formData.assigned_tech_id}
                onValueChange={(val) => setFormData({ ...formData, assigned_tech_id: val })}
                placeholder="Chọn kỹ thuật viên (nếu có)..."
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
          disabled={submitting || !selectedBuildingId || !formData.room_id || !formData.title} 
          className="w-full shadow-md rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:opacity-90 transition-opacity"
        >
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Lưu phiếu
        </Button>
      </div>
    </div>
  );
}
