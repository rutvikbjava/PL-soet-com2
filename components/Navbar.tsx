"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";

interface NavbarProps {
  userEmail: string;
  userRole?: string | null;
}

export default function Navbar({ userEmail, userRole }: NavbarProps) {
  const [notificationCount, setNotificationCount] = useState<number>(0);

  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!userEmail) return;

      try {
        const supabase = createBrowserClient();
        const { data } = await supabase
          .from("assignment_notifications")
          .select("id")
          .eq("user_email", userEmail)
          .eq("is_read", false);

        setNotificationCount((data ?? []).length);
      } catch (error) {
        console.error("Error fetching notification count:", error);
      }
    };

    fetchNotificationCount();
  }, [userEmail]);

  const handleLogout = async () => {
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/login";
    }
  };

  const isStudent = userRole === "student";

  return (
    <nav className="bg-white border-b border-college-peach shadow-sm h-[70px] px-4 sm:px-8 flex items-center gap-4">
      {/* Left side - Logo and text */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Image
          src="/photos/college-logo.png"
          width={52}
          height={52}
          alt="MGM University SOET"
          className="object-contain"
        />
        <div className="hidden lg:flex flex-col">
          <span className="font-poppins font-bold text-college-accent text-base leading-tight">
            MGM University
          </span>
          <span className="font-poppins text-xs text-college-secondary leading-tight">
            School of Engineering & Technology
          </span>
        </div>
      </div>

      {/* Center navigation links with horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-college-peach scrollbar-track-transparent hover:scrollbar-thumb-college-secondary">
        <div className="flex items-center gap-4 lg:gap-6 min-w-max px-2">
          {!isStudent && (
            <Link
              href="/dashboard"
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/assignments"
            className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
          >
            Assignments
          </Link>
          {!isStudent && (
            <>
              <Link
                href="/upload"
                className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
              >
                Upload Document
              </Link>
              <Link
                href="/notices/create"
                className="bg-college-secondary text-white px-3 py-1 rounded-full text-sm font-poppins font-medium hover:bg-college-secondary-dark transition-colors whitespace-nowrap"
              >
                Create Notice
              </Link>
              <Link
                href="/audit"
                className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
              >
                Audit Trail
              </Link>
              <Link
                href="/analytics"
                className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
              >
                Analytics
              </Link>
              <Link
                href="/notice-board"
                className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
              >
                Notice Board
              </Link>
            </>
          )}
          {userRole === "faculty" && (
            <Link
              href="/assignments/analytics"
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
            >
              Assignment Analytics
            </Link>
          )}
        </div>
      </div>

      {/* Right side - Notifications, User email and logout */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <Link
          href="/notifications"
          className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors relative"
        >
          🔔 
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </Link>
        <span className="text-xs text-gray-500 font-poppins hidden xl:inline truncate max-w-[150px]">
          {userEmail}
        </span>
        <button onClick={handleLogout} className="btn-danger whitespace-nowrap">
          Logout
        </button>
      </div>
    </nav>
  );
}
