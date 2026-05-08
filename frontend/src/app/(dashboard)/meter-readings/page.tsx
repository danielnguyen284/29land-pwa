"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";

interface Building {
  id: string;
  name: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  fee_configs?: any[];
}

interface Room {
  id: string;
  name: string;
  status: "EMPTY" | "DEPOSITED" | "OCCUPIED";
  service_subscriptions?: any[];
}

import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Info, FileText } from "lucide-react";
import { toast } from "sonner";

interface ConsumptionRecord {
  id: string;
  room_id: string;
  fee_id: string;
  billing_period: string;
  start_index: number;
  end_index: number;
  usage_amount: number;
}

interface FeeConfig {
  id: string;
  name: string;
  type: string;
  unit_price: number;
}

export default function MeterReadingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  
  // Default to current month
  const [billingPeriod, setBillingPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable data state
  const [inputData, setInputData] = useState<Record<string, { start_index: string | number; end_index: string | number }>>({});

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      const data = await apiFetch<{ data: Building[] }>("/api/buildings?limit=1000");
      setBuildings(data.data || []);
      if (data.data && data.data.length > 0) {
        setSelectedBuildingId(data.data[0].id);
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải danh sách tòa nhà");
    }
  };

  useEffect(() => {
    if (selectedBuildingId && billingPeriod) {
      fetchData();
    }
  }, [selectedBuildingId, billingPeriod]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Calculate previous period (YYYY-MM)
      const [year, month] = billingPeriod.split("-").map(Number);
      let prevYear = year;
      let prevMonth = month - 1;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

      // Fetch rooms
      const roomsData = await apiFetch<{ data: Room[] }>(`/api/rooms?building_id=${selectedBuildingId}&limit=1000`);
      const occupiedRooms = (roomsData.data || []).filter((r: Room) => r.status === "OCCUPIED");
      setRooms(occupiedRooms);

      // Fetch existing consumptions for current and previous period
      const consData = await apiFetch<ConsumptionRecord[]>(
        `/api/buildings/${selectedBuildingId}/consumption?period=${billingPeriod}`
      );
      const prevConsData = await apiFetch<ConsumptionRecord[]>(
        `/api/buildings/${selectedBuildingId}/consumption?period=${prevPeriod}`
      );
      
      setConsumptions(consData || []);

      // Initialize input data
      const initialInput: Record<string, { start_index: string | number; end_index: string | number }> = {};
      
      const building = buildings.find(b => b.id === selectedBuildingId);
      if (building && building.fee_configs && roomsData.data) {
        const consumptionFees = building.fee_configs.filter((f: any) => f.type === "CONSUMPTION");
        
        occupiedRooms.forEach((room: Room) => {
          if (!room.service_subscriptions) return;
          
          consumptionFees.forEach((fee: any) => {
            const hasSub = room.service_subscriptions?.find((sub: any) => sub.fee_id === fee.id);
            if (hasSub) {
              const key = `${room.id}_${fee.id}`;
              const existing = consData?.find((c) => c.room_id === room.id && c.fee_id === fee.id);
              const prevExisting = prevConsData?.find((c) => c.room_id === room.id && c.fee_id === fee.id);
              
              initialInput[key] = {
                start_index: existing ? existing.start_index : (prevExisting ? prevExisting.end_index : 0),
                end_index: existing ? existing.end_index : (prevExisting ? prevExisting.end_index : 0),
              };
            }
          });
        });
      }
      
      setInputData(initialInput);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBuilding = useMemo(() => buildings.find((b) => b.id === selectedBuildingId), [buildings, selectedBuildingId]);
  
  const consumptionFees = useMemo(() => {
    if (!selectedBuilding || !selectedBuilding.fee_configs) return [];
    return selectedBuilding.fee_configs.filter((f: any) => f.type === "CONSUMPTION");
  }, [selectedBuilding]);

  const handleInputChange = (roomId: string, feeId: string, field: "start_index" | "end_index", value: string) => {
    const key = `${roomId}_${feeId}`;
    
    setInputData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleSaveAll = async (skipToast = false) => {
    if (!selectedBuildingId || !billingPeriod) return;
    
    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    const promises = Object.entries(inputData).map(async ([key, data]) => {
      const splitIndex = key.indexOf("_");
      const roomId = key.substring(0, splitIndex);
      const feeId = key.substring(splitIndex + 1);
      
      const startVal = Number(data.start_index) || 0;
      const endVal = Number(data.end_index) || 0;

      // Skip if usage is negative
      if (endVal < startVal) {
        errorCount++;
        return;
      }

      // Only save if there's a difference or it's > 0
      try {
        await apiFetch(`/api/rooms/${roomId}/consumption`, {
          method: "POST",
          body: JSON.stringify({
            fee_id: feeId,
            billing_period: billingPeriod,
            start_index: startVal,
            end_index: endVal,
          }),
        });
        successCount++;
      } catch (err) {
        errorCount++;
      }
    });

    await Promise.all(promises);

    setIsSaving(false);
    
    if (!skipToast) {
      if (errorCount > 0) {
        toast.warning(`Đã lưu ${successCount} chỉ số. Có ${errorCount} chỉ số lỗi (thường do chỉ số cuối < chỉ số đầu).`);
      } else if (successCount > 0) {
        toast.success(`Đã lưu thành công ${successCount} chỉ số`);
      } else {
        toast.info("Không có dữ liệu hợp lệ nào để lưu");
      }
    }

    // Refresh
    if (!skipToast) fetchData();
  };

  const handleGenerateInvoices = async () => {
    if (!selectedBuildingId || !billingPeriod) return;
    
    setIsSaving(true);
    
    // Save readings first
    await handleSaveAll(true);
    
    try {
      const res = await apiFetch<{ message: string; count: number }>(`/api/buildings/${selectedBuildingId}/generate-invoices`, {
        method: "POST",
        body: JSON.stringify({ billing_period: billingPeriod }),
      });
      toast.success(res.message || `Đã tạo ${res.count} hóa đơn thành công`);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tạo hóa đơn");
    } finally {
      setIsSaving(false);
      fetchData(); // Refresh UI after generating
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Tòa nhà</label>
          <SearchableSelect
            options={buildings.map((b) => {
              const fullAddress = [b.address, b.ward].filter(Boolean).join(", ") || "Chưa có địa chỉ";
              return {
                value: b.id,
                label: `${b.name} - ${fullAddress}`,
                displayLabel: b.name,
              };
            })}
            value={selectedBuildingId}
            onValueChange={setSelectedBuildingId}
            placeholder="Chọn nhà..."
            searchPlaceholder="Tìm kiếm nhà..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Kỳ hóa đơn</label>
          <Input 
            type="month" 
            value={billingPeriod} 
            onChange={(e) => setBillingPeriod(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Danh sách phòng</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedBuildingId ? (
            <div className="text-center p-8 text-muted-foreground">
              Vui lòng chọn nhà để xem danh sách phòng
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Tòa nhà này chưa có phòng nào
            </div>
          ) : consumptionFees.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
              <Info className="h-8 w-8 mb-2 opacity-50" />
              <p>Tòa nhà này không có cấu hình phí nào thuộc loại &quot;Theo mức tiêu thụ&quot;.</p>
              <p className="text-sm">Vui lòng vào phần Quản lý Tòa nhà để thêm phí Điện/Nước.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Phòng</TableHead>
                    <TableHead className="w-[100px]">Trạng thái</TableHead>
                    {consumptionFees.map((fee: FeeConfig, index: number) => (
                      <TableHead key={fee.id || `fee-${index}`} className="min-w-[280px]">
                        {fee.name} ({fee.unit_price.toLocaleString()} đ / đơn vị)
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room, roomIndex) => (
                    <TableRow key={room.id || `room-${roomIndex}`}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          room.status === "OCCUPIED" ? "default" :
                          room.status === "DEPOSITED" ? "secondary" : "outline"
                        }>
                          {room.status === "OCCUPIED" ? "Đang thuê" :
                           room.status === "DEPOSITED" ? "Đã cọc" : "Trống"}
                        </Badge>
                      </TableCell>
                      
                      {consumptionFees.map((fee: FeeConfig, index: number) => {
                        const hasSub = room.service_subscriptions?.find((s: any) => s.fee_id === fee.id);
                        const key = `${room.id}_${fee.id}`;
                        const data = inputData[key];
                        
                        if (!hasSub || !data) {
                          return (
                            <TableCell key={fee.id || `fee-${index}`} className="text-muted-foreground text-sm italic">
                              Không sử dụng
                            </TableCell>
                          );
                        }

                        const startVal = Number(data.start_index) || 0;
                        const endVal = Number(data.end_index) || 0;
                        const usage = endVal - startVal;
                        const isError = usage < 0;

                        return (
                          <TableCell key={fee.id || `fee-${index}`}>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1 w-[80px]">
                                <span className="text-xs text-muted-foreground">Số cũ</span>
                                <Input 
                                  type="number" 
                                  className="h-8 bg-muted"
                                  value={data.start_index === 0 && data.start_index.toString() === "0" ? "" : data.start_index}
                                  onChange={(e) => handleInputChange(room.id, fee.id, "start_index", e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1 w-[80px]">
                                <span className="text-xs text-muted-foreground">Số mới</span>
                                <Input 
                                  type="number" 
                                  className={`h-8 ${isError ? 'border-red-500' : 'border-primary'}`}
                                  value={data.end_index === 0 && data.end_index.toString() === "0" ? "" : data.end_index}
                                  onChange={(e) => handleInputChange(room.id, fee.id, "end_index", e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1 w-[60px] ml-2">
                                <span className="text-xs text-muted-foreground">Tiêu thụ</span>
                                <span className={`font-semibold ${isError ? 'text-red-500' : 'text-primary'}`}>
                                  {usage}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Desktop Action Footer */}
      <div className="hidden md:flex justify-end gap-3">
        <Button onClick={handleGenerateInvoices} disabled={isSaving || isLoading} variant="outline" className="w-[180px]">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Chốt & Tạo hóa đơn
        </Button>
        <Button onClick={() => handleSaveAll()} disabled={isSaving || isLoading || Object.keys(inputData).length === 0} className="w-[150px]">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Lưu tất cả
        </Button>
      </div>
      
      {/* Mobile Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden flex flex-col gap-2 shadow-lg z-10 pb-6">
        <Button onClick={handleGenerateInvoices} disabled={isSaving || isLoading} variant="outline" className="w-full">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Chốt & Tạo hóa đơn
        </Button>
        <Button onClick={() => handleSaveAll()} disabled={isSaving || isLoading || Object.keys(inputData).length === 0} className="w-full">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Lưu tất cả
        </Button>
      </div>
    </div>
  );
}
