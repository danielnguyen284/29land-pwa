"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface AccompanyingTenant {
  id?: string;
  mode: "existing" | "new";
  name: string;
  phone: string;
  cccd: string;
}

interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  cccd: string | null;
}

interface AccompanyingTenantsSectionProps {
  buildingId: string;
  tenants: AccompanyingTenant[];
  onChange: (tenants: AccompanyingTenant[]) => void;
  excludeIds?: string[];
}

export function AccompanyingTenantsSection({
  buildingId,
  tenants,
  onChange,
  excludeIds = [],
}: AccompanyingTenantsSectionProps) {
  const [inactiveTenants, setInactiveTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (buildingId) {
      fetchInactiveTenants();
    }
  }, [buildingId]);

  const fetchInactiveTenants = async () => {
    setLoading(true);
    try {
      // Fetch inactive tenants for this building
      const res = await apiFetch<{ data: any[] }>(`/api/tenants?status=INACTIVE&building_id=${buildingId}&limit=1000`);
      setInactiveTenants(res.data);
    } catch (err) {
      console.error("Fetch inactive tenants error:", err);
    } finally {
      setLoading(false);
    }
  };

  const addTenant = () => {
    onChange([...tenants, { mode: "new", name: "", phone: "", cccd: "" }]);
  };

  const removeTenant = (index: number) => {
    const newTenants = [...tenants];
    newTenants.splice(index, 1);
    onChange(newTenants);
  };

  const updateTenant = (index: number, data: Partial<AccompanyingTenant>) => {
    const newTenants = [...tenants];
    newTenants[index] = { ...newTenants[index], ...data };
    onChange(newTenants);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Khách thuê đi kèm</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addTenant}
          className="h-8 border-primary text-primary hover:bg-primary/5"
        >
          <Plus className="w-4 h-4 mr-1" />
          Thêm khách
        </Button>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/5">
          <p className="text-sm">Chưa có khách đi kèm nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant, idx) => (
            <div key={idx} className="p-4 border rounded-xl bg-background/50 space-y-4 relative">
              <button
                type="button"
                onClick={() => removeTenant(idx)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex bg-muted p-1 rounded-lg w-fit">
                <button 
                  type="button" 
                  onClick={() => updateTenant(idx, { mode: "new", id: undefined, name: "", phone: "", cccd: "" })}
                  className={`px-3 py-1 text-[10px] font-medium rounded-md ${tenant.mode === "new" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
                >
                  Nhập tay
                </button>
                <button 
                  type="button" 
                  onClick={() => updateTenant(idx, { mode: "existing", id: undefined, name: "", phone: "", cccd: "" })}
                  className={`px-3 py-1 text-[10px] font-medium rounded-md ${tenant.mode === "existing" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
                >
                  Khách cũ
                </button>
              </div>

              {tenant.mode === "existing" ? (
                <SearchableSelect
                  options={inactiveTenants
                    .filter(t => !excludeIds.includes(t.id) && !tenants.some((at, atIdx) => atIdx !== idx && at.id === t.id))
                    .map((t) => ({
                      value: t.id,
                      label: `${t.name}${t.phone ? ` - ${t.phone}` : ""}`,
                    }))}
                  value={tenant.id || ""}
                  onValueChange={(v) => {
                    const t = inactiveTenants.find(it => it.id === v);
                    if (t) {
                      updateTenant(idx, { 
                        id: t.id, 
                        name: t.name, 
                        phone: t.phone || "", 
                        cccd: t.cccd || "" 
                      });
                    }
                  }}
                  placeholder="Chọn khách cũ của tòa nhà"
                  searchPlaceholder="Tìm kiếm khách thuê cũ..."
                  emptyMessage="Không tìm thấy khách thuê cũ."
                />
              ) : (
                <div className="grid gap-3">
                  <Input 
                    placeholder="Họ và tên" 
                    value={tenant.name} 
                    onChange={e => updateTenant(idx, { name: e.target.value })} 
                    className="h-9"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      placeholder="Số điện thoại" 
                      value={tenant.phone} 
                      onChange={e => updateTenant(idx, { phone: e.target.value })} 
                      className="h-9"
                    />
                    <Input 
                      placeholder="CCCD/CMND" 
                      value={tenant.cccd} 
                      onChange={e => updateTenant(idx, { cccd: e.target.value })} 
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
