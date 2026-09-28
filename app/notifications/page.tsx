"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Notification {
  id: string;
  user_email: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "";
      setUserEmail(email);

      // Fetch user role
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("email", email)
        .single();

      const role = (userData as any)?.role || null;
      setUserRole(role);

      // Fetch notifications
      const { data: notificationsData } = await supabase
        .from("assignment_notifications")
        .select("*")
        .eq("user_email", email)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifications((notificationsData ?? []) as Notification[]);
      setLoading(false);
    } catch (err: any) {
      console.error("Fetch notifications error:", err);
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [router]);

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.is_read) {
      router.push(notification.link);
      return;
    }

    try {
      const supabase = createBrowserClient();

      // Mark as read
      await (supabase.from("assignment_notifications") as any)
        .update({ is_read: true })
        .eq("id", notification.id);

      // Navigate to link
      router.push(notification.link);
    } catch (err: any) {
      console.error("Mark notification error:", err);
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("assignment_notifications") as any)
        .update({ is_read: true })
        .eq("user_email", userEmail)
        .eq("is_read", false);

      // Reload notifications
      await fetchNotifications();
    } catch (err: any) {
      console.error("Mark all as read error:", err);
      setError("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading notifications...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="card text-center">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="page-heading">Notifications</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="btn-secondary mt-4 md:mt-0"
            >
              {markingAll ? "Marking..." : "Mark All as Read"}
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="card text-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-gray-300 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p className="text-gray-500 font-poppins">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`card cursor-pointer hover:shadow-md transition-all ${
                  !notification.is_read ? "bg-blue-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-poppins text-college-text mb-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
