"use client";

import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";

interface NavbarProps {
  userEmail: string;
}

export default function Navbar({ userEmail }: NavbarProps) {
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

  return (
    <nav className="bg-white border-b border-college-peach shadow-sm h-[70px] px-8 flex items-center justify-between">
      {/* Left side - Logo and text */}
      <div className="flex items-center gap-3">
        <Image
          src="/photos/college-logo.png"
          width={52}
          height={52}
          alt="MGM University SOET"
          className="object-contain"
        />
        <div className="flex flex-col">
          <span className="font-poppins font-bold text-college-accent text-base leading-tight">
            MGM University
          </span>
          <span className="font-poppins text-xs text-college-secondary leading-tight">
            School of Engineering & Technology
          </span>
        </div>
      </div>

      {/* Center navigation links */}
      <div className="hidden md:flex items-center gap-6">
        <Link
          href="/dashboard"
          className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/upload"
          className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors"
        >
          Upload Document
        </Link>
        <Link
          href="/audit"
          className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors"
        >
          Audit Trail
        </Link>
        <Link
          href="/analytics"
          className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors"
        >
          Analytics
        </Link>
      </div>

      {/* Right side - User email and logout */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 font-poppins hidden sm:inline">
          {userEmail}
        </span>
        <button onClick={handleLogout} className="btn-danger">
          Logout
        </button>
      </div>
    </nav>
  );
}
