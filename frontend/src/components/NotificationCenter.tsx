"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { apiFetch } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  data?: {
    ticket_id?: string;
    contract_id?: string;
    url?: string;
  };
}

export function NotificationCenter() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Notification[]>("/api/notifications");
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const handleNotificationClick = (noti: Notification) => {
    if (!noti.is_read) {
      markAsRead(noti.id);
    }
    
    if (noti.data?.ticket_id) {
      router.push(`/tickets/${noti.data.ticket_id}`);
    } else if (noti.data?.url) {
      router.push(noti.data.url);
    }
  };

  return (
    <Popover onOpenChange={(open) => open && fetchNotifications()}>
      <PopoverTrigger
        render={
          <button className="relative cursor-pointer text-muted-foreground hover:text-foreground transition-colors p-2 outline-none">
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent align="end" className="w-[320px] sm:w-[380px] p-0 rounded-2xl shadow-xl border-muted/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">Thông báo</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
              className="text-xs h-8 px-2 text-primary hover:text-primary hover:bg-primary/5"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Đọc tất cả
            </Button>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="h-10 w-10 opacity-20 mb-2" />
              <p className="text-sm">Không có thông báo nào</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((noti) => (
                <div
                  key={noti.id}
                  onClick={() => handleNotificationClick(noti)}
                  className={`flex flex-col gap-1 p-4 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors relative ${!noti.is_read ? 'bg-primary/5' : ''}`}
                >
                  {!noti.is_read && (
                    <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full" />
                  )}
                  <p className={`text-sm font-bold pr-4 ${!noti.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {noti.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {noti.content}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(noti.created_at), { addSuffix: true, locale: vi })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
