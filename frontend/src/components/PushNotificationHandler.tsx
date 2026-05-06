"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationHandler() {
  const hasSubscribed = useRef(false);

  useEffect(() => {
    async function subscribeToPush() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return; // Push not supported
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
          if (!publicVapidKey) {
            console.error("Missing NEXT_PUBLIC_VAPID_KEY");
            return;
          }

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
          });
        }

        // Send to backend
        await apiFetch("/notifications/subscribe", {
          method: "POST",
          body: JSON.stringify(subscription)
        });

      } catch (error) {
        console.error("Failed to subscribe to push notifications:", error);
      }
    }

    if (!hasSubscribed.current) {
      if (Notification.permission === "granted") {
        hasSubscribed.current = true;
        subscribeToPush();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            hasSubscribed.current = true;
            subscribeToPush();
            toast.success("Đã bật thông báo", {
              description: "Bạn sẽ nhận được thông báo khi có phiếu sửa chữa mới.",
            });
          }
        });
      }
    }
  }, []);

  return null;
}
