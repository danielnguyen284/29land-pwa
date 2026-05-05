"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Search,
  Filter,
  Loader2,
  Building2,
  Phone,
  CreditCard,
  Home,
  Plus,
  Pencil,
  Power,
  PowerOff,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

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
}

interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  cccd: string | null;
  is_representative: boolean;
  status: string;
  room_id: string;
  room: {
    name: string;
    floor: {
      name: string;
      building: {
        id: string;
        name: string;
      }
    }
  };
  created_at: string;
}

export default function TenantsPage() {

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [filterSearch, setFilterSearch] = useState("");
  const [filterBuilding, setFilterBuilding] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [modalLoading, setModalLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Tenant>>({});
  const [formBuildingId, setFormBuildingId] = useState<string>("");
  const [formRoomId, setFormRoomId] = useState<string>("");
  const [formRooms, setFormRooms] = useState<Room[]>([]);
  const [openBuilding, setOpenBuilding] = useState(false);
  const [openRoom, setOpenRoom] = useState(false);

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      fetchTenants();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterBuilding, filterStatus, filterSearch]);

  useEffect(() => {
    if (formBuildingId && modalMode === "add") {
      fetchRoomsForBuilding(formBuildingId);
    }
  }, [formBuildingId, modalMode]);

  const fetchBuildings = async () => {
    try {
      const res = await apiFetch<{data: Building[]}>("/api/buildings?limit=1000");
      setBuildings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoomsForBuilding = async (buildingId: string) => {
    try {
      const res = await apiFetch<{data: Room[]}>(`/api/rooms?building_id=${buildingId}&limit=1000`);
      setFormRooms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      let url = "/api/tenants";
      const params = new URLSearchParams();
      if (filterBuilding !== "ALL") params.append("building_id", filterBuilding);
      if (filterStatus !== "ALL") params.append("status", filterStatus);
      if (filterSearch) params.append("search", filterSearch);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const data = await apiFetch<Tenant[]>(url);
      setTenants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode("add");
    setFormData({
      name: "",
      phone: "",
      cccd: "",
    });
    setFormBuildingId("");
    setFormRoomId("");
    setFormRooms([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tenant: Tenant) => {
    setModalMode("edit");
    setFormData({
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone || "",
      cccd: tenant.cccd || "",
      is_representative: tenant.is_representative,
      status: tenant.status,
      room_id: tenant.room_id
    });
    setIsModalOpen(true);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    
    try {
      if (modalMode === "add") {
        if (!formRoomId) {
          toast.error("Lỗi", { description: "Vui lòng chọn phòng" });
          setModalLoading(false);
          return;
        }
        await apiFetch(`/api/rooms/${formRoomId}/tenants`, {
          method: "POST",
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            cccd: formData.cccd,
          })
        });
        toast.success("Thành công", { description: "Đã thêm khách hàng mới" });
      } else {
        await apiFetch(`/api/rooms/${formData.room_id}/tenants/${formData.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            cccd: formData.cccd,
            status: formData.status,
          })
        });
        toast.success("Thành công", { description: "Đã cập nhật thông tin khách hàng" });
      }
      
      setIsModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message || "Đã xảy ra lỗi" });
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="md:space-y-6 pb-24 md:pb-0">
      <div className="hidden md:flex items-center justify-between mb-4 md:mb-0">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold tracking-tight">Khách thuê</h1>
          <p className="text-muted-foreground">
            Quản lý danh sách khách hàng và người đại diện
          </p>
        </div>
        <Button className="hidden md:flex" onClick={handleOpenAddModal}>
          <Plus className="mr-2 h-4 w-4" /> Thêm khách mới
        </Button>
      </div>

      <div className="space-y-4">
      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 w-full relative">
              <label className="text-sm font-medium text-muted-foreground">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tên, SĐT, CCCD..."
                  className="pl-9"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-muted-foreground">Nhà</label>
              <SearchableSelect
                options={[
                  { value: "ALL", label: "Tất cả" },
                  ...buildings.map((b) => ({
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
                    displayLabel: b.name,
                  })),
                ]}
                value={filterBuilding}
                onValueChange={(v) => setFilterBuilding(v || "ALL")}
                placeholder="Tất cả"
                searchPlaceholder="Tìm kiếm nhà..."
              />
            </div>
            
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-muted-foreground">Trạng thái</label>
              <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tất cả">
                    {filterStatus === "ALL" ? "Tất cả" : 
                     filterStatus === "ACTIVE" ? "Đang thuê" : "Đã rời đi"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  <SelectItem value="ACTIVE">Đang thuê</SelectItem>
                  <SelectItem value="INACTIVE">Đã rời đi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Tenant List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tenants.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed">
          <Users className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h3 className="font-semibold text-xl mb-1">Không có dữ liệu</h3>
          <p className="text-muted-foreground">Không tìm thấy khách hàng nào phù hợp với bộ lọc hiện tại.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="hover:shadow-md transition-shadow flex flex-col h-full overflow-hidden">
              <div className={`h-2 ${tenant.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-muted'}`} />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold">{tenant.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {tenant.is_representative ? (
                        <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">Đại diện</span>
                      ) : (
                        <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase">Thành viên</span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${tenant.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
                        {tenant.status === 'ACTIVE' ? 'Đang thuê' : 'Đã rời đi'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 space-y-3 pb-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tenant.phone || "Chưa cập nhật"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tenant.cccd || "Chưa cập nhật"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Home className="w-4 h-4 shrink-0" />
                    <span className="truncate text-foreground font-medium">
                      {tenant.room?.name} <span className="text-muted-foreground font-normal">({tenant.room?.floor?.building?.name})</span>
                    </span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="pt-0 border-t bg-muted/20 p-3">
                <Button variant="ghost" className="w-full h-8 text-sm text-primary" onClick={() => handleOpenEditModal(tenant)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Sửa thông tin
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Mobile Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-background border-t md:hidden z-20">
        <Button className="w-full rounded-xl py-6 text-base font-semibold" onClick={handleOpenAddModal}>
          Thêm mới
        </Button>
      </div>

      {/* Modal Add/Edit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{modalMode === "add" ? "Thêm khách hàng mới" : "Sửa thông tin khách hàng"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTenant} className="space-y-4 pt-4">
            
            {modalMode === "add" && (
              <div className="grid gap-4 bg-muted/50 p-4 rounded-lg border">
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
                      displayLabel: b.name,
                    }))}
                    value={formBuildingId}
                    onValueChange={(v) => {
                      setFormBuildingId(v);
                      setFormRoomId("");
                    }}
                    placeholder="Chọn nhà..."
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
                    placeholder="Chọn phòng..."
                    searchPlaceholder="Tìm kiếm phòng..."
                    emptyMessage="Không tìm thấy phòng."
                    disabled={!formBuildingId}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Họ và tên <span className="text-destructive">*</span></Label>
              <Input 
                value={formData.name || ""} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                required 
                placeholder="Nhập tên khách hàng"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Số điện thoại</Label>
                <Input 
                  value={formData.phone || ""} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  placeholder="Nhập SĐT"
                />
              </div>
              <div className="space-y-2">
                <Label>CCCD/CMND</Label>
                <Input 
                  value={formData.cccd || ""} 
                  onChange={e => setFormData({...formData, cccd: e.target.value})} 
                  placeholder="Số CCCD"
                />
              </div>
            </div>

            {modalMode === "edit" && (
              <div className="pt-2 border-t mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Vai trò:</span>
                  {formData.is_representative ? (
                    <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full text-xs">Đại diện</span>
                  ) : (
                    <span className="font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full text-xs">Thành viên</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Đại diện được chọn ở trang Hợp đồng</p>
              </div>
            )}

            {modalMode === "edit" && (
              <div className="space-y-2 pt-2">
                <Label>Trạng thái</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({...formData, status: v || undefined})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái">
                      {formData.status === "ACTIVE" ? "Đang thuê" : formData.status === "INACTIVE" ? "Đã rời đi" : "Chọn trạng thái"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Đang thuê</SelectItem>
                    <SelectItem value="INACTIVE">Đã rời đi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={modalLoading} className="flex-1">
                {modalLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Lưu
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
