"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const userStr = localStorage.getItem("user");
    if (!userStr) {
      router.replace("/login");
      return;
    }

    const user = JSON.parse(userStr);
    switch (user.role) {
      case "ADMIN":
      case "OWNER":
      case "MANAGER":
        router.replace("/dashboard");
        break;
      case "TECHNICIAN":
        router.replace("/tickets");
        break;
      default:
        router.replace("/login");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Building2 className="h-10 w-10 text-primary" />
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );
}
