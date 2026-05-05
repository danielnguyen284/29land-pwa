"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Building2, 
  Plus, 
  Settings, 
  Loader2,
  Pencil,
  Layers,
  Tags,
  Trash2,
  X,
  ArrowLeft,
  ChevronRight,
  Upload,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api";

interface FeeConfig {
  id: string;
  name: string;
  type: "FIXED" | "CONSUMPTION" | "PER_CAPITA";
  unit_price: number | string;
}

interface Building {
  id: string;
  name: string;
  address: string;
  province?: string;
  district?: string;
  ward?: string;
  building_type?: string;
  description?: string;
  invoice_closing_date: number;
  payment_deadline_date?: number;
  fee_configs: FeeConfig[];
  owner?: { id: string; name: string; phone: string; payment_qr_code?: string };
  managers?: { id: string; name: string; phone: string }[];
  owner_id?: string;
  manager_ids?: string[];
  payment_qr_code?: string;
}

interface Floor {
  id: string;
  name: string;
}

interface RoomClass {
  id: string;
  name: string;
  default_base_rent: number;
}

interface Room {
  id: string;
  name: string;
  status: "EMPTY" | "DEPOSITED" | "OCCUPIED";
  base_rent: number;
  area?: number;
  floor: Floor;
  room_class?: RoomClass;
  service_subscriptions?: { fee_id: string; override_price: number | null; name?: string; type?: string }[];
}

