"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";

interface NavbarProps {
  userEmail: string;
  userRole?: string | null;
}

interface SearchResults {
  documents: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    type: string;
  }>;
}

export default function Navbar({ userEmail, userRole }: NavbarProps) {
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResults>({
    documents: [],
    assignments: [],
  });
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('edusphere-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

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

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await response.json();
          setResults(data);
          setShowDropdown(true);
        } catch (error) {
          console.error("Search error:", error);
          setResults({ documents: [], assignments: [] });
        }
      } else {
        setShowDropdown(false);
        setResults({ documents: [], assignments: [] });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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

  const handleResultClick = (path: string) => {
    setSearchQuery("");
    setShowDropdown(false);
    router.push(path);
  };

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('edusphere-theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('edusphere-theme', 'dark');
      setIsDark(true);
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "badge-draft";
      case "pending":
        return "badge-pending";
      case "approved":
        return "badge-approved";
      case "rejected":
        return "bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold";
      default:
        return "badge-draft";
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

      {/* Center - Search box and navigation links */}
      <div className="flex-1 flex items-center gap-4 overflow-hidden">
        {/* Search Input */}
        <div ref={searchRef} className="max-w-xs w-full relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, assignments..."
            className="w-full px-3 py-1.5 text-sm border-2 border-college-peach rounded-lg font-poppins focus:outline-none focus:border-college-secondary"
          />

          {/* Search Dropdown */}
          {showDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-college-peach rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {results.documents && results.documents.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 px-3 pt-2 font-poppins">
                    Documents
                  </div>
                  {results.documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleResultClick(`/documents/${doc.id}`)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-college-bg cursor-pointer"
                    >
                      <span className="text-sm text-college-text font-poppins flex-1 truncate">
                        {doc.title}
                      </span>
                      <span className={getBadgeClass(doc.status)}>
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {results.assignments && results.assignments.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 px-3 pt-2 font-poppins">
                    Assignments
                  </div>
                  {results.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      onClick={() => handleResultClick(`/assignments/${assignment.id}`)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-college-bg cursor-pointer"
                    >
                      <span className="text-sm text-college-text font-poppins flex-1 truncate">
                        {assignment.title}
                      </span>
                      {assignment.type && (
                        <span className="text-xs text-gray-400 font-poppins">
                          {assignment.type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 &&
                (!results.documents || results.documents.length === 0) &&
                (!results.assignments || results.assignments.length === 0) && (
                  <div className="text-sm text-gray-400 p-3 font-poppins">
                    No matches found.
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Navigation links with horizontal scroll */}
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
          {(userRole === "hod" || userRole === "coe" || userRole === "principal") && (
            <Link
              href="/my-approvals"
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
            >
              My Approvals
            </Link>
          )}
          <Link
            href="/assignments"
            className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
          >
            Assignments
          </Link>
          <Link
            href="/deadlines"
            className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
          >
            Deadlines
          </Link>
          <Link
            href="/leaderboard"
            className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
          >
            Leaderboard
          </Link>
          <Link
            href="/digest"
            className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
          >
            This Week
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
        <button
          onClick={toggleDarkMode}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 rounded-full border border-college-peach flex items-center justify-center text-base hover:bg-college-peach transition-colors"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
        <button onClick={handleLogout} className="btn-danger whitespace-nowrap">
          Logout
        </button>
      </div>
    </nav>
  );
}
