"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  Building2,
  ClipboardList,
  Wrench,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { User } from "@/lib/types";

const ROLE_CONFIG = {
  ADMIN: { label: "Admin", variant: "default" as const, icon: Shield },
  OWNER: { label: "Chủ nhà", variant: "secondary" as const, icon: Building2 },
  MANAGER: { label: "Quản lý", variant: "outline" as const, icon: ClipboardList },
  TECHNICIAN: { label: "Kỹ thuật", variant: "outline" as const, icon: Wrench },
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<string>("OWNER");
  const [formPaymentQrCode, setFormPaymentQrCode] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch<User[]>("/api/users");
      setUsers(data);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormPassword("");
    setFormRole("OWNER");
    setFormPaymentQrCode(undefined);
    setShowPassword(false);
    setEditingUser(null);
    setError("");
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormPhone(user.phone);
    setFormPassword("");
    setFormRole(user.role);
    setFormPaymentQrCode(user.payment_qr_code);
    setShowPassword(false);
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      if (editingUser) {
        const body: Record<string, string> = { name: formName, phone: formPhone, role: formRole };
        if (formPassword) body.password = formPassword;
        if (formRole === "OWNER" && formPaymentQrCode) body.payment_qr_code = formPaymentQrCode;
        if (formRole === "OWNER" && !formPaymentQrCode) body.payment_qr_code = "";

        await apiFetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const body: Record<string, string> = {
          name: formName,
          phone: formPhone,
          password: formPassword,
          role: formRole,
        };
        if (formRole === "OWNER" && formPaymentQrCode) body.payment_qr_code = formPaymentQrCode;

        await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Bạn có chắc muốn xóa người dùng "${user.name}"?`)) return;
    try {
      await apiFetch(`/api/users/${user.id}`, { method: "DELETE" });
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi xóa người dùng");
    }
  };

  const totalPages = Math.ceil(users.length / itemsPerPage);
  const currentUsers = users.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto md:space-y-6 pb-24 md:pb-0 space-y-4">
      <div className="hidden md:flex items-center justify-between mb-4 md:mb-0">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold tracking-tight">Người dùng</h1>
          <p className="text-muted-foreground">
            Quản lý tài khoản và phân quyền hệ thống
          </p>
        </div>
        <Button className="hidden md:flex" onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" />
          Tạo tài khoản
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Chỉnh sửa người dùng" : "Tạo tài khoản mới"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-name">Họ tên</Label>
                <Input
                  id="form-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-phone">Số điện thoại</Label>
                <Input
                  id="form-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-password">
                  {editingUser ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
                </Label>
                <div className="relative">
                  <Input
                    id="form-password"
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required={!editingUser}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <Select disabled={editingUser?.role === "ADMIN"} value={formRole} onValueChange={(v) => { if (v) setFormRole(v); }}>
                  <SelectTrigger>
                    <SelectValue>
                      {formRole === "OWNER" ? "Chủ nhà" : formRole === "MANAGER" ? "Quản lý" : formRole === "TECHNICIAN" ? "Kỹ thuật viên" : formRole === "ADMIN" ? "Admin" : formRole}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Chủ nhà</SelectItem>
                    <SelectItem value="MANAGER">Quản lý</SelectItem>
                    <SelectItem value="TECHNICIAN">Kỹ thuật viên</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formRole === "OWNER" && (
                <div className="space-y-2">
                  <Label>Mã QR Thanh toán</Label>
                  {formPaymentQrCode ? (
                    <div className="relative inline-block border border-gray-200 rounded-lg p-2 mt-2">
                      <img src={formPaymentQrCode} alt="QR Code" className="max-h-32 object-contain" />
                      <button 
                        type="button"
                        onClick={() => setFormPaymentQrCode(undefined)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input 
                        type="file" 
                        id="upload-qr-user" 
                        className="hidden" 
                        accept="image/*"
                        onChange={async (e) => {
                          if (!e.target.files || e.target.files.length === 0) return;
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = async () => {
                            try {
                              setFormLoading(true);
                              const res = await apiFetch<{url: string}>("/api/upload", {
                                method: "POST",
                                body: JSON.stringify({ image: reader.result as string })
                              });
                              setFormPaymentQrCode(res.url);
                            } catch (err) {
                              alert("Lỗi tải ảnh lên");
                            } finally {
                              setFormLoading(false);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <label htmlFor="upload-qr-user" className="cursor-pointer inline-flex items-center justify-center w-full h-10 px-4 mt-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                        <Upload className="w-4 h-4 mr-2" />
                        Tải ảnh QR lên
                      </label>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={formLoading}>
                {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? "Cập nhật" : "Tạo tài khoản"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentUsers.map((user) => {
              const cfg = ROLE_CONFIG[user.role];
              const Icon = cfg.icon;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant} className="gap-1">
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.role !== "ADMIN" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Hiển thị {((currentPage - 1) * itemsPerPage) + 1} đến {Math.min(currentPage * itemsPerPage, users.length)} trong tổng số {users.length} người dùng
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Trước
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Sau <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-background border-t md:hidden z-20">
        <Button className="w-full rounded-xl py-6 text-base font-semibold" onClick={openCreate}>
          Tạo tài khoản
        </Button>
      </div>
    </div>
  );
}