export default function BuildingDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  const [building, setBuilding] = useState<Building | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [roomClasses, setRoomClasses] = useState<RoomClass[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tabs state
  const [activeTab, setActiveTab] = useState("overview");

  // Inline Edit Basic Info
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [editBuilding, setEditBuilding] = useState<Partial<Building>>({});

  const [managerSearch, setManagerSearch] = useState("");

  // Dialog States
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Editing Room state
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Floor Form
  const [floorName, setFloorName] = useState("");

  // Class Form
  const [className, setClassName] = useState("");
  const [classRent, setClassRent] = useState("");

  // Room Form (Create)
  const [roomName, setRoomName] = useState("");
  const [roomFloorId, setRoomFloorId] = useState("");
  const [roomClassId, setRoomClassId] = useState("");
  const [roomRent, setRoomRent] = useState("");
  const [roomArea, setRoomArea] = useState("");

  // Fee Configs state
  const [isEditingFees, setIsEditingFees] = useState(false);
  const [editFees, setEditFees] = useState<FeeConfig[]>([]);

  // Location Data
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  // Users for Owners/Managers
  const [usersList, setUsersList] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState("");

  // --- DIALOG ADDRESS SELECTOR ---
  const [selecting, setSelecting] = useState<"none" | "province" | "district" | "ward">("none");
  const [searchQuery, setSearchQuery] = useState("");

  const handleProvinceSelect = (provinceName: string) => {
    if (!editBuilding) return;
    setEditBuilding({ ...editBuilding, province: provinceName, district: "", ward: "" });
    setSelecting("none");
    setSearchQuery("");
  };

  const handleDistrictSelect = (districtName: string) => {
    if (!editBuilding) return;
    setEditBuilding({ ...editBuilding, district: districtName, ward: "" });
    setSelecting("none");
    setSearchQuery("");
  };

  const handleWardSelect = (wardName: string) => {
    if (!editBuilding) return;
    setEditBuilding({ ...editBuilding, ward: wardName });
    setSelecting("none");
    setSearchQuery("");
  };
  // -------------------------

  const fetchData = async () => {
    try {
      const [bData, rData, fData, cData] = await Promise.all([
        apiFetch<Building>(`/api/buildings/${params.id}`),
        apiFetch<{data: Room[]}>(`/api/rooms?building_id=${params.id}&limit=1000`),
        apiFetch<Floor[]>(`/api/buildings/${params.id}/floors`),
        apiFetch<RoomClass[]>(`/api/buildings/${params.id}/room-classes`)
      ]);
      setBuilding(bData);
      setRooms(rData.data);
      setFloors(fData);
      setRoomClasses(cData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) fetchData();
    // Fetch provinces
    fetch("https://provinces.open-api.vn/api/p/")
      .then(res => res.json())
      .then(data => setProvinces(data))
      .catch(console.error);
      
    // User Role and list
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setCurrentUserRole(u.role);
        if (u.role === "ADMIN" || u.role === "OWNER") {
          apiFetch<any[]>("/api/users").then(res => setUsersList(res)).catch(e => console.error(e));
        }
      } catch (e) {}
    }
  }, [params.id]);

  useEffect(() => {
    if (isEditingBasic && editBuilding.province) {
      const p = provinces.find(x => x.name === editBuilding.province);
      if (p) {
        fetch(`https://provinces.open-api.vn/api/p/${p.code}?depth=2`)
          .then(res => res.json())
          .then(data => setDistricts(data.districts))
          .catch(console.error);
      }
    } else {
      setDistricts([]);
    }
  }, [isEditingBasic, editBuilding.province, provinces]);

  useEffect(() => {
    if (isEditingBasic && editBuilding.district && districts.length > 0) {
      const d = districts.find(x => x.name === editBuilding.district);
      if (d) {
        fetch(`https://provinces.open-api.vn/api/d/${d.code}?depth=2`)
          .then(res => res.json())
          .then(data => setWards(data.wards))
          .catch(console.error);
      }
    } else {
      setWards([]);
    }
  }, [isEditingBasic, editBuilding.district, districts]);

  const ownersList = usersList.filter(u => u.role === "ADMIN" || u.role === "OWNER");
  const managersList = usersList.filter(u => u.role === "MANAGER");


  const filteredManagers = managersList.filter(m => 
    m.name.toLowerCase().includes(managerSearch.toLowerCase()) || 
    m.phone.includes(managerSearch)
  );



  const handleStartEditBasic = () => {
    if (building) {
      setEditBuilding({
        name: building.name,
        address: building.address,
        province: building.province || "",
        district: building.district || "",
        ward: building.ward || "",
        building_type: building.building_type || "Nhà trọ",
        invoice_closing_date: building.invoice_closing_date,
        payment_deadline_date: building.payment_deadline_date || 1,
        description: building.description || "",
        owner_id: building.owner?.id || undefined,
        manager_ids: building.managers?.map(m => m.id) || [],
        payment_qr_code: building.payment_qr_code || undefined
      });
      setIsEditingBasic(true);
    }
  };

  const handleSaveBasic = async () => {
    setFormLoading(true);
    try {
      await apiFetch(`/api/buildings/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(editBuilding),
      });
      setIsEditingBasic(false);
      fetchData();
    } catch (err) {
      alert("Lỗi lưu thông tin");
    } finally {
      setFormLoading(false);
    }
  };

  const handleStartEditFees = () => {
    if (building) {
      setEditFees(building.fee_configs || []);
      setIsEditingFees(true);
    }
  };

  const handleSaveFees = async () => {
    setFormLoading(true);
    try {
      await apiFetch(`/api/buildings/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fee_configs: editFees }),
      });
      setIsEditingFees(false);
      fetchData();
    } catch (err) {
      alert("Lỗi lưu cấu hình phí");
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddFee = () => {
    setEditFees([
      ...editFees, 
      { id: Date.now().toString(), name: "", type: "FIXED", unit_price: 0 }
    ]);
  };

  const handleUpdateFee = (id: string, field: keyof FeeConfig, value: string | number) => {
    setEditFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleRemoveFee = (id: string) => {
    setEditFees(prev => prev.filter(f => f.id !== id));
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await apiFetch(`/api/buildings/${params.id}/floors`, {
        method: "POST",
        body: JSON.stringify({ name: floorName }),
      });
      setFloorDialogOpen(false);
      setFloorName("");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi tạo tầng");
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await apiFetch(`/api/buildings/${params.id}/room-classes`, {
        method: "POST",
        body: JSON.stringify({ name: className, default_base_rent: Number(classRent.replace(/\D/g, "")) }),
      });
      setClassDialogOpen(false);
      setClassName("");
      setClassRent("");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi tạo loại phòng");
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await apiFetch(`/api/rooms`, {
        method: "POST",
        body: JSON.stringify({
          building_id: params.id,
          name: roomName,
          floor_id: roomFloorId,
          room_class_id: roomClassId || undefined,
          base_rent: Number(roomRent.replace(/\D/g, "")),
          area: Number(roomArea),
          status: "EMPTY"
        }),
      });
      setRoomDialogOpen(false);
      setRoomName("");
      setRoomFloorId("");
      setRoomClassId("");
      setRoomRent("");
      setRoomArea("");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi tạo phòng");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveRoomChanges = async () => {
    if (!editingRoom) return;
    setFormLoading(true);
    try {
      await apiFetch(`/api/rooms/${editingRoom.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingRoom.name,
          base_rent: editingRoom.base_rent,
          area: editingRoom.area,
          room_class_id: editingRoom.room_class?.id || null,
          service_subscriptions: editingRoom.service_subscriptions,
        }),
      });
      setEditingRoom(null);
      fetchData();
    } catch (err) {
      alert("Lỗi lưu thông tin phòng");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !building) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-destructive">
        <p>{error || "Không tìm thấy tòa nhà"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/buildings")}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const formatCurrency = (amount: number | string) => {
    if (!amount) return "0 ₫";
    const num = typeof amount === "string" ? parseInt(amount.replace(/\D/g, "") || "0") : amount;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const formatNumberInput = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined || amount === "") return "";
    const num = typeof amount === "string" ? parseInt(amount.replace(/\D/g, "") || "0") : amount;
    if (isNaN(num)) return "";
    return num.toLocaleString("vi-VN");
  };

  const roomsByFloor = floors.map(floor => ({
    ...floor,
    rooms: rooms.filter(r => r.floor.id === floor.id)
  }));

  if (editingRoom) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 md:static md:z-auto md:bg-transparent md:block md:animate-none md:overflow-visible">
        {/* Mobile Header (covers layout header) */}
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b bg-background px-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setEditingRoom(null)} className="mr-2">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <span className="font-bold text-lg text-primary flex-1 text-center">
            Cấu hình {editingRoom.name}
          </span>
          <div className="w-10"></div>
        </div>

        {/* Desktop Header (inline) */}
        <div className="hidden md:flex items-center gap-3 border-b border-border pb-4 sticky top-0 bg-background z-10 pt-2">
          <Button variant="ghost" size="icon" onClick={() => setEditingRoom(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold text-foreground">Cấu hình {editingRoom.name}</h2>
        </div>
        
        <div className="flex-1 p-4 md:p-0 md:pt-6 space-y-6 pb-24">
          <div className="bg-background rounded-xl p-5 border border-border space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-foreground">Tên phòng</Label>
            <Input 
              value={editingRoom.name || ""} 
              onChange={e => setEditingRoom({...editingRoom, name: e.target.value})}
              className="h-11 bg-background border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-foreground">Loại phòng</Label>
            <Select 
              value={editingRoom.room_class?.id || "none"}
              onValueChange={(val) => {
                const safeVal = val || "";
                if (safeVal === "none" || safeVal === "") {
                  setEditingRoom({...editingRoom, room_class: undefined});
                } else {
                  const rc = roomClasses.find(c => c.id === safeVal);
                  if (rc) {
                    setEditingRoom({
                      ...editingRoom,
                      room_class: rc,
                      base_rent: rc.default_base_rent
                    });
                  }
                }
              }}
            >
              <SelectTrigger className="w-full h-11 bg-background border-border">
                <SelectValue placeholder="Chọn loại phòng">
                  {editingRoom.room_class?.id && editingRoom.room_class.id !== ""
                    ? roomClasses.find(c => c.id === editingRoom.room_class?.id)?.name || "Không có loại phòng"
                    : "Không có loại phòng"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="none">Không có loại phòng</SelectItem>
                {roomClasses.map(rc => (
                  <SelectItem key={rc.id} value={rc.id}>{rc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-normal text-foreground">Giá cho thuê</Label>
              <Input 
                value={formatCurrency(editingRoom.base_rent.toString())} 
                onChange={e => setEditingRoom({...editingRoom, base_rent: parseInt(e.target.value.replace(/\D/g, "") || "0")})}
                className="h-11 bg-background border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-normal text-foreground">Diện tích (m²)</Label>
              <Input 
                type="number"
                value={editingRoom.area || ""} 
                onChange={e => setEditingRoom({...editingRoom, area: parseInt(e.target.value || "0")})}
                className="h-11 bg-background border-border"
              />
            </div>
          </div>
        </div>

        <div className="bg-background rounded-xl p-5 border border-border shadow-sm">
          <Label className="text-base font-semibold text-foreground mb-4 block">Thiết lập giá dịch vụ riêng</Label>
          <div className="space-y-4">
            {building?.fee_configs?.map((fee) => {
              const sub = editingRoom.service_subscriptions?.find(s => s.fee_id === fee.id);
              const isActive = !!sub;

              return (
                <div key={fee.id} className="flex flex-col gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{fee.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mặc định: {formatCurrency(fee.unit_price.toString())}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isActive}
                        onChange={(e) => {
                          let newSubs = [...(editingRoom.service_subscriptions || [])];
                          if (e.target.checked) {
                            newSubs.push({ fee_id: fee.id, override_price: null });
                          } else {
                            newSubs = newSubs.filter(s => s.fee_id !== fee.id);
                          }
                          setEditingRoom({ ...editingRoom, service_subscriptions: newSubs });
                        }}
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  {isActive && (
                    <div className="flex flex-col gap-1.5 mt-1 border-t border-border pt-3">
                      <Label className="text-xs text-foreground">Giá thu riêng (để trống nếu dùng giá mặc định)</Label>
                      <Input 
                        placeholder="VD: 3000" 
                        value={sub.override_price !== null && sub.override_price !== undefined ? sub.override_price.toLocaleString("vi-VN") : ""}
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          let newSubs = [...(editingRoom.service_subscriptions || [])];
                          
                          if (rawVal === "") {
                            newSubs = newSubs.map(s => s.fee_id === fee.id ? { ...s, override_price: null } : s);
                          } else {
                            const numericStr = rawVal.replace(/\D/g, "");
                            if (numericStr) {
                              newSubs = newSubs.map(s => s.fee_id === fee.id ? { ...s, override_price: parseInt(numericStr) } : s);
                            }
                          }
                          setEditingRoom({ ...editingRoom, service_subscriptions: newSubs });
                        }}
                        className="h-10 bg-background border-border"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Custom Room-Specific Fees */}
            {editingRoom.service_subscriptions?.filter(s => s.fee_id.startsWith("custom_")).map(sub => (
              <div key={sub.fee_id} className="flex flex-col gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <Input 
                      value={sub.name || ""} 
                      onChange={e => {
                        const newSubs = editingRoom.service_subscriptions?.map(s => s.fee_id === sub.fee_id ? { ...s, name: e.target.value } : s) || [];
                        setEditingRoom({ ...editingRoom, service_subscriptions: newSubs });
                      }}
                      placeholder="Tên phí (VD: Rác, Máy lọc)" 
                      className="h-9 w-full text-sm font-medium bg-background border-border" 
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                      const newSubs = editingRoom.service_subscriptions?.filter(s => s.fee_id !== sub.fee_id) || [];
                      setEditingRoom({ ...editingRoom, service_subscriptions: newSubs });
                  }}>
                      <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-col gap-1.5 mt-1 border-t border-border pt-3">
                  <Label className="text-xs text-foreground">Giá thu mỗi tháng (VNĐ)</Label>
                  <Input 
                    placeholder="VD: 100000" 
                    value={sub.override_price !== null && sub.override_price !== undefined ? sub.override_price.toLocaleString("vi-VN") : ""}
                    onChange={(e) => {
                      const rawVal = e.target.value;
                      const numericStr = rawVal.replace(/\D/g, "");
                      const newSubs = editingRoom.service_subscriptions?.map(s => 
                        s.fee_id === sub.fee_id ? { ...s, override_price: numericStr ? parseInt(numericStr) : null } : s
                      ) || [];
                      setEditingRoom({ ...editingRoom, service_subscriptions: newSubs });
                    }}
                    className="h-10 bg-background border-border"
                  />
                </div>
              </div>
            ))}

            {(!building?.fee_configs || building.fee_configs.length === 0) && (!editingRoom.service_subscriptions?.some(s => s.fee_id.startsWith("custom_"))) && (
              <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">Chưa có dịch vụ nào.</p>
              </div>
            )}

            <Button variant="outline" className="w-full border-dashed" onClick={() => {
              const newSubs = [...(editingRoom.service_subscriptions || []), {
                fee_id: `custom_${Date.now()}`,
                name: "",
                type: "FIXED",
                override_price: null
              }];
              setEditingRoom({ ...editingRoom, service_subscriptions: newSubs });
            }}>
              <Plus className="h-4 w-4 mr-2" /> Thêm phụ phí riêng cho phòng này
            </Button>
          </div>
        </div>
        </div>

        <div className="fixed bottom-0 left-0 w-full p-4 bg-background border-t border-border flex gap-3 z-40 md:left-64 md:w-[calc(100%-16rem)]">
          <Button variant="outline" className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 h-12" onClick={async () => {
            if (!confirm(`Xóa phòng "${editingRoom.name}"? Hành động này không thể hoàn tác.`)) return;
            setFormLoading(true);
            try {
              await apiFetch(`/api/rooms/${editingRoom.id}`, { method: "DELETE" });
              setEditingRoom(null);
              fetchData();
            } catch (err) {
              alert(err instanceof Error ? err.message : "Lỗi xóa phòng");
            } finally {
              setFormLoading(false);
            }
          }}>
            <Trash2 className="h-4 w-4 mr-2" /> Xoá phòng
          </Button>
          <Button className="flex-1 h-12" onClick={handleSaveRoomChanges} disabled={formLoading}>
            {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Lưu & Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Header */}
      <div className="border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{building.name}</h1>
          <Badge variant="outline" className="text-xs bg-muted">{building.building_type || "Nhà trọ"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          {building.address}, {building.ward}, {building.district}, {building.province}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg">Tổng quan</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg">Cấu hình</TabsTrigger>
          <TabsTrigger value="rooms" className="rounded-lg">Quản lý phòng</TabsTrigger>
        </TabsList>

        {/* TAB 1: TỔNG QUAN */}
        <TabsContent value="overview" className="space-y-3">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Thông tin cơ bản
              </CardTitle>
              {!isEditingBasic ? (
                currentUserRole !== "MANAGER" && (
                  <Button variant="outline" size="sm" onClick={handleStartEditBasic}>
                    <Pencil className="mr-2 h-4 w-4" /> Sửa thông tin
                  </Button>
                )
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingBasic(false)}>Hủy</Button>
                  <Button size="sm" onClick={handleSaveBasic} disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lưu
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isEditingBasic ? (
                <div className="grid gap-4 mt-4">
                  <div className="grid gap-2">
                    <Label>Tên tòa nhà <span className="text-red-500">*</span></Label>
                    <Input 
                      value={editBuilding.name || ""} 
                      onChange={e => setEditBuilding({...editBuilding, name: e.target.value})} 
                      className="bg-background"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Loại nhà <span className="text-red-500">*</span></Label>
                    <Select value={editBuilding.building_type || "Nhà trọ"} onValueChange={(v) => setEditBuilding({...editBuilding, building_type: v || undefined})}>
                      <SelectTrigger className="bg-background">
                        <SelectValue>{editBuilding.building_type}</SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="Nhà trọ">Nhà trọ</SelectItem>
                        <SelectItem value="Chung cư mini">Chung cư mini</SelectItem>
                        <SelectItem value="Chung cư">Chung cư</SelectItem>
                        <SelectItem value="Căn hộ dịch vụ">Căn hộ dịch vụ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-normal text-foreground">Địa chỉ <span className="text-red-500">*</span></Label>
                      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
                        <button 
                          className="w-full flex items-center justify-between p-3 border-b border-border"
                          onClick={() => setSelecting("province")}
                        >
                          <span className="text-sm text-muted-foreground">Tỉnh/TP</span>
                          <div className="flex items-center text-primary">
                            <span className="text-sm font-medium mr-1">{editBuilding.province || "Chọn Tỉnh/TP"}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                        
                        <button 
                          className="w-full flex items-center justify-between p-3 border-b border-border"
                          onClick={() => setSelecting("district")}
                          disabled={!editBuilding.province}
                        >
                          <span className="text-sm text-muted-foreground">Khu vực</span>
                          <div className="flex items-center text-primary">
                            <span className="text-sm font-medium mr-1">{editBuilding.district || "Chọn Khu vực"}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                        
                        <button 
                          className="w-full flex items-center justify-between p-3"
                          onClick={() => setSelecting("ward")}
                          disabled={!editBuilding.district}
                        >
                          <span className="text-sm text-muted-foreground">Phường/Xã</span>
                          <div className="flex items-center text-primary">
                            <span className="text-sm font-medium mr-1">{editBuilding.ward || "Chọn Phường/Xã"}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Địa chỉ chi tiết (Số nhà, Đường)</Label>
                    <Input 
                      value={editBuilding.address || ""} 
                      onChange={e => setEditBuilding({...editBuilding, address: e.target.value})} 
                      className="bg-background"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Ngày chốt hóa đơn (Mùng) <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        value={editBuilding.invoice_closing_date || ""} 
                        onChange={e => setEditBuilding({...editBuilding, invoice_closing_date: parseInt(e.target.value)})} 
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ngày hạn đóng tiền (Mùng)</Label>
                      <Input 
                        type="number"
                        value={editBuilding.payment_deadline_date || ""} 
                        onChange={e => setEditBuilding({...editBuilding, payment_deadline_date: parseInt(e.target.value)})} 
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Mô tả thêm</Label>
                    <textarea 
                      value={editBuilding.description || ""} 
                      onChange={e => setEditBuilding({...editBuilding, description: e.target.value})} 
                      className="w-full min-h-[80px] p-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Chủ nhà */}
                  {currentUserRole === "ADMIN" && (
                    <div className="grid gap-2 relative">
                      <Label>Chủ nhà</Label>
                      <SearchableSelect
                        options={ownersList.map(o => ({
                          value: o.id,
                          label: `${o.name} - ${o.phone}`
                        }))}
                        value={editBuilding.owner_id || ""}
                        onValueChange={(v) => setEditBuilding({...editBuilding, owner_id: v})}
                        placeholder="Chọn chủ nhà"
                        searchPlaceholder="Tìm chủ nhà (tên, sđt)..."
                        emptyMessage="Không tìm thấy chủ nhà"
                        className="bg-background"
                      />
                    </div>
                  )}

                  {/* Quản lý */}
                  <div className="grid gap-2">
                    <Label>Quản lý tòa nhà</Label>
                    <div className="bg-background rounded-md border border-border overflow-hidden">
                      <div className="p-2 border-b border-border bg-muted/50">
                        <Input 
                          placeholder="Tìm quản lý (tên, sđt)..." 
                          value={managerSearch}
                          onChange={(e) => setManagerSearch(e.target.value)}
                          className="h-8 text-sm bg-background"
                        />
                      </div>
                      <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                        {filteredManagers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Chưa có quản lý nào phù hợp</p>
                        ) : (
                          filteredManagers.map(m => (
                            <label key={m.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={(editBuilding.manager_ids || []).includes(m.id)}
                                onChange={(e) => {
                                  const ids = editBuilding.manager_ids || [];
                                  if (e.target.checked) setEditBuilding({...editBuilding, manager_ids: [...ids, m.id]});
                                  else setEditBuilding({...editBuilding, manager_ids: ids.filter(id => id !== m.id)});
                                }}
                                className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                              />
                              <span className="text-sm">{m.name} - {m.phone}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mã QR */}
                  <div className="grid gap-2">
                    <Label>Mã QR Thanh toán chung</Label>
                    {editBuilding.payment_qr_code ? (
                      <div className="relative inline-block border border-border rounded-lg p-2">
                        <img src={editBuilding.payment_qr_code} alt="QR Code" className="max-h-32 object-contain" />
                        <button 
                          onClick={() => setEditBuilding({...editBuilding, payment_qr_code: undefined})}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input 
                          type="file" 
                          id="upload-qr-edit" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            if (!e.target.files || e.target.files.length === 0) return;
                            const file = e.target.files[0];
                            const reader = new FileReader();
                            reader.onload = async () => {
                              try {
                                const res = await apiFetch<{url: string}>("/api/upload", {
                                  method: "POST",
                                  body: JSON.stringify({ image: reader.result as string })
                                });
                                setEditBuilding({...editBuilding, payment_qr_code: res.url});
                              } catch (err) {
                                alert("Lỗi tải ảnh lên");
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <label htmlFor="upload-qr-edit" className="cursor-pointer inline-flex items-center justify-center w-full h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                          <Upload className="w-4 h-4 mr-2" />
                          Tải ảnh QR lên
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-y-4 md:grid-cols-2 mt-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Loại nhà</p>
                    <p>{building.building_type || "Không xác định"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Ngày chốt số hàng tháng</p>
                    <p>Mùng {building.invoice_closing_date}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Hạn đóng tiền hàng tháng</p>
                    <p>Mùng {building.payment_deadline_date || "Không xác định"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Tổng số phòng</p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{rooms.length} phòng</span>
                      <span className="text-emerald-600">({rooms.filter(r => r.status === "OCCUPIED").length} đang ở)</span>
                      <span className="text-red-600">({rooms.filter(r => r.status === "EMPTY").length} trống)</span>
                    </div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-muted-foreground font-medium">Mô tả</p>
                    <p className="whitespace-pre-wrap">{building.description || "Chưa có mô tả"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Chủ nhà</p>
                    <p>{building.owner ? `${building.owner.name} - ${building.owner.phone}` : "Chưa gán"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Quản lý</p>
                    {building.managers && building.managers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {building.managers.map(m => (
                          <Badge key={m.id} variant="outline" className="text-xs">{m.name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p>Chưa gán</p>
                    )}
                  </div>
                  {building.payment_qr_code ? (
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-muted-foreground font-medium">Mã QR Thanh toán (Của tòa nhà)</p>
                      <img src={building.payment_qr_code} alt="QR Code Tòa nhà" className="max-h-40 object-contain border rounded-lg p-2" />
                    </div>
                  ) : building.owner?.payment_qr_code ? (
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-muted-foreground font-medium">Mã QR Thanh toán (Mặc định từ Chủ nhà)</p>
                      <img src={building.owner.payment_qr_code} alt="QR Code Chủ nhà" className="max-h-40 object-contain border rounded-lg p-2 opacity-80" />
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CẤU HÌNH */}
        <TabsContent value="settings">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Phân khúc phòng */}
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Tags className="h-5 w-5 text-primary" />
                  Phân khúc phòng ({roomClasses.length})
                </CardTitle>
                {currentUserRole !== "MANAGER" && (
                  <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
                    <DialogTrigger render={<Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>} />
                    <DialogContent>
                      <DialogHeader><DialogTitle>Thêm loại phòng</DialogTitle></DialogHeader>
                      <form onSubmit={handleCreateClass}>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="className">Tên loại phòng</Label>
                            <Input id="className" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Phòng Studio" required />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="classRent">Giá thuê mặc định</Label>
                            <Input id="classRent" value={classRent} onChange={(e) => setClassRent(formatNumberInput(e.target.value))} placeholder="4,000,000" required />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="mt-4">
                <div className="flex flex-col gap-3">
                  {roomClasses.map(c => (
                    <div key={c.id} className="flex justify-between items-center border-b pb-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{formatCurrency(c.default_base_rent)}</span>
                        {currentUserRole !== "MANAGER" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              if (!confirm(`Xóa phân khúc "${c.name}"?`)) return;
                              try {
                                await apiFetch(`/api/buildings/${params.id}/room-classes/${c.id}`, { method: "DELETE" });
                                fetchData();
                              } catch (err) {
                                alert(err instanceof Error ? err.message : "Lỗi xóa");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {roomClasses.length === 0 && <span className="text-sm text-muted-foreground italic">Chưa có phân khúc phòng nào.</span>}
                </div>
              </CardContent>
            </Card>

            {/* Cấu hình phí */}
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Cấu hình phí
                </CardTitle>
                {!isEditingFees ? (
                  currentUserRole !== "MANAGER" && (
                    <Button variant="outline" size="sm" onClick={handleStartEditFees}>
                      <Pencil className="mr-2 h-4 w-4" /> Sửa
                    </Button>
                  )
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingFees(false)}>Hủy</Button>
                    <Button size="sm" onClick={handleSaveFees} disabled={formLoading}>
                      {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Lưu
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="mt-4">
                {!isEditingFees ? (
                  <div className="flex flex-col gap-3">
                    {building.fee_configs && building.fee_configs.map((fee, idx) => (
                      <div key={fee.id || idx} className="flex justify-between items-center border-b pb-2 text-sm">
                        <div>
                          <p className="font-medium">{fee.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{fee.type === "CONSUMPTION" ? "Phát sinh theo đồng hồ" : fee.type === "FIXED" ? "Cố định / phòng" : "Theo người"}</p>
                        </div>
                        <span className="text-emerald-700 font-medium">{formatCurrency(fee.unit_price)}</span>
                      </div>
                    ))}
                    {(!building.fee_configs || building.fee_configs.length === 0) && (
                      <span className="text-sm text-muted-foreground italic">Chưa có cấu hình phí nào.</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editFees.map((fee, index) => (
                      <div key={`${fee.id}_${index}`} className="flex gap-2 items-start bg-muted p-2 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <Input 
                            placeholder="Tên phí (VD: Rác)" 
                            value={fee.name} 
                            onChange={e => handleUpdateFee(fee.id, "name", e.target.value)}
                            disabled={fee.id === "dien" || fee.id === "nuoc"}
                            className="h-9 bg-background"
                          />
                          <Input 
                            placeholder="Đơn giá" 
                            value={formatNumberInput(fee.unit_price)} 
                            onChange={e => handleUpdateFee(fee.id, "unit_price", e.target.value ? parseInt(e.target.value.replace(/\D/g, "")) : "")}
                            className="h-9 bg-background"
                          />
                        </div>
                        <div className="w-[110px] space-y-2">
                          <Select 
                            value={fee.type} 
                            onValueChange={v => handleUpdateFee(fee.id, "type", v as "FIXED"|"CONSUMPTION"|"PER_CAPITA")}
                            disabled={fee.id === "dien"}
                          >
                            <SelectTrigger className={`h-9 ${fee.id === "dien" ? "bg-muted" : "bg-background"}`}>
                              <SelectValue>{fee.type === "CONSUMPTION" ? "Phát sinh" : fee.type === "FIXED" ? "Cố định" : "Theo người"}</SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectItem value="CONSUMPTION">Phát sinh</SelectItem>
                              <SelectItem value="FIXED">Cố định</SelectItem>
                              <SelectItem value="PER_CAPITA">Theo người</SelectItem>
                            </SelectContent>
                          </Select>
                          {fee.id !== "dien" && fee.id !== "nuoc" && (
                            <Button type="button" variant="ghost" size="sm" className="h-9 w-full text-red-500" onClick={() => handleRemoveFee(fee.id)}>
                              Xóa
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" className="w-full" onClick={handleAddFee}>
                      <Plus className="mr-2 h-4 w-4" /> Thêm phí dịch vụ
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: QUẢN LÝ PHÒNG */}
        <TabsContent value="rooms">
          <div className="flex items-center justify-end mb-4">
            <div className="flex gap-2">
              {currentUserRole !== "MANAGER" && (
                <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
                  <DialogTrigger render={<Button variant="outline"><Plus className="mr-2 h-4 w-4" />Thêm tầng</Button>} />
                  <DialogContent>
                    <DialogHeader><DialogTitle>Thêm tầng mới</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateFloor}>
                      <div className="grid gap-2 py-4">
                        <Label>Tên tầng</Label>
                        <Input value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="Tầng 1" required />
                      </div>
                      <DialogFooter><Button type="submit" disabled={formLoading}>Lưu</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              {currentUserRole !== "MANAGER" && (
                <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
                  <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />Thêm phòng</Button>} />
                  <DialogContent>
                    <DialogHeader><DialogTitle>Thêm phòng mới</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateRoom}>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Tên/Số phòng <span className="text-red-500">*</span></Label>
                          <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Phòng 101" required />
                        </div>
                        <div className="grid gap-2">
                          <Label>Tầng <span className="text-red-500">*</span></Label>
                          <Select value={roomFloorId} onValueChange={(v) => setRoomFloorId(v || "")}>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn tầng">
                                {roomFloorId ? floors.find(f => f.id === roomFloorId)?.name : "Chọn tầng"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              {floors.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Loại phòng</Label>
                          <Select value={roomClassId} onValueChange={(v) => { 
                            if (v && v !== "none") {
                              setRoomClassId(v);
                              const cls = roomClasses.find(c => c.id === v);
                              if (cls) setRoomRent(cls.default_base_rent.toString());
                            } else {
                              setRoomClassId("");
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn loại phòng">
                                {roomClassId ? roomClasses.find(c => c.id === roomClassId)?.name : "Không có loại phòng"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectItem value="none">Không có loại phòng</SelectItem>
                              {roomClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Giá thuê (VND) <span className="text-red-500">*</span></Label>
                            <Input value={roomRent} onChange={(e) => setRoomRent(formatCurrency(e.target.value))} required />
                          </div>
                          <div className="grid gap-2">
                            <Label>Diện tích (m2)</Label>
                            <Input type="number" value={roomArea} onChange={(e) => setRoomArea(e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter><Button type="submit" disabled={formLoading || !roomFloorId}>Lưu</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {roomsByFloor.map((floor) => (
              <div key={floor.id} className="bg-muted/50 rounded-2xl p-4 md:p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{floor.name}</h3>
                  <span className="text-sm text-muted-foreground">{floor.rooms.length} phòng</span>
                </div>
                
                {floor.rooms.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {floor.rooms.map((room) => (
                      <div 
                        key={room.id}
                        onClick={() => {
                          if (currentUserRole !== "MANAGER") {
                            setEditingRoom(room);
                          }
                        }}
                        className={`bg-background p-3 rounded-xl border border-border shadow-sm hover:shadow-md transition-all relative group ${currentUserRole !== "MANAGER" ? "cursor-pointer" : ""}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium">{room.name}</p>
                          {currentUserRole !== "MANAGER" && (
                            <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          )}
                        </div>
                        <p className="text-sm font-semibold text-emerald-700">{formatCurrency(room.base_rent)}</p>
                        <div className="mt-2 text-xs text-muted-foreground flex justify-between items-center">
                          <span>{room.room_class ? room.room_class.name : "Thường"}</span>
                          {room.area ? <span>{room.area}m²</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-background rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                    Chưa có phòng nào ở {floor.name}
                  </div>
                )}
              </div>
            ))}
            {floors.length === 0 && (
              <div className="text-center py-12 bg-muted rounded-2xl border border-dashed border-border">
                <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">Chưa có tầng nào. Hãy thêm tầng để tạo phòng.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>



      {/* --- LOCATION SELECTION MODAL --- */}
      {selecting !== "none" && (() => {
        let list: any[] = [];
        let title = "";
        let onSelect = (item: any) => {};

        if (selecting === "province") { list = provinces; title = "Chọn Tỉnh/TP"; onSelect = (item) => handleProvinceSelect(item.name); }
        if (selecting === "district") { list = districts; title = "Chọn Khu vực"; onSelect = (item) => handleDistrictSelect(item.name); }
        if (selecting === "ward") { list = wards; title = "Chọn Phường/Xã"; onSelect = (item) => handleWardSelect(item.name); }

        const filteredList = list
          .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name));

        return (
          <Dialog open={true} onOpenChange={() => { setSelecting("none"); setSearchQuery(""); }}>
            <DialogContent className="max-w-md w-full h-full sm:h-[600px] p-0 flex flex-col overflow-hidden bg-background">
              <DialogTitle className="sr-only">{title}</DialogTitle>
              <div className="flex items-center px-4 h-14 border-b shrink-0">
                <button onClick={() => { setSelecting("none"); setSearchQuery(""); }} className="p-2 -ml-2 text-foreground">
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-lg font-semibold mx-auto -translate-x-3">{title}</h2>
              </div>
              
              <div className="p-2 border-b shrink-0">
                <Input 
                  placeholder="Tìm kiếm..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted/50 border-transparent focus-visible:ring-primary/20"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredList.map((item, index) => (
                  <button
                    key={item.code || index}
                    className="w-full px-4 py-4 text-left border-b hover:bg-muted/50 transition-colors"
                    onClick={() => onSelect(item)}
                  >
                    {item.name}
                  </button>
                ))}
                {list.length > 0 && filteredList.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    Không tìm thấy kết quả phù hợp
                  </div>
                )}
                {list.length === 0 && (
                  <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-muted-foreground">Đang tải dữ liệu...</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
      
    </div>
  );
}
