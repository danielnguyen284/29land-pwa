"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ChevronRight, HelpCircle, Plus, Trash2, Upload, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api";

interface LocationItem {
  id: string;
  name: string;
  full_name: string;
}

interface AddBuildingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddBuildingWizard({ open, onOpenChange, onSuccess }: AddBuildingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // User & assignment state
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  
  // Search states
  const [ownerSearch, setOwnerSearch] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  
  // Form state
  const [name, setName] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [address, setAddress] = useState("");

  // Location data
  const [provinces, setProvinces] = useState<LocationItem[]>([]);
  const [districts, setDistricts] = useState<LocationItem[]>([]);
  const [wards, setWards] = useState<LocationItem[]>([]);

  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 Form State
  const [floorCount, setFloorCount] = useState<string>("");
  const [roomsPerFloor, setRoomsPerFloor] = useState<string>("");
  const [defaultArea, setDefaultArea] = useState<string>("");
  const [defaultRent, setDefaultRent] = useState<string>("");
  const [invoiceClosingDate, setInvoiceClosingDate] = useState<string>("");
  const [paymentDeadlineDate, setPaymentDeadlineDate] = useState<string>("");
  const [buildingType, setBuildingType] = useState<string>("Nhà trọ");
  const [description, setDescription] = useState("");
  const [paymentQrCode, setPaymentQrCode] = useState("");
  const [leaseStartDate, setLeaseStartDate] = useState("");
  const [leaseTermYears, setLeaseTermYears] = useState("");

  const [fees, setFees] = useState<any[]>([
    { id: "dien", name: "Điện", type: "CONSUMPTION", unit_price: "" },
    { id: "nuoc", name: "Nước", type: "CONSUMPTION", unit_price: "" },
    { id: "internet", name: "Internet", type: "FIXED", unit_price: "" },
    { id: "maygiat", name: "Máy giặt", type: "FIXED", unit_price: "" },
    { id: "dvchung", name: "Dịch vụ chung", type: "FIXED", unit_price: "" }
  ]);

  const [selecting, setSelecting] = useState<"none" | "province" | "district" | "ward">("none");

  const [roomClasses, setRoomClasses] = useState<{ id: string; name: string; default_base_rent: string }[]>([]);

  type RoomData = { id: string; name: string; base_rent: number; area: number; room_class_id?: string; service_subscriptions?: any[] };
  type FloorData = { id: string; floor_number: number; rooms: RoomData[] };
  const [generatedFloors, setGeneratedFloors] = useState<FloorData[]>([]);
  const [editingRoom, setEditingRoom] = useState<{ floorId: string; room: RoomData } | null>(null);

  const fetchProvinces = async () => {
    try {
      const res = await fetch("https://esgoo.net/api-tinhthanh/1/0.htm");
      const data = await res.json();
      if (data.error === 0) setProvinces(data.data);
    } catch (e) {
      console.error("Failed to fetch provinces", e);
    }
  };

  useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setProvince("");
      setProvinceId("");
      setDistrict("");
      setDistrictId("");
      setWard("");
      setAddress("");
      setOwnerIds([]);
      setManagerIds([]);
      setPaymentQrCode("");
      setSelecting("none");
      setSearchQuery("");
      setFloorCount("");
      setRoomsPerFloor("");
      setDefaultArea("");
      setDefaultRent("");
      setInvoiceClosingDate("");
      setPaymentDeadlineDate("");
      setBuildingType("Nhà trọ");
      setDescription("");
      setLeaseStartDate("");
      setLeaseTermYears("");
      setFees([
        { id: "dien", name: "Điện", type: "CONSUMPTION", unit_price: "" },
        { id: "nuoc", name: "Nước", type: "CONSUMPTION", unit_price: "" },
        { id: "internet", name: "Internet", type: "FIXED", unit_price: "" },
        { id: "maygiat", name: "Máy giặt", type: "FIXED", unit_price: "" },
        { id: "dvchung", name: "Dịch vụ chung", type: "FIXED", unit_price: "" }
      ]);
      setRoomClasses([]);
      fetchProvinces();
      
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
    }
  }, [open]);

  const owners = usersList.filter(u => u.role === "ADMIN" || u.role === "OWNER");
  const filteredOwners = owners.filter(o => 
    o.name.toLowerCase().includes(ownerSearch.toLowerCase()) || 
    (o.phone && o.phone.includes(ownerSearch))
  );
  const managers = usersList.filter(u => u.role === "MANAGER");


  const filteredManagers = managers.filter(m => 
    m.name.toLowerCase().includes(managerSearch.toLowerCase()) || 
    m.phone.includes(managerSearch)
  );



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setLoading(true);
        const res = await apiFetch<{url: string}>("/api/upload", {
          method: "POST",
          body: JSON.stringify({ image: reader.result as string })
        });
        setPaymentQrCode(res.url);
      } catch (err) {
        alert("Lỗi tải ảnh lên");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const formatCurrency = (val: string) => {
    const num = val.replace(/\D/g, "");
    if (!num) return "";
    return parseInt(num).toLocaleString("vi-VN");
  };

  const handleAddFee = () => {
    setFees([...fees, { id: `fee_${Date.now()}`, name: "", type: "FIXED", unit_price: "" }]);
  };

  const handleRemoveFee = (id: string) => {
    setFees(fees.filter(f => f.id !== id));
  };

  const handleFeeChange = (id: string, field: string, value: string) => {
    setFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleAddRoomClass = () => {
    setRoomClasses([...roomClasses, { id: `rc_${Date.now()}`, name: "", default_base_rent: "" }]);
  };

  const handleRemoveRoomClass = (id: string) => {
    setRoomClasses(roomClasses.filter(rc => rc.id !== id));
  };

  const handleRoomClassChange = (id: string, field: string, value: string) => {
    setRoomClasses(prev => prev.map(rc => rc.id === id ? { ...rc, [field]: value } : rc));
  };

  const handleUpdateRoom = (updates: Partial<RoomData>) => {
    if (!editingRoom) return;
    
    setEditingRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        room: { ...prev.room, ...updates }
      };
    });
    
    setGeneratedFloors(prev => prev.map(f => {
      if (f.id === editingRoom.floorId) {
        return {
          ...f,
          rooms: f.rooms.map(r => r.id === editingRoom.room.id ? { ...r, ...updates } : r)
        };
      }
      return f;
    }));
  };

  const handleUpdateRoomService = (feeId: string, isActive: boolean, overridePrice: string) => {
    if (!editingRoom) return;
    
    // Ensure we have an array of subscriptions, filtering out custom fees for this fallback check
    let currentSubs = editingRoom.room.service_subscriptions || [];

    if (!isActive) {
      currentSubs = currentSubs.filter(s => s.fee_id !== feeId);
    } else {
      const existing = currentSubs.find(s => s.fee_id === feeId);
      if (existing) {
        currentSubs = currentSubs.map(s => s.fee_id === feeId ? {
          ...s,
          override_price: overridePrice !== "" ? parseInt(overridePrice.replace(/\D/g, "") || "0") : null
        } : s);
      } else {
        currentSubs.push({
          fee_id: feeId,
          override_price: overridePrice !== "" ? parseInt(overridePrice.replace(/\D/g, "") || "0") : null
        });
      }
    }

    handleUpdateRoom({ service_subscriptions: currentSubs });
  };

  const handleDeleteRoom = () => {
    if (!editingRoom) return;
    setGeneratedFloors(prev => prev.map(f => {
      if (f.id === editingRoom.floorId) {
        return { ...f, rooms: f.rooms.filter(r => r.id !== editingRoom.room.id) };
      }
      return f;
    }));
    setEditingRoom(null);
  };

  const handleAddRoom = (floorId: string) => {
    setGeneratedFloors(prev => prev.map(f => {
      if (f.id === floorId) {
        const nextIdx = f.rooms.length + 1;
        const floorPad = prev.length >= 10 ? 2 : 1;
        const roomName = `P${String(f.floor_number).padStart(floorPad, '0')}${String(nextIdx).padStart(2, '0')}`;
        
        return {
          ...f,
          rooms: [...f.rooms, {
            id: Math.random().toString(),
            name: roomName,
            base_rent: parseInt(defaultRent.replace(/\D/g, ""), 10) || 0,
            area: parseInt(defaultArea, 10) || 0
          }]
        };
      }
      return f;
    }));
  };

  const fetchDistricts = async (provId: string) => {
    try {
      const res = await fetch(`https://esgoo.net/api-tinhthanh/2/${provId}.htm`);
      const data = await res.json();
      if (data.error === 0) setDistricts(data.data);
    } catch (e) {
      console.error("Failed to fetch districts", e);
    }
  };

  const fetchWards = async (distId: string) => {
    try {
      const res = await fetch(`https://esgoo.net/api-tinhthanh/3/${distId}.htm`);
      const data = await res.json();
      if (data.error === 0) setWards(data.data);
    } catch (e) {
      console.error("Failed to fetch wards", e);
    }
  };

  const handleProvinceSelect = (p: LocationItem) => {
    setProvince(p.full_name);
    setProvinceId(p.id);
    setDistrict("");
    setDistrictId("");
    setWard("");
    setSelecting("none");
    setSearchQuery("");
    fetchDistricts(p.id);
  };

  const handleDistrictSelect = (d: LocationItem) => {
    setDistrict(d.full_name);
    setDistrictId(d.id);
    setWard("");
    setSelecting("none");
    setSearchQuery("");
    fetchWards(d.id);
  };

  const handleWardSelect = (w: LocationItem) => {
    setWard(w.full_name);
    setSelecting("none");
    setSearchQuery("");
  };

  const handleSubmit = async () => {
    if (step < 3) {
      if (step === 2) {
        if (!floorCount || !roomsPerFloor || !defaultArea || !defaultRent || !invoiceClosingDate || !paymentDeadlineDate) {
          alert("Vui lòng điền đầy đủ các thông tin bắt buộc.");
          return;
        }
        const inv = parseInt(invoiceClosingDate);
        const pay = parseInt(paymentDeadlineDate);
        if (inv > 28 || inv < 1 || pay > 28 || pay < 1 || inv === pay) {
          // Block submit if any error
          return;
        }

        if (generatedFloors.length === 0) {
          const floorsCountNum = parseInt(floorCount, 10) || 1;
          const roomsPerFloorNum = parseInt(roomsPerFloor, 10) || 1;
          const baseArea = parseInt(defaultArea, 10) || 0;
          const baseRent = parseInt(defaultRent.replace(/\D/g, ""), 10) || 0;
          
          const newFloors: FloorData[] = [];
          const floorPad = floorsCountNum >= 10 ? 2 : 1;

          for (let f = 1; f <= floorsCountNum; f++) {
            const rooms: RoomData[] = [];
            for (let r = 1; r <= roomsPerFloorNum; r++) {
              const roomName = `P${String(f).padStart(floorPad, '0')}${String(r).padStart(2, '0')}`;
              rooms.push({
                 id: Math.random().toString(),
                 name: roomName,
                 base_rent: baseRent,
                 area: baseArea,
                 room_class_id: undefined
              });
            }
            newFloors.push({
               id: Math.random().toString(),
               floor_number: f,
               rooms
            });
          }
          setGeneratedFloors(newFloors);
        }
      }
      setStep(step + 1);
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/buildings", {
        method: "POST",
        body: JSON.stringify({ 
          name, address, province, district, ward,
          invoice_closing_date: parseInt(invoiceClosingDate),
          payment_deadline_date: parseInt(paymentDeadlineDate),
          building_type: buildingType,
          description: description,
          fee_configs: fees.map(f => ({
            id: f.id || `fee_${Date.now()}_${Math.random()}`,
            name: f.name,
            type: f.type,
            unit_price: parseInt(f.unit_price.replace(/\D/g, "") || "0")
          })),
          room_classes: roomClasses.map(rc => ({
            id: rc.id,
            name: rc.name,
            default_base_rent: parseInt(rc.default_base_rent.replace(/\D/g, "") || "0")
          })),
          floors: generatedFloors,
          owner_ids: ownerIds,
          manager_ids: managerIds,
          payment_qr_code: paymentQrCode || undefined,
          lease_start_date: leaseStartDate || undefined,
          lease_term_years: leaseTermYears ? parseInt(leaseTermYears) : undefined
        }),
      });
      alert("Tạo tòa nhà mới thành công!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      alert(error.message || "Không thể tạo tòa nhà.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Location Selection Screen
  // ---------------------------------------------------------------------------
  if (selecting !== "none") {
    let list: LocationItem[] = [];
    let title = "";
    let onSelect = (item: LocationItem) => {};

    if (selecting === "province") { list = provinces; title = "Chọn Tỉnh/TP"; onSelect = handleProvinceSelect; }
    if (selecting === "district") { list = districts; title = "Chọn Khu vực"; onSelect = handleDistrictSelect; }
    if (selecting === "ward") { list = wards; title = "Chọn Phường/Xã"; onSelect = handleWardSelect; }

    const filteredList = list
      .filter((item) => item.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
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
            {filteredList.map((item) => (
              <button
                key={item.id}
                className="w-full px-4 py-4 text-left border-b hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(item)}
              >
                {item.full_name}
              </button>
            ))}
            {list.length > 0 && filteredList.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Không tìm thấy kết quả phù hợp
              </div>
            )}
            {list.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Vui lòng chọn cấp độ trước đó
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------------------------------------------------------------------------
  // Wizard Screens
  // ---------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md md:max-w-4xl lg:max-w-5xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 flex flex-col overflow-hidden bg-background">
        <DialogTitle className="sr-only">Thêm nhà mới</DialogTitle>
        <DialogDescription className="sr-only">Quy trình tạo tòa nhà</DialogDescription>
        
        {/* Header */}
        <div className="flex items-center px-4 h-14 bg-background">
          <button onClick={() => {
            if (step > 1) setStep(step - 1);
            else onOpenChange(false);
          }} className="p-2 -ml-2 text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="text-lg font-semibold mx-auto -translate-x-3">Thêm nhà mới</h2>
        </div>

        {/* Stepper */}
        <div className="bg-background pt-2 pb-4">
          <div className="flex items-center justify-between px-8 relative">
            <div className="absolute top-1.5 left-12 right-12 h-1 bg-muted -z-0"></div>
            
            <div className="flex flex-col items-center z-10 gap-2">
              <div className={`w-3.5 h-3.5 rounded-full ${step >= 1 ? 'bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end' : 'bg-muted'}`}></div>
              <span className={`text-xs ${step === 1 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>Cơ bản</span>
            </div>
            
            <div className="flex flex-col items-center z-10 gap-2">
              <div className={`w-3.5 h-3.5 rounded-full ${step >= 2 ? 'bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end' : 'bg-muted'}`}></div>
              <span className={`text-xs ${step === 2 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>Bổ sung</span>
            </div>
            
            <div className="flex flex-col items-center z-10 gap-2">
              <div className={`w-3.5 h-3.5 rounded-full ${step >= 3 ? 'bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end' : 'bg-muted'}`}></div>
              <span className={`text-xs ${step === 3 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>Tạo phòng</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pb-24">
          {step === 1 && (
            <div className="p-4 md:p-6 space-y-6">
              <p className="text-sm text-muted-foreground px-1">Nhập thông tin cơ bản (bắt buộc)</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 items-start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-foreground">Tên nhà <span className="text-red-500">*</span></Label>
                    <Input 
                      placeholder="Nhập tên nhà" 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-foreground">Địa chỉ <span className="text-red-500">*</span></Label>
                    <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
                      <button 
                        className="w-full flex items-center justify-between p-4 border-b border-border"
                        onClick={() => setSelecting("province")}
                      >
                        <span className="text-sm text-muted-foreground">Tỉnh/TP</span>
                        <div className="flex items-center text-primary">
                          <span className="text-sm font-medium mr-1">{province || "Chọn Tỉnh/TP"}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                      
                      <button 
                        className="w-full flex items-center justify-between p-4 border-b border-border"
                        onClick={() => setSelecting("district")}
                      >
                        <span className="text-sm text-muted-foreground">Khu vực</span>
                        <div className="flex items-center text-primary">
                          <span className="text-sm font-medium mr-1">{district || "Chọn Khu vực"}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                      
                      <button 
                        className="w-full flex items-center justify-between p-4"
                        onClick={() => setSelecting("ward")}
                      >
                        <span className="text-sm text-muted-foreground">Phường/Xã</span>
                        <div className="flex items-center text-primary">
                          <span className="text-sm font-medium mr-1">{ward || "Chọn Phường/Xã"}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-normal text-foreground">Địa chỉ cụ thể <span className="text-red-500">*</span></Label>
                    <Input 
                      placeholder="Số nhà, tên đường" 
                      value={address} 
                      onChange={e => setAddress(e.target.value)}
                      className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {currentUserRole === "ADMIN" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Chủ nhà <span className="text-red-500">*</span></Label>
                      <div className="bg-background rounded-xl border border-border overflow-hidden">
                        <div className="p-2 border-b border-border bg-muted/50">
                          <Input 
                            placeholder="Tìm chủ nhà (tên, sđt)..." 
                            value={ownerSearch}
                            onChange={(e) => setOwnerSearch(e.target.value)}
                            className="h-9 bg-background"
                          />
                        </div>
                        <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                          {filteredOwners.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Chưa có chủ nhà nào phù hợp</p>
                          ) : (
                            filteredOwners.map(o => (
                              <label key={o.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={ownerIds.includes(o.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setOwnerIds([...ownerIds, o.id]);
                                    else setOwnerIds(ownerIds.filter(id => id !== o.id));
                                  }}
                                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                                />
                                <span className="text-sm">{o.name} - {o.phone}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-foreground">Quản lý tòa nhà</Label>
                    <div className="bg-background rounded-xl border border-border overflow-hidden">
                      <div className="p-2 border-b border-border bg-muted/50">
                        <Input 
                          placeholder="Tìm quản lý (tên, sđt)..." 
                          value={managerSearch}
                          onChange={(e) => setManagerSearch(e.target.value)}
                          className="h-9 bg-background"
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
                                checked={managerIds.includes(m.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setManagerIds([...managerIds, m.id]);
                                  else setManagerIds(managerIds.filter(id => id !== m.id));
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
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t border-dashed">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Ngày bắt đầu thầu</Label>
                      <Input 
                        type="date"
                        value={leaseStartDate} 
                        onChange={e => setLeaseStartDate(e.target.value)}
                        className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Thời hạn thầu (năm)</Label>
                      <Input 
                        type="number"
                        min={1}
                        value={leaseTermYears} 
                        onChange={e => setLeaseTermYears(e.target.value)}
                        className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-4 md:p-6 space-y-6">
              <p className="text-sm text-muted-foreground px-1">Nhập thông tin bổ sung</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 items-start">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Số tầng <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        min={1}
                        value={floorCount} 
                        onChange={e => setFloorCount(e.target.value)}
                        className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Phòng / tầng <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        min={1}
                        value={roomsPerFloor} 
                        onChange={e => setRoomsPerFloor(e.target.value)}
                        className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Diện tích (m²) <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        min={1}
                        value={defaultArea} 
                        onChange={e => setDefaultArea(e.target.value)}
                        className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Loại nhà <span className="text-red-500">*</span></Label>
                      <Select value={buildingType} onValueChange={(v) => setBuildingType(v || "Nhà trọ")}>
                        <SelectTrigger className="w-full h-12 bg-background border-border shadow-sm rounded-xl">
                          <SelectValue>{buildingType}</SelectValue>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectItem value="Nhà trọ">Nhà trọ</SelectItem>
                          <SelectItem value="Chung cư mini">Chung cư mini</SelectItem>
                          <SelectItem value="Chung cư">Chung cư</SelectItem>
                          <SelectItem value="Căn hộ dịch vụ">Căn hộ dịch vụ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-foreground">Giá thuê mặc định / tháng <span className="text-red-500">*</span></Label>
                    <Input 
                      value={defaultRent} 
                      onChange={e => setDefaultRent(formatCurrency(e.target.value))}
                      className="h-12 bg-background border-border shadow-sm rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Ngày thanh toán <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        value={paymentDeadlineDate} 
                        onChange={e => setPaymentDeadlineDate(e.target.value)}
                        className={`h-12 bg-background shadow-sm rounded-xl ${
                          paymentDeadlineDate && (parseInt(paymentDeadlineDate) > 28 || parseInt(paymentDeadlineDate) < 1 || paymentDeadlineDate === invoiceClosingDate) 
                            ? 'border-red-500' : 'border-border'
                        }`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-foreground">Ngày chốt số <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number"
                        value={invoiceClosingDate} 
                        onChange={e => setInvoiceClosingDate(e.target.value)}
                        className={`h-12 bg-background shadow-sm rounded-xl ${
                          invoiceClosingDate && (parseInt(invoiceClosingDate) > 28 || parseInt(invoiceClosingDate) < 1) 
                            ? 'border-red-500' : 'border-border'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-foreground">Mô tả thêm</Label>
                    <textarea 
                      placeholder="Nhập mô tả về nhà trọ..."
                      value={description} 
                      onChange={e => setDescription(e.target.value)}
                      className="w-full min-h-[100px] p-3 text-sm bg-background border border-border shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>



                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-foreground">Mã QR Thanh toán chung</Label>
                    {paymentQrCode ? (
                      <div className="relative inline-block border border-border rounded-lg p-2 bg-background">
                        <img src={paymentQrCode} alt="QR Code" className="max-h-32 object-contain" />
                        <button onClick={() => setPaymentQrCode("")} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input type="file" id="upload-qr" className="hidden" accept="image/*" onChange={handleFileUpload} />
                        <label htmlFor="upload-qr" className="cursor-pointer inline-flex items-center justify-center w-full h-12 px-4 rounded-xl border border-dashed border-input bg-background text-sm font-medium hover:bg-accent">
                          <Upload className="w-4 h-4 mr-2" /> Tải ảnh QR
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Chi phí */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-foreground">Chi phí mặc định</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddFee} className="h-8 rounded-lg text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Thêm
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {fees.map((fee, index) => (
                        <div key={fee.id} className="flex gap-2 items-start p-3 bg-muted/30 rounded-xl border border-border">
                          <div className="flex-1 space-y-2">
                            {index > 1 ? (
                              <Input 
                                placeholder="Tên phí (VD: Rác)" 
                                value={fee.name} 
                                onChange={e => handleFeeChange(fee.id, "name", e.target.value)}
                                className="h-10 bg-background"
                              />
                            ) : (
                              <div className="h-10 px-3 flex items-center bg-muted/50 rounded-md text-sm font-medium">{fee.name}</div>
                            )}
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Giá tiền" 
                                value={fee.unit_price} 
                                onChange={e => handleFeeChange(fee.id, "unit_price", formatCurrency(e.target.value))}
                                className="h-10 bg-background flex-1"
                              />
                              <Select 
                                value={fee.type} 
                                onValueChange={v => handleFeeChange(fee.id, "type", v)}
                                disabled={fee.id === "dien"}
                              >
                                <SelectTrigger className="h-10 w-[110px] bg-background">
                                  <SelectValue>{fee.type === "CONSUMPTION" ? "Phát sinh" : fee.type === "FIXED" ? "Cố định" : "Theo người"}</SelectValue>
                                </SelectTrigger>
                                <SelectContent alignItemWithTrigger={false}>
                                  <SelectItem value="CONSUMPTION">Phát sinh</SelectItem>
                                  <SelectItem value="FIXED">Cố định</SelectItem>
                                  <SelectItem value="PER_CAPITA">Theo người</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {index > 1 && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500" onClick={() => handleRemoveFee(fee.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Phân khúc phòng */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-foreground">Phân khúc / Loại phòng</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddRoomClass} className="h-8 rounded-lg text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Thêm
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {roomClasses.map((rc) => (
                        <div key={rc.id} className="flex gap-2 items-start p-3 bg-muted/30 rounded-xl border border-border">
                          <div className="flex-1 space-y-2">
                            <Input 
                              placeholder="Tên loại phòng" 
                              value={rc.name} 
                              onChange={e => handleRoomClassChange(rc.id, "name", e.target.value)}
                              className="h-10 bg-background"
                            />
                            <Input 
                              placeholder="Giá thuê mặc định" 
                              value={rc.default_base_rent} 
                              onChange={e => handleRoomClassChange(rc.id, "default_base_rent", formatCurrency(e.target.value))}
                              className="h-10 bg-background"
                            />
                          </div>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500" onClick={() => handleRemoveRoomClass(rc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && !editingRoom && (
            <div className="p-4 space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground px-1">Danh sách phòng</p>
                <div className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-md">
                  Tổng: {generatedFloors.reduce((acc, f) => acc + f.rooms.length, 0)} phòng
                </div>
              </div>

              <div className="space-y-6">
                {generatedFloors.map(floor => (
                  <div key={floor.id} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h4 className="font-semibold text-foreground">Tầng {floor.floor_number}</h4>
                      <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary hover:bg-primary/5" onClick={() => handleAddRoom(floor.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Thêm phòng
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {floor.rooms.map(room => (
                        <div 
                          key={room.id} 
                          onClick={() => setEditingRoom({ floorId: floor.id, room })}
                          className="bg-background border border-border rounded-xl p-3 shadow-sm cursor-pointer hover:border-primary/50 transition-all flex flex-col items-center justify-center relative group"
                        >
                          <span className="font-semibold text-foreground">{room.name}</span>
                          <span className="text-xs font-medium text-muted-foreground mt-1">{formatCurrency(room.base_rent.toString())}</span>
                          <span className="text-xs text-muted-foreground">{room.area} m²</span>
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center">
                            <span className="text-xs font-medium text-primary bg-background/90 px-2 py-1 rounded-md shadow-sm">Chỉnh sửa</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 3 && editingRoom && (
            <div className="flex flex-col h-full bg-muted absolute inset-0 z-20">
              {/* Header */}
              <div className="bg-background px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => setEditingRoom(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold text-foreground">Cấu hình {editingRoom.room.name}</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 items-start">
                  <div className="bg-background rounded-xl p-5 border border-border space-y-4 shadow-sm">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal text-foreground">Tên phòng</Label>
                      <Input 
                        value={editingRoom?.room.name || ""} 
                        onChange={e => handleUpdateRoom({ name: e.target.value })}
                        className="h-11 bg-background border-border"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal text-foreground">Loại phòng</Label>
                      <Select 
                        value={editingRoom?.room.room_class_id || "none"}
                        onValueChange={(val) => {
                          const safeVal = val || "";
                          if (safeVal === "none" || safeVal === "") {
                            handleUpdateRoom({ room_class_id: "" });
                          } else {
                            const rc = roomClasses.find(c => c.id === safeVal);
                            if (rc && rc.default_base_rent) {
                              handleUpdateRoom({ 
                                room_class_id: safeVal, 
                                base_rent: parseInt(rc.default_base_rent.replace(/\D/g, "") || "0") 
                              });
                            } else {
                              handleUpdateRoom({ room_class_id: safeVal });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-11 bg-background border-border">
                          <SelectValue placeholder="Chọn loại phòng">
                            {editingRoom?.room.room_class_id && editingRoom.room.room_class_id !== ""
                              ? roomClasses.find(c => c.id === editingRoom.room.room_class_id)?.name || "Không có loại phòng"
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
                          value={editingRoom ? formatCurrency(editingRoom.room.base_rent.toString()) : ""} 
                          onChange={e => handleUpdateRoom({ base_rent: parseInt(e.target.value.replace(/\D/g, "") || "0") })}
                          className="h-11 bg-background border-border"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-normal text-foreground">Diện tích (m²)</Label>
                        <Input 
                          type="number"
                          value={editingRoom?.room.area || ""} 
                          onChange={e => handleUpdateRoom({ area: parseInt(e.target.value || "0") })}
                          className="h-11 bg-background border-border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-background rounded-xl p-5 border border-border shadow-sm">
                    <Label className="text-base font-semibold text-foreground mb-4 block">Thiết lập giá dịch vụ riêng</Label>
                    <div className="space-y-4">
                      {fees.map((fee) => {
                        const subs = editingRoom?.room.service_subscriptions || [];
                        const sub = subs.find((s: any) => s.fee_id === fee.id);
                        let isActive = true;
                        if (editingRoom?.room.service_subscriptions) {
                           isActive = !!sub;
                        }

                        const overridePriceStr = sub?.override_price !== null && sub?.override_price !== undefined 
                          ? sub.override_price.toString() 
                          : "";

                        return (
                          <div key={fee.id} className="flex flex-col gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{fee.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Mặc định: {formatCurrency(fee.unit_price.toString())} đ
                                </p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={isActive}
                                  onChange={(e) => {
                                    handleUpdateRoomService(fee.id, e.target.checked, overridePriceStr);
                                  }}
                                />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-primary-gradient-start peer-checked:to-primary-gradient-end"></div>
                              </label>
                            </div>
                            
                            {isActive && (
                              <div className="flex flex-col gap-1.5 mt-1 border-t border-border pt-3">
                                <Label className="text-xs text-foreground">Giá thu riêng</Label>
                                <Input 
                                  placeholder="Dùng giá mặc định" 
                                  value={overridePriceStr ? formatCurrency(overridePriceStr) : ""} 
                                  onChange={e => handleUpdateRoomService(fee.id, true, e.target.value)}
                                  className="h-10 bg-background border-border"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Custom Room-Specific Fees */}
                      {editingRoom?.room.service_subscriptions?.filter((s: any) => s.fee_id.startsWith("custom_")).map((sub: any) => (
                        <div key={sub.fee_id} className="flex flex-col gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 mr-4">
                              <Input 
                                value={sub.name || ""} 
                                onChange={e => {
                                  const newSubs = editingRoom.room.service_subscriptions?.map((s: any) => s.fee_id === sub.fee_id ? { ...s, name: e.target.value } : s) || [];
                                  handleUpdateRoom({ service_subscriptions: newSubs });
                                }}
                                placeholder="Tên phí (VD: Rác)" 
                                className="h-9 w-full text-sm font-medium bg-background" 
                              />
                            </div>
                            <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => {
                                const newSubs = editingRoom.room.service_subscriptions?.filter((s: any) => s.fee_id !== sub.fee_id) || [];
                                handleUpdateRoom({ service_subscriptions: newSubs });
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
                                const newSubs = editingRoom.room.service_subscriptions?.map((s: any) => 
                                  s.fee_id === sub.fee_id ? { ...s, override_price: numericStr ? parseInt(numericStr) : null } : s
                                ) || [];
                                handleUpdateRoom({ service_subscriptions: newSubs });
                              }}
                              className="h-10 bg-background"
                            />
                          </div>
                        </div>
                      ))}

                      <Button variant="outline" className="w-full border-dashed" onClick={() => {
                        let currentSubs = editingRoom?.room.service_subscriptions || [];
                        const newSubs = [...currentSubs, {
                          fee_id: `custom_${Date.now()}`,
                          name: "",
                          type: "FIXED",
                          override_price: null
                        }];
                        handleUpdateRoom({ service_subscriptions: newSubs });
                      }}>
                        <Plus className="h-4 w-4 mr-2" /> Thêm phụ phí riêng
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-background border-t border-border flex gap-3 absolute bottom-0 left-0 w-full z-10">
                <Button variant="outline" className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 h-12" onClick={handleDeleteRoom}>
                  <Trash2 className="h-4 w-4 mr-2" /> Xoá phòng
                </Button>
                <Button className="flex-1 h-12" onClick={() => setEditingRoom(null)}>
                  Lưu & Quay lại
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action */}
        {!editingRoom && (
          <div className="absolute bottom-0 left-0 w-full p-4 bg-background border-t">
            <Button 
              className="w-full h-12 rounded-xl text-base font-semibold"
              disabled={loading || (step === 1 && (!name || !province || !district || !ward || !address))}
              onClick={handleSubmit}
            >
              {step < 3 ? "Tiếp theo" : "Hoàn thành"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
