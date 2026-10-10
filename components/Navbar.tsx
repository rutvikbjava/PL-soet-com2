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
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDocumentsMenu, setShowDocumentsMenu] = useState<boolean>(false);
  const [showAssignmentsMenu, setShowAssignmentsMenu] = useState<boolean>(false);
  const [showAnalyticsMenu, setShowAnalyticsMenu] = useState<boolean>(false);
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const documentsMenuRef = useRef<HTMLDivElement>(null);
  const assignmentsMenuRef = useRef<HTMLDivElement>(null);
  const analyticsMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleNavMouseEnter = () => {
    // Cancel any pending collapse timer
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsNavExpanded(true);
  };

  const handleNavMouseLeave = () => {
    // Start 15-second timer to collapse
    collapseTimerRef.current = setTimeout(() => {
      setIsNavExpanded(false);
      collapseTimerRef.current = null;
    }, 15000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
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

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!userEmail) return;

      try {
        const supabase = createBrowserClient();
        const { data: userData } = await (supabase.from("users") as any)
          .select("status")
          .eq("email", userEmail)
          .single();

        const status = (userData as any)?.status || "active";

        // If status is not active (and not null/undefined), sign out
        if (status !== "active" && userData?.status) {
          await supabase.auth.signOut();
          router.replace("/login");
        }
      } catch (error) {
        console.error("Error checking user status:", error);
      }
    };

    checkUserStatus();
  }, [userEmail, router]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const res = await fetch('/api/search?q=' + encodeURIComponent(searchQuery));
          if (!res.ok) {
            console.error('Search failed with status:', res.status);
            const errorText = await res.text();
            console.error('Error response:', errorText);
            setShowDropdown(false);
          } else {
            const data = await res.json();
            console.log('Search results:', data);
            setResults(data);
            // Always show dropdown if we have query >= 2 chars
            setShowDropdown(true);
            console.log('Dropdown should be visible:', true);
          }
        } catch (error) {
          console.error('Search error:', error);
          setShowDropdown(false);
        } finally {
          setIsSearching(false);
        }
      } else {
        setShowDropdown(false);
        setResults({ documents: [], assignments: [] });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (documentsMenuRef.current && !documentsMenuRef.current.contains(event.target as Node)) {
        setShowDocumentsMenu(false);
      }
      if (assignmentsMenuRef.current && !assignmentsMenuRef.current.contains(event.target as Node)) {
        setShowAssignmentsMenu(false);
      }
      if (analyticsMenuRef.current && !analyticsMenuRef.current.contains(event.target as Node)) {
        setShowAnalyticsMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
        setShowDocumentsMenu(false);
        setShowAssignmentsMenu(false);
        setShowAnalyticsMenu(false);
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
    <nav 
      ref={navRef}
      onMouseEnter={handleNavMouseEnter}
      onMouseLeave={handleNavMouseLeave}
      className={`bg-white border-b border-college-peach shadow-sm px-4 sm:px-8 flex items-center gap-4 relative overflow-visible transition-all duration-300 ease-in-out ${
        isNavExpanded ? 'h-auto py-4' : 'h-[70px]'
      }`}
    >
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
      <div className="flex-1 flex items-center gap-4 overflow-visible">
        {/* Search Input */}
        <div ref={searchRef} className="relative max-w-xs w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowDropdown(false);
                setSearchQuery('');
              }
            }}
            placeholder="Search documents, assignments..."
            className="input-field text-sm py-1.5 w-full pr-8"
            autoComplete="off"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-college-secondary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Search Dropdown */}
          {showDropdown && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-college-peach rounded-lg shadow-lg max-h-72 overflow-y-auto z-[100]"
            >
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
        <div className={`flex-1 overflow-y-visible scrollbar-thin scrollbar-thumb-college-peach scrollbar-track-transparent hover:scrollbar-thumb-college-secondary transition-all duration-300 ${
          isNavExpanded ? 'overflow-x-visible' : 'overflow-x-auto'
        }`}>
          <div className={`flex items-center gap-4 lg:gap-6 px-2 transition-all duration-300 ${
            isNavExpanded ? 'flex-wrap' : 'min-w-max'
          }`}>
          
          {/* Dashboard (for non-students) */}
          {!isStudent && (
            <Link
              href="/dashboard"
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
            >
              Dashboard
            </Link>
          )}

          {/* Documents Dropdown (for non-students) */}
          {!isStudent && (
            <div ref={documentsMenuRef} className="relative">
              <button
                onClick={() => setShowDocumentsMenu(!showDocumentsMenu)}
                className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap flex items-center gap-1"
              >
                Documents
                <span className="text-xs">▼</span>
              </button>
              {showDocumentsMenu && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-college-peach rounded-lg shadow-lg py-2 min-w-[200px] z-[100]">
                  <Link
                    href="/upload"
                    onClick={() => setShowDocumentsMenu(false)}
                    className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                  >
                    Upload Document
                  </Link>
                  <Link
                    href="/notices/create"
                    onClick={() => setShowDocumentsMenu(false)}
                    className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                  >
                    Create Notice
                  </Link>
                  <Link
                    href="/notice-board"
                    onClick={() => setShowDocumentsMenu(false)}
                    className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                  >
                    Notice Board
                  </Link>
                  <Link
                    href="/audit"
                    onClick={() => setShowDocumentsMenu(false)}
                    className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                  >
                    Audit Trail
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* My Approvals (for approver roles) */}
          {(userRole === "hod" || userRole === "coe" || userRole === "principal") && (
            <Link
              href="/my-approvals"
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
            >
              My Approvals
            </Link>
          )}

          {/* Assignments Dropdown */}
          <div ref={assignmentsMenuRef} className="relative">
            <button
              onClick={() => setShowAssignmentsMenu(!showAssignmentsMenu)}
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap flex items-center gap-1"
            >
              Assignments
              <span className="text-xs">▼</span>
            </button>
            {showAssignmentsMenu && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-college-peach rounded-lg shadow-lg py-2 min-w-[200px] z-[100]">
                <Link
                  href="/assignments"
                  onClick={() => setShowAssignmentsMenu(false)}
                  className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                >
                  All Assignments
                </Link>
                <Link
                  href="/deadlines"
                  onClick={() => setShowAssignmentsMenu(false)}
                  className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                >
                  Deadlines
                </Link>
                <Link
                  href="/leaderboard"
                  onClick={() => setShowAssignmentsMenu(false)}
                  className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                >
                  Leaderboard
                </Link>
                {userRole === "faculty" && (
                  <Link
                    href="/assignments/analytics"
                    onClick={() => setShowAssignmentsMenu(false)}
                    className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                  >
                    Assignment Analytics
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Analytics Dropdown (for non-students) */}
          {!isStudent && (
            <div ref={analyticsMenuRef} className="relative">
              <button
                onClick={() => setShowAnalyticsMenu(!showAnalyticsMenu)}
                className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap flex items-center gap-1"
              >
                Analytics
                <span className="text-xs">▼</span>
              </button>
              {showAnalyticsMenu && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-college-peach rounded-lg shadow-lg py-2 min-w-[200px] z-[100]">
                  <Link
                    href="/analytics"
                    onClick={() => setShowAnalyticsMenu(false)}
                    className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                  >
                    Document Analytics
                  </Link>
                  {userRole === "faculty" && (
                    <Link
                      href="/assignments/analytics"
                      onClick={() => setShowAnalyticsMenu(false)}
                      className="block px-4 py-2 text-sm text-college-text hover:bg-college-bg font-poppins"
                    >
                      Assignment Analytics
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* This Week */}
          <Link
            href="/digest"
            className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
          >
            This Week
          </Link>

          {/* Users (for faculty, hod, coe, principal, admin) */}
          {(userRole === "faculty" || userRole === "hod" || userRole === "coe" || userRole === "principal" || userRole === "admin") && (
            <Link
              href="/users"
              className="font-poppins text-sm font-medium text-college-text hover:text-college-secondary transition-colors whitespace-nowrap"
            >
              Users
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
        <Link
          href="/profile"
          className="text-xs text-gray-500 font-poppins hidden xl:inline truncate max-w-[150px] hover:text-college-secondary transition-colors"
        >
          {userEmail}
        </Link>
        <button onClick={handleLogout} className="btn-danger whitespace-nowrap">
          Logout
        </button>
      </div>
    </nav>
  );
}
