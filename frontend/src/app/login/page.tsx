"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Phone, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { LoginResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on role
      switch (data.user.role) {
        case "ADMIN":
        case "OWNER":
        case "MANAGER":
          router.push("/dashboard");
          break;
        case "TECHNICIAN":
          router.push("/tickets");
          break;
        default:
          router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-8 pt-8">
          <div className="flex items-center justify-center gap-4">
            <Building2 className="h-12 w-12 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <CardTitle className="text-2xl font-bold text-primary tracking-wide leading-snug">
                Quản lý & Vận hành 29LAND
              </CardTitle>
              <p className="text-xs font-semibold text-muted-foreground mt-1 uppercase tracking-widest">
                by Hoàng Dũng
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="phone" className="text-sm font-medium ml-1">Số điện thoại</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Nhập số điện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-12 h-12 bg-muted/30 border-muted-foreground/20 focus:border-primary/50"
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium ml-1">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-12 bg-muted/30 border-muted-foreground/20 focus:border-primary/50"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
