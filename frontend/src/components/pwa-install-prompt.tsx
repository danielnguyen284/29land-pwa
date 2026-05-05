"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Share, PlusSquare, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Define the BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    const isAppStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsStandalone(isAppStandalone);

    if (isAppStandalone) {
      return;
    }

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt for Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Optionally delay showing the prompt so it's not too aggressive
      setTimeout(() => {
        const hasDismissed = localStorage.getItem("pwa-prompt-dismissed");
        if (!hasDismissed) {
          setShowPrompt(true);
        }
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If it's iOS and not standalone, show prompt after a delay
    if (isIOSDevice && !isAppStandalone) {
      setTimeout(() => {
        const hasDismissed = localStorage.getItem("pwa-prompt-dismissed");
        if (!hasDismissed) {
          setShowPrompt(true);
        }
      }, 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      setShowPrompt(false);
    } else if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
        setShowPrompt(false);
      } else {
        console.log("User dismissed the install prompt");
      }
      // We've used the prompt, and can't use it again, throw it away
      setDeferredPrompt(null);
    } else {
      // Fallback for browsers that don't support beforeinstallprompt but aren't iOS (e.g. some Android browsers)
      alert("Để cài đặt, hãy tìm tùy chọn 'Thêm vào màn hình chính' trong menu của trình duyệt.");
      setShowPrompt(false);
    }
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {showPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-background border border-border shadow-lg shadow-black/10 rounded-xl p-4 flex items-center justify-between gap-4 max-w-md mx-auto relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Download className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <p className="font-semibold text-[15px] leading-tight">Cài đặt 29LAND</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">Dùng như App gốc trên máy</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleInstallClick} className="font-medium rounded-full px-4 shadow-sm h-9">
                Tải App
              </Button>
              <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cài đặt 29LAND trên iOS</DialogTitle>
            <DialogDescription>
              Thêm ứng dụng vào màn hình chính để có trải nghiệm tốt nhất (toàn màn hình, mượt mà hơn).
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-6 py-4">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-semibold text-sm">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Nhấn vào nút Chia sẻ</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Nhấn vào biểu tượng <Share className="w-4 h-4 inline mx-1" /> ở thanh công cụ dưới cùng của Safari.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-semibold text-sm">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Thêm vào MH chính</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cuộn xuống và chọn <strong className="text-foreground">Thêm vào MH chính</strong> <PlusSquare className="w-4 h-4 inline mx-1" /> (Add to Home Screen).
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => setShowIOSInstructions(false)}>
              Đã hiểu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
