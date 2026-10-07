"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Assignment {
  id: string;
  title: string;
  type: string;
}

interface Submission {
  id: string;
  student_id: string;
  tests_passed: number | null;
  tests_total: number | null;
  created_at: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

interface LeaderboardEntry {
  rank: number;
  student_id: string;
  name: string;
  email: string;
  tests_passed: number;
  tests_total: number;
  percent: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  useEffect(() => {
    const initializeUser = async () => {
      const supabase = createBrowserClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email ?? "";
      setUserEmail(email);

      // Get user id and role from users table
      const { data: userData } = await (supabase.from("users") as any)
        .select("id, role")
        .eq("email", email)
        .single();

      if (!userData) {
        router.push("/login");
        return;
      }

      setUserId(userData.id);
      setUserRole(userData.role);

      // Fetch available assignments based on role
      await fetchAssignments(userData.id, userData.role);

      setLoading(false);
    };

    initializeUser();
  }, [router]);

  const fetchAssignments = async (currentUserId: string, role: string) => {
    const supabase = createBrowserClient();

    let query = (supabase.from("assignments") as any)
      .select("id, title, type")
      .eq("type", "code");

    // Faculty only sees their own assignments
    if (role === "faculty") {
      query = query.eq("creator_id", currentUserId);
    }

    const { data } = await query;

    setAssignments(data ?? []);
  };

  const fetchLeaderboard = async (assignmentId: string) => {
    setLoadingLeaderboard(true);
    const supabase = createBrowserClient();

    // Fetch all submissions for the assignment
    const { data: submissions } = await (supabase.from("submissions") as any)
      .select("id, student_id, tests_passed, tests_total, created_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false });

    if (!submissions || submissions.length === 0) {
      setLeaderboard([]);
      setLoadingLeaderboard(false);
      return;
    }

    // Get latest submission per student
    const latestMap = new Map<string, Submission>();
    submissions.forEach((s: Submission) => {
      if (!latestMap.has(s.student_id)) {
        latestMap.set(s.student_id, s);
      }
    });
    const latest = Array.from(latestMap.values());

    // Fetch user names for all student_ids
    const studentIds = latest.map((s) => s.student_id);
    const { data: users } = await (supabase.from("users") as any)
      .select("id, full_name, email")
      .in("id", studentIds);

    const usersMap = new Map<string, User>();
    (users ?? []).forEach((u: User) => {
      usersMap.set(u.id, u);
    });

    // Compute percent and build leaderboard entries
    const entries: LeaderboardEntry[] = latest.map((sub) => {
      const user = usersMap.get(sub.student_id);
      const testsTotal = sub.tests_total ?? 0;
      const testsPassed = sub.tests_passed ?? 0;
      const percent = testsTotal > 0 ? (testsPassed / testsTotal) * 100 : 0;

      return {
        rank: 0, // Will be set after sorting
        student_id: sub.student_id,
        name: user?.full_name ?? "Unknown",
        email: user?.email ?? "unknown@example.com",
        tests_passed: testsPassed,
        tests_total: testsTotal,
        percent: Math.round(percent * 100) / 100,
      };
    });

    // Sort by percent descending
    entries.sort((a, b) => b.percent - a.percent);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    setLeaderboard(entries);
    setLoadingLeaderboard(false);
  };

  const handleAssignmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const assignmentId = e.target.value;
    setSelectedAssignmentId(assignmentId);

    if (assignmentId) {
      fetchLeaderboard(assignmentId);
    } else {
      setLeaderboard([]);
    }
  };

  const getMedalEmoji = (rank: number): string => {
    if (rank === 1) return "🥇 ";
    if (rank === 2) return "🥈 ";
    if (rank === 3) return "🥉 ";
    return "";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <main className="p-8">
          <div className="text-center text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="p-8">
        <h1 className="page-heading mb-6">🏆 Leaderboard</h1>

        <div className="card mb-6">
          <h2 className="section-heading">Select Assignment</h2>

          <select
            value={selectedAssignmentId}
            onChange={handleAssignmentChange}
            className="input-field max-w-md"
          >
            <option value="">Select an assignment</option>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
        </div>

        {!selectedAssignmentId && (
          <div className="text-sm text-gray-400 py-8 text-center">
            Select an assignment to see the leaderboard.
          </div>
        )}

        {selectedAssignmentId && loadingLeaderboard && (
          <div className="text-sm text-gray-400 py-8 text-center">
            Loading leaderboard...
          </div>
        )}

        {selectedAssignmentId &&
          !loadingLeaderboard &&
          leaderboard.length === 0 && (
            <div className="text-sm text-gray-400 py-4 text-center">
              No submissions for this assignment yet.
            </div>
          )}

        {selectedAssignmentId &&
          !loadingLeaderboard &&
          leaderboard.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="table-header">Rank</th>
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Tests Passed</th>
                    <th className="table-header">Score %</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => {
                    const isCurrentUser =
                      userRole === "student" && entry.student_id === userId;
                    const rowClass = isCurrentUser
                      ? "table-row bg-college-peach font-semibold"
                      : "table-row";

                    return (
                      <tr key={entry.student_id} className={rowClass}>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {getMedalEmoji(entry.rank)}
                          {entry.rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {entry.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {entry.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {entry.tests_passed} / {entry.tests_total}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {entry.percent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </main>
    </div>
  );
}
