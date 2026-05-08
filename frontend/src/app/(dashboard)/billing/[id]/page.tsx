"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { toJpeg } from "html-to-image";
import { AlertCircle, CheckCircle, Image as ImageIcon, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
interface Building {
  id: string;
  name: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  payment_qr_code?: string;
  owner?: {
    payment_qr_code?: string;
  };
}

interface InvoiceItem {
  id: string;
  fee_id: string | null;
  description: string;
  amount: string;
}

interface InvoiceDetail {
  id: string;
  room_id: string;
  contract_id: string;
  billing_period: string;
  issue_date: string;
  rent_amount: string;
  rolling_balance: string;
  total_amount: string;
  paid_amount: string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  room?: {
    id: string;
    name: string;
    floor?: {
      building?: Building;
    }
  };
  contract?: {
    id: string;
    representative_tenant_id: string;
  };
  items?: InvoiceItem[];
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  useEffect(() => {
    fetchInvoice();
  }, [unwrappedParams.id]);

  const fetchInvoice = async () => {
    try {
      const data = await apiFetch<InvoiceDetail>(`/api/invoices/${unwrappedParams.id}`);
      setInvoice(data);
      setPaymentAmount(data.paid_amount);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải hóa đơn");
      router.push("/billing");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!invoice) return;
    
    setIsSaving(true);
    try {
      const res = await apiFetch<InvoiceDetail>(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paid_amount: parseFloat(paymentAmount) })
      });
      
      toast.success("Cập nhật thanh toán thành công");
      setInvoice({ ...invoice, paid_amount: res.paid_amount, status: res.status });
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi cập nhật thanh toán");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImage = async () => {
    const cardElement = document.getElementById("export-invoice-card");
    if (!cardElement) return;

    try {
      toast.info("Đang tạo ảnh hóa đơn...");
      const dataUrl = await toJpeg(cardElement, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      
      const link = document.createElement("a");
      link.href = dataUrl;
      const roomName = invoice?.room?.name || "Phong";
      const period = formatPeriod(invoice?.billing_period).replace('/', '-');
      link.download = `Hoa_don_${roomName}_${period}.jpg`;
      link.click();
      toast.success("Đã tải ảnh hóa đơn");
    } catch (error) {
      console.error(error);
      toast.error("Không thể tạo ảnh hóa đơn");
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(amount));
  };

  const formatPeriod = (period?: string) => {
    if (!period) return "";
    const [year, month] = period.split("-");
    return `${month}/${year}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3"/> Đã thanh toán đủ</Badge>;
      case "PARTIAL":
        return <Badge variant="secondary" className="text-orange-600 bg-orange-100 border-orange-200"><AlertCircle className="mr-1 h-3 w-3"/> Thu thiếu (Một phần)</Badge>;
      default:
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3"/> Chưa thanh toán</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) return null;

  const remainingAmount = Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount));
  const building = invoice.room?.floor?.building;
  const qrCodeUrl = building?.payment_qr_code || building?.owner?.payment_qr_code;

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-4xl mx-auto">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={handleDownloadImage}>
          <ImageIcon className="mr-2 h-4 w-4" />
          Tải ảnh hóa đơn
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Invoice Card (Printable) */}
        <Card className="md:col-span-2 shadow-sm border-2 print:border-none print:shadow-none" id="invoice-card">
          <CardHeader className="border-b bg-muted/20 pb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">HÓA ĐƠN TIỀN NHÀ</h1>
                <p className="text-muted-foreground mt-1">
                  Kỳ hóa đơn: <span className="font-semibold text-foreground">{formatPeriod(invoice.billing_period)}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Trạng thái</div>
                {getStatusBadge(invoice.status)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Thông tin phòng</p>
                <p className="font-semibold text-lg">{invoice.room?.name || "N/A"}</p>
                <p className="text-sm text-muted-foreground">{building?.name}</p>
                <p className="text-sm text-muted-foreground">{building?.address}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Mã hóa đơn</p>
                <p className="font-mono text-sm">{invoice.id.split('-')[0].toUpperCase()}</p>
                <p className="text-sm text-muted-foreground mt-2 mb-1">Ngày lập</p>
                <p className="text-sm">{formatDate(invoice.issue_date)}</p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60%]">Nội dung</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items?.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium whitespace-pre-wrap">{item.description}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {Number(invoice.rolling_balance) !== 0 && (
                  <TableRow>
                    <TableCell className="font-medium italic">
                      {Number(invoice.rolling_balance) > 0 ? "Nợ cũ chuyển sang" : "Tiền thừa tháng trước"}
                    </TableCell>
                    <TableCell className="text-right italic">
                      {formatCurrency(invoice.rolling_balance)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            <div className="mt-8 space-y-3 bg-muted/10 p-4 rounded-lg border">
              <div className="flex justify-between items-center text-lg">
                <span className="font-medium">Tổng cộng:</span>
                <span className="font-bold text-xl">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Đã thanh toán:</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.paid_amount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold text-primary">Số tiền cần thanh toán:</span>
                <span className="font-bold text-2xl text-red-600">{formatCurrency(remainingAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Actions (Hidden on print) */}
        <div className="space-y-6 print:hidden">
          {/* Payment QR Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Mã QR Thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {qrCodeUrl ? (
                <div className="bg-background p-2 rounded-lg border shadow-sm">
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code thanh toán" 
                    className="w-48 h-48 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-muted flex items-center justify-center rounded-lg border border-dashed">
                  <span className="text-sm text-muted-foreground text-center px-4">Chưa cài đặt mã QR cho nhà này</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Khách thuê quét mã QR trên để chuyển khoản số tiền: <br/>
                <strong className="text-foreground text-base">{formatCurrency(remainingAmount)}</strong>
              </p>
            </CardContent>
          </Card>

          {/* Update Payment Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Cập nhật thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Số tiền khách đã trả (VNĐ)</label>
                <Input 
                  type="number" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ví dụ: 5000000"
                />
              </div>
              
              <Button 
                onClick={handleUpdatePayment} 
                disabled={isSaving || paymentAmount === invoice.paid_amount?.toString()} 
                className="w-full"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Lưu thanh toán
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Export-Only Invoice Template (Hidden from screen but readable by html-to-image) */}
      <div className="absolute left-[-9999px] top-0" style={{ zIndex: -9999 }}>
        <div 
          id="export-invoice-card" 
          className="bg-white flex flex-row w-[1200px] min-h-[630px] h-fit font-sans text-slate-800"
        >
          {/* Left Side: Invoice Details (65%) */}
          <div className="w-[65%] p-10 flex flex-col bg-slate-50/50 border-r border-slate-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-[#16a34a] mb-2 uppercase tracking-wide">HÓA ĐƠN TIỀN NHÀ</h1>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Kỳ hóa đơn:</span>
                  <span className="bg-[#16a34a]/10 text-[#16a34a] px-3 py-1 rounded-full font-semibold">{formatPeriod(invoice.billing_period)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500 mb-1 uppercase font-semibold">Phòng</div>
                <div className="text-3xl font-bold text-slate-800">{invoice.room?.name || "N/A"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6 bg-white p-5 rounded-xl shadow-sm border border-slate-100">
              <div>
                <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Khu vực / Tòa nhà</div>
                <div className="font-medium text-slate-800 text-lg">{building?.name}</div>
                <div className="text-slate-500 text-sm">{building?.address}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Mã & Ngày lập</div>
                <div className="font-medium text-slate-800 font-mono">{invoice.id.split('-')[0].toUpperCase()}</div>
                <div className="text-slate-500 text-sm">{formatDate(invoice.issue_date)}</div>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Nội dung</th>
                    <th className="px-6 py-4 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items?.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-slate-700 whitespace-pre-wrap">{item.description}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {Number(invoice.rolling_balance) !== 0 && (
                    <tr>
                      <td className="px-6 py-4 text-slate-500 italic">
                        {Number(invoice.rolling_balance) > 0 ? "Nợ cũ chuyển sang" : "Tiền thừa tháng trước"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-500 italic">
                        {formatCurrency(invoice.rolling_balance)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="mt-auto bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                 <span className="font-semibold text-slate-600">Tổng cộng:</span>
                 <span className="font-bold text-xl text-slate-900">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Payment Info & QR (35%) */}
          <div className="w-[35%] p-10 flex flex-col items-center justify-center bg-[#f8fafc] relative">
            <div className="w-full flex flex-col items-center">
              <div className="text-center w-full mb-8">
                <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-2">Tổng Cần Thanh Toán</div>
                <div className="text-4xl font-bold text-red-600 tracking-tight">
                  {formatCurrency(remainingAmount)}
                </div>
              </div>

              {remainingAmount > 0 && qrCodeUrl ? (
                <div className="flex flex-col items-center w-full">
                  <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-sm mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeUrl} alt="Mã QR" className="w-56 h-56 object-contain rounded-xl" crossOrigin="anonymous" />
                  </div>
                  <div className="bg-[#16a34a]/5 border border-[#16a34a]/20 text-[#16a34a] px-4 py-3 rounded-lg w-full text-center">
                    <span className="font-medium text-sm">Quét mã QR để thanh toán</span>
                  </div>
                </div>
              ) : remainingAmount === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="h-32 w-32 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-16 w-16 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">Đã Thanh Toán Đủ</div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 text-slate-500 p-6 rounded-xl text-center w-full">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                  <p>Chưa cài mã QR</p>
                  <p className="text-sm mt-1">Vui lòng chuyển khoản cho chủ nhà</p>
                </div>
              )}
            </div>

            <div className="absolute bottom-6 text-center text-xs text-slate-400 w-full left-0">
              <p>Hóa đơn được tạo bởi hệ thống quản lý 29LAND</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
