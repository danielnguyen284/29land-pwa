"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, subMonths, startOfMonth } from "date-fns";
import { vi } from "date-fns/locale";
import { 
  Loader2, Plus, AlertCircle, Banknote, Calendar, 
  Settings2, ImagePlus, X, Trash2, Edit, Camera, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { Transaction, TransactionCategory } from "@/lib/types";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadFiles } from "../../../lib/upload";

const formatCompactCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

const formatInputAmount = (val: string) => {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseInputAmount = (val: string) => {
  return val.replace(/\D/g, "");
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string; address?: string; ward?: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; floor: { building_id: string } }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  const [filterBuilding, setFilterBuilding] = useState<string>("ALL");
  const [filterPeriod, setFilterPeriod] = useState<string>(format(new Date(), "yyyy-MM"));

  // Dialogs
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);

  // Category Form
  const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  // Transaction Form
  const [txBuildingId, setTxBuildingId] = useState("");
  const [txRoomId, setTxRoomId] = useState<string>("ALL");
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txPeriod, setTxPeriod] = useState(format(new Date(), "yyyy-MM"));
  const [txDesc, setTxDesc] = useState("");
  
  // Photos
  const [invoicePhotoUrls, setInvoicePhotoUrls] = useState<string[]>([]);
  const [productPhotoUrls, setProductPhotoUrls] = useState<string[]>([]);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUserRole(JSON.parse(storedUser).role);
      } catch (e) {}
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filterBuilding, filterPeriod]);

  const fetchInitialData = async () => {
    try {
      const bRes = await apiFetch<{data: {id: string; name: string; address?: string; ward?: string}[]}>("/api/buildings?limit=1000");
      setBuildings(bRes.data);
      const rRes = await apiFetch<{data: {id: string; name: string; floor: { building_id: string }}[]}>("/api/rooms?limit=10000");
      setRooms(rRes.data);
      if (bRes.data.length > 0) {
        setTxBuildingId(bRes.data[0].id);
      }
      await fetchCategories();
    } catch (err) {
      toast.error("Lỗi tải dữ liệu cơ sở");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch<TransactionCategory[]>("/api/transactions/categories");
      setCategories(res);
    } catch (err) {
      toast.error("Lỗi tải danh mục");
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let url = `/api/transactions?period=${filterPeriod}`;
      if (filterBuilding !== "ALL") {
        url += `&building_id=${filterBuilding}`;
      }
      const res = await apiFetch<Transaction[]>(url);
      setTransactions(res);
    } catch (err) {
      toast.error("Lỗi tải giao dịch");
    } finally {
      setLoading(false);
    }
  };

  // Category Handlers
  const handleSaveCategory = async () => {
    if (!catName || !catType) return toast.error("Vui lòng điền đủ thông tin danh mục");
    try {
      if (editingCategory) {
        await apiFetch(`/api/transactions/categories/${editingCategory.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: catName, type: catType }),
        });
        toast.success("Cập nhật danh mục thành công");
      } else {
        await apiFetch("/api/transactions/categories", {
          method: "POST",
          body: JSON.stringify({ name: catName, type: catType }),
        });
        toast.success("Thêm danh mục thành công");
      }
      setCatName("");
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu danh mục");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa danh mục này?")) return;
    try {
      await apiFetch(`/api/transactions/categories/${id}`, { method: "DELETE" });
      toast.success("Đã xóa danh mục");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa danh mục");
    }
  };

  // Transaction Handlers
  const handleOpenNewTransaction = () => {
    setTxBuildingId(buildings[0]?.id || "");
    setTxRoomId("ALL");
    setTxType("EXPENSE");
    setTxCategoryId("");
    setTxAmount("");
    setTxPeriod(format(new Date(), "yyyy-MM"));
    setTxDesc("");
    setInvoicePhotoUrls([]);
    setProductPhotoUrls([]);
    setIsTransactionDialogOpen(true);
  };

  const handleUploadInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingInvoice(true);
    try {
      const urls = await uploadFiles(Array.from(files));
      setInvoicePhotoUrls(prev => [...prev, ...urls]);
    } catch (err) {
      toast.error("Lỗi upload ảnh hóa đơn");
    } finally {
      setIsUploadingInvoice(false);
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    }
  };

  const handleUploadProduct = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingProduct(true);
    try {
      const urls = await uploadFiles(Array.from(files));
      setProductPhotoUrls(prev => [...prev, ...urls]);
    } catch (err) {
      toast.error("Lỗi upload ảnh sản phẩm");
    } finally {
      setIsUploadingProduct(false);
      if (productInputRef.current) productInputRef.current.value = "";
    }
  };

  const handleSaveTransaction = async () => {
    if (!txBuildingId || !txAmount || !txPeriod) {
      return toast.error("Vui lòng điền đủ thông tin bắt buộc");
    }

    setIsSubmitting(true);
    try {
      const body = {
        building_id: txBuildingId,
        room_id: txRoomId === "ALL" ? null : txRoomId,
        category_id: txCategoryId || null,
        amount: Number(parseInputAmount(txAmount)),
        type: txType,
        accounting_period: txPeriod,
        description: txDesc,
        invoice_photos: invoicePhotoUrls,
        product_photos: productPhotoUrls
      };

      await apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast.success("Đã thêm khoản thu/chi");
      setIsTransactionDialogOpen(false);
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu giao dịch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa giao dịch này? Số liệu thống kê sẽ bị ảnh hưởng.")) return;
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      toast.success("Đã xóa giao dịch");
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa giao dịch");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-140px)]">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 my-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full md:w-auto flex-1 max-w-xl">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Toà nhà</Label>
            <SearchableSelect
              options={[
                { value: "ALL", label: "Tất cả nhà" },
                ...buildings.map(b => {
                  const fullAddress = [b.address, b.ward].filter(Boolean).join(", ") || "Chưa có địa chỉ";
                  return { value: b.id, label: `${b.name} - ${fullAddress}`, displayLabel: b.name };
                })
              ]}
              value={filterBuilding}
              onValueChange={v => setFilterBuilding(v || "ALL")}
              placeholder="Tất cả nhà"
              className="bg-background rounded-xl h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Kỳ kế toán</Label>
            <Select value={filterPeriod} onValueChange={v => v && setFilterPeriod(v)}>
              <SelectTrigger className="bg-background rounded-xl h-10">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Tháng {format(new Date(filterPeriod + "-01"), "MM/yyyy")}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 12 + i);
                  const val = format(d, "yyyy-MM");
                  return <SelectItem key={val} value={val}>Tháng {format(d, "MM/yyyy")}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="rounded-xl flex-1 md:flex-none" onClick={() => setIsCategoryDialogOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Danh mục
          </Button>
          <Button 
            className="rounded-xl flex-1 md:flex-none bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end" 
            onClick={handleOpenNewTransaction}
          >
            <Plus className="w-4 h-4 mr-2" />
            Thêm khoản
          </Button>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 h-[40vh] border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground gap-3">
          <Banknote className="h-12 w-12 opacity-20" />
          <p className="font-medium">Chưa có khoản thu/chi nào trong kỳ này</p>
        </div>
      ) : (
        <Card className="rounded-2xl border-none shadow-sm overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Toà / Phòng</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Người tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(tr => (
                  <TableRow key={tr.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(tr.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{tr.building?.name || "N/A"}</div>
                      {tr.room && <div className="text-xs text-muted-foreground">P.{tr.room.name}</div>}
                    </TableCell>
                    <TableCell>
                      {tr.category?.name || (tr.type === "INCOME" ? "Khoản thu khác" : "Chi phí khác")}
                      {tr.description && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{tr.description}</div>}
                    </TableCell>
                    <TableCell>
                      {tr.type === "INCOME" 
                        ? <span className="text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded text-xs">Thu</span>
                        : <span className="text-rose-600 font-medium bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded text-xs">Chi</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {tr.type === "INCOME" ? "+" : "-"}{formatCompactCurrency(tr.amount)}
                    </TableCell>
                    <TableCell className="text-sm">{tr.creator?.name || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTransaction(tr.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <DialogTitle>Quản lý Danh mục Thu/Chi</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/30 p-3 rounded-xl">
              <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                <div className="flex-1 w-full">
                  <Input 
                    placeholder="Tên danh mục (Tiền điện, internet...)" 
                    value={catName} 
                    onChange={e => setCatName(e.target.value)} 
                    className="h-9"
                  />
                </div>
                <div className="w-full sm:w-[130px]">
                  <Select value={catType} onValueChange={(v) => setCatType(v as "INCOME" | "EXPENSE")}>
                    <SelectTrigger className="h-9">
                      <SelectValue>
                        {catType === "EXPENSE" ? "Khoản Chi" : "Khoản Thu"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">Khoản Chi</SelectItem>
                      <SelectItem value="INCOME">Khoản Thu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 shrink-0">
                  {editingCategory && (
                    <Button variant="outline" size="sm" className="h-9" onClick={() => { setEditingCategory(null); setCatName(""); }}>Hủy</Button>
                  )}
                  <Button size="sm" className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveCategory}>Lưu</Button>
                </div>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên danh mục</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(cat => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>
                        {cat.type === "INCOME" 
                          ? <span className="text-emerald-600 font-medium text-xs">Thu</span>
                          : <span className="text-rose-600 font-medium text-xs">Chi</span>
                        }
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingCategory(cat);
                          setCatName(cat.name);
                          setCatType(cat.type);
                        }}>
                          <Edit className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Form Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-2xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 flex flex-col overflow-hidden bg-background [&>button]:hidden">
          <DialogTitle className="sr-only">Tạo khoản Thu / Chi</DialogTitle>
          <div className="flex items-center px-4 h-14 border-b shrink-0 bg-background">
            <button onClick={() => setIsTransactionDialogOpen(false)} className="p-2 -ml-2 text-foreground sm:hidden">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-semibold mx-auto sm:mx-0">Tạo khoản Thu / Chi</h2>
            <div className="w-10 h-10 sm:hidden" /> {/* Placeholder to balance the back button on mobile */}
          </div>
          <div className="p-6 space-y-6 overflow-y-auto flex-1 pb-24 sm:pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Toà nhà</Label>
                <SearchableSelect
                  options={buildings.map(b => {
                    const fullAddress = [b.address, b.ward].filter(Boolean).join(", ") || "Chưa có địa chỉ";
                    return { value: b.id, label: `${b.name} - ${fullAddress}`, displayLabel: b.name };
                  })}
                  value={txBuildingId}
                  onValueChange={v => { setTxBuildingId(v || ""); setTxRoomId("ALL"); }}
                  placeholder="Chọn toà nhà"
                />
              </div>
              <div className="space-y-2">
                <Label>Phòng (Tuỳ chọn)</Label>
                <SearchableSelect
                  options={[
                    { value: "ALL", label: "Áp dụng chung", displayLabel: "Áp dụng chung" },
                    ...rooms.filter(r => r.floor.building_id === txBuildingId).map(r => ({ value: r.id, label: `Phòng ${r.name}`, displayLabel: `Phòng ${r.name}` }))
                  ]}
                  value={txRoomId}
                  onValueChange={v => setTxRoomId(v || "ALL")}
                  placeholder="Phòng (Tuỳ chọn)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Loại giao dịch</Label>
                <Select value={txType} onValueChange={(v) => { setTxType(v as "INCOME" | "EXPENSE"); setTxCategoryId(""); }}>
                  <SelectTrigger>
                    <SelectValue>
                      {txType === "EXPENSE" ? "Khoản Chi" : "Khoản Thu"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Khoản Chi</SelectItem>
                    <SelectItem value="INCOME">Khoản Thu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Danh mục</Label>
                <Select value={txCategoryId} onValueChange={v => setTxCategoryId((v || "") === "OTHER" ? "" : (v || ""))}>
                  <SelectTrigger>
                    <SelectValue placeholder={txType === "INCOME" ? "Khoản thu khác" : "Chi phí khác"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OTHER">
                      {txType === "INCOME" ? "Khoản thu khác" : "Chi phí khác"}
                    </SelectItem>
                    {categories.filter(c => c.type === txType).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Số tiền</Label>
                <Input 
                  placeholder="0" 
                  value={txAmount} 
                  onChange={e => setTxAmount(formatInputAmount(e.target.value))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Kỳ kế toán</Label>
                <Select value={txPeriod} onValueChange={v => v && setTxPeriod(v)}>
                  <SelectTrigger>
                    <SelectValue>
                      {txPeriod ? `Tháng ${format(new Date(txPeriod), "MM/yyyy")}` : "Chọn kỳ"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() - 2 + i);
                      const val = format(d, "yyyy-MM");
                      return <SelectItem key={val} value={val}>Tháng {format(d, "MM/yyyy")}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea placeholder="Chi tiết..." value={txDesc} onChange={e => setTxDesc(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Ảnh hóa đơn (Tuỳ chọn)</Label>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={() => invoiceInputRef.current?.click()} disabled={isUploadingInvoice}>
                    <ImagePlus className="w-4 h-4 mr-1" /> Thêm ảnh
                  </Button>
                </div>
                <input type="file" ref={invoiceInputRef} className="hidden" multiple accept="image/*" onChange={handleUploadInvoice} />
                
                {isUploadingInvoice && <p className="text-xs text-muted-foreground mb-2">Đang tải ảnh lên...</p>}
                
                {invoicePhotoUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {invoicePhotoUrls.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border group bg-muted">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full shadow-sm hover:bg-black/80 transition-colors z-10"
                          onClick={() => setInvoicePhotoUrls(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 rounded-xl border border-dashed border-muted-foreground/10 text-center">Chưa có ảnh hóa đơn</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Ảnh sản phẩm (Tuỳ chọn)</Label>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={() => productInputRef.current?.click()} disabled={isUploadingProduct}>
                    <ImagePlus className="w-4 h-4 mr-1" /> Thêm ảnh
                  </Button>
                </div>
                <input type="file" ref={productInputRef} className="hidden" multiple accept="image/*" onChange={handleUploadProduct} />
                
                {isUploadingProduct && <p className="text-xs text-muted-foreground mb-2">Đang tải ảnh lên...</p>}
                
                {productPhotoUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {productPhotoUrls.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border group bg-muted">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full shadow-sm hover:bg-black/80 transition-colors z-10"
                          onClick={() => setProductPhotoUrls(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 rounded-xl border border-dashed border-muted-foreground/10 text-center">Chưa có ảnh sản phẩm</p>
                )}
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full p-4 bg-background border-t">
            <Button 
              className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground hover:opacity-90 transition-opacity"
              disabled={isSubmitting}
              onClick={handleSaveTransaction}
            >
              {isSubmitting ? "Đang lưu..." : "Lưu giao dịch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
