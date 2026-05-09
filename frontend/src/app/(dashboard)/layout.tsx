"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Receipt, 
  Wrench, 
  LogOut, 
  Menu,
  Home,
  X,
  UserCircle,
  Bell,
  Settings,
  ChevronRight,
  ArrowLeft,
  Search,
  FileSignature,
  ClipboardType,
  Sun,
  Moon,
  BarChart3,
  Banknote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PushNotificationHandler } from "@/components/PushNotificationHandler";
import { NotificationCenter } from "@/components/NotificationCenter";

const navItems = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "OWNER"] },
  { href: "/admin/users", label: "Người dùng", icon: Users, roles: ["ADMIN"] },
  { href: "/buildings", label: "Nhà", icon: Building2, roles: ["ADMIN", "MANAGER", "OWNER"] },
  { href: "/rooms", label: "Phòng", icon: Home, roles: ["ADMIN", "MANAGER", "OWNER"] },
  { href: "/tenants", label: "Khách thuê", icon: Users, roles: ["ADMIN", "MANAGER"] },
  { href: "/contracts", label: "Hợp đồng", icon: FileSignature, roles: ["ADMIN", "MANAGER"] },
  { href: "/meter-readings", label: "Chốt số", icon: ClipboardType, roles: ["ADMIN", "MANAGER"] },
  { href: "/billing", label: "Hóa đơn", icon: Receipt, roles: ["ADMIN", "MANAGER"] },
  { href: "/tickets", label: "Công việc", icon: Wrench, roles: ["ADMIN", "MANAGER", "TECHNICIAN"] },
  { href: "/transactions", label: "Thu chi", icon: Banknote, roles: ["ADMIN", "MANAGER", "OWNER"] },
  { href: "/reports", label: "Thống kê", icon: BarChart3, roles: ["ADMIN", "OWNER"] },
];

const BrandLogo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <Building2 className="h-7 w-7 text-primary shrink-0" />
    <div className="flex flex-col text-left">
      <span className="text-sm font-bold tracking-wide text-primary leading-snug">
        Quản lý & Vận hành 29LAND
      </span>
      <span className="text-[8px] font-bold text-muted-foreground/80 mt-0.5 uppercase tracking-widest">
        by Hoàng Dũng
      </span>
    </div>
  </div>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (!token || !storedUser) {
      router.push("/login");
      return;
    }
    
    try {
      setUser(JSON.parse(storedUser));
    } catch {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) return null; // or loading skeleton

  if (user.role === "TECHNICIAN") {
    const isRoot = pathname === "/tickets";
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <PushNotificationHandler />
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-2 sm:px-4">
          <div className="flex items-center gap-1 sm:gap-2">
            {!isRoot && (
              <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")} className="mr-1">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <BrandLogo />
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Chế độ giao diện">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive" title="Đăng xuất">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-5xl mx-auto">
          {children}
        </main>
      </div>
    );
  }

  const NavLinks = ({ onClick }: { onClick?: () => void }) => {
    const filteredItems = navItems.filter(item => item.roles.includes(user.role));
    return (
      <>
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
              isActive 
                ? "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-primary-foreground" 
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
};

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 md:flex-row md:h-screen md:overflow-hidden">
      <PushNotificationHandler />
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex shrink-0">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
          <Link href="/dashboard" className="flex items-center">
            <BrandLogo />
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid items-start px-2 text-sm font-medium gap-1">
            <NavLinks />
          </nav>
        </div>
        <div className="mt-auto border-t p-4">
          <div className="flex items-center gap-3 mb-4">
            <UserCircle className="h-10 w-10 text-muted-foreground" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Menu */}
      {pathname === "/dashboard" ? (
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center">
            <BrandLogo />
          </Link>
          <div className="flex items-center">
            <NotificationCenter />
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-2 md:hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              // If it's a top-level menu item, go to dashboard
              if (navItems.some(item => item.href === pathname)) {
                router.push("/dashboard");
              } else {
                // Otherwise go up one level
                const segments = pathname.split('/').filter(Boolean);
                segments.pop();
                if (segments.length === 0) {
                  router.push("/dashboard");
                } else {
                  router.push("/" + segments.join("/"));
                }
              }
            }} 
            className="mr-2"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <span className="font-bold text-lg text-primary flex-1 text-center">
            {pathname === "/tickets/new" ? "Tạo phiếu công việc" 
            : pathname === "/reports" ? "Thống kê & Báo cáo" 
            : navItems.find(item => pathname.startsWith(item.href) && item.href !== "/dashboard")?.label || "Chi tiết"}
          </span>
          <div className="w-10"></div> {/* Spacer to keep title centered */}
        </header>
      )}

      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Slide-out Drawer */}
          <div className="fixed top-0 right-0 z-50 h-full w-[85%] max-w-[320px] bg-background shadow-2xl md:hidden flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold text-lg text-primary">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="p-4 border-b bg-muted/10">
              <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-4 group">
                <div className="bg-primary/10 p-2 rounded-full group-hover:bg-primary/20 transition-colors">
                  <UserCircle className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold uppercase">{user.name}</p>
                  {/* <p className="text-sm text-primary font-medium flex items-center gap-1 mt-0.5 group-hover:underline">
                    Hồ sơ người dùng <ChevronRight className="h-3 w-3" />
                  </p> */}
                </div>
              </Link>
            </div>

            <nav className="p-4 grid gap-1">
              <div className="grid gap-1">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                  className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-foreground hover:bg-accent transition-colors"
                >
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-base">Cài đặt</span>
                  <ChevronRight className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isSettingsOpen && mounted && (
                  <div className="px-4 py-3 ml-4 border-l-2 border-muted grid gap-2 animate-in slide-in-from-top-2">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Chế độ giao diện</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant={theme === 'light' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setTheme('light')}
                      >
                        Sáng
                      </Button>
                      <Button 
                        variant={theme === 'dark' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setTheme('dark')}
                      >
                        Tối
                      </Button>
                      <Button 
                        variant={theme === 'system' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setTheme('system')}
                      >
                        Hệ thống
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <button onClick={handleLogout} className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-destructive hover:bg-destructive/10 transition-colors mt-2">
                <LogOut className="h-5 w-5" />
                <span className="font-medium text-base">Đăng xuất</span>
              </button>
            </nav>
            
            <div className="mt-auto p-4 text-center text-xs text-muted-foreground">
              v1.0.0 (29LAND by Hoàng Dũng)
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto ${pathname === '/dashboard' ? 'p-0' : 'p-4 md:p-6 lg:p-8'}`}>
        {children}
      </main>
    </div>
  );
}
