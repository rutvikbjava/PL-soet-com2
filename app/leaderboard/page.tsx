"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Assignment {
  id: string;
  title: string;
  type: string;
  creator_id: string;
}

interface Submission {
  id: string;
  student_id: string;
  tests_passed: number;
  tests_total: number;
  created_at: string;
  percent: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [userMap, setUserMap] = useState<Record<string, { email: string; full_name: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState<string>("");

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

      const currentUserId = session?.user?.id;
      const email = session?.user?.email ?? "";
      setUserEmail(email);
      setUserId(currentUserId ?? "");

      // Fetch user row
      const { data: userData } = await (supabase.from("users") as any)
        .select("id, email, full_name, role")
        .eq("id", currentUserId)
        .single();

      setCurrentUserRole(userData?.role ?? "");

      // Fetch ALL code type assignments (not filtered by creator)
      const { data: allAssignments } = await (supabase.from("assignments") as any)
        .select("id, title, type, creator_id");

      const codeAssignments = (allAssignments ?? []).filter(
        (a: any) => a.type === "code"
      );

      setAssignments(codeAssignments);
      setLoading(false);
    };

    initializeUser();
  }, [router]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!selectedAssignmentId) {
        setSubmissions([]);
        setUserMap({});
        setSelectedAssignmentTitle("");
        return;
      }

      const supabase = createBrowserClient();

      // Get selected assignment title
      const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId);
      setSelectedAssignmentTitle(selectedAssignment?.title ?? "");

      // Fetch submissions without any join
      const { data: subs } = await (supabase.from("submissions") as any)
        .select("id, student_id, tests_passed, tests_total, created_at")
        .eq("assignment_id", selectedAssignmentId)
        .order("created_at", { ascending: false });

      if (!subs || subs.length === 0) {
        setSubmissions([]);
        setUserMap({});
        return;
      }

      // Get latest submission per student_id
      const latestMap = new Map<string, any>();
      subs.forEach((s: any) => {
        if (!latestMap.has(s.student_id)) {
          latestMap.set(s.student_id, s);
        }
      });
      const latest = Array.from(latestMap.values());

      // Fetch user info for all student_ids separately
      const studentIds = latest.map((s: any) => s.student_id).filter(Boolean);
      if (studentIds.length > 0) {
        const { data: users } = await (supabase.from("users") as any)
          .select("id, email, full_name")
          .in("id", studentIds);

        const map: Record<string, any> = {};
        users?.forEach((u: any) => {
          map[u.id] = u;
        });
        setUserMap(map);
      }

      // Compute score for each
      const scored = latest.map((s: any) => ({
        ...s,
        percent: s.tests_total > 0 ? Math.round((s.tests_passed / s.tests_total) * 100) : 0,
      }));

      // Sort by percent descending
      scored.sort((a: any, b: any) => b.percent - a.percent);

      setSubmissions(scored);
    };

    fetchSubmissions();
  }, [selectedAssignmentId, assignments]);

  const handleAssignmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAssignmentId(e.target.value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={currentUserRole} />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center text-college-secondary">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={currentUserRole} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="page-heading">🏆 Leaderboard</h1>
        <p className="text-sm text-gray-500 font-poppins mb-6">Code assignment rankings</p>

        {/* Assignment Selector */}
        <select
          value={selectedAssignmentId}
          onChange={handleAssignmentChange}
          className="input-field max-w-md mb-6"
        >
          <option value="">Select an assignment</option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.title}
            </option>
          ))}
        </select>

        {/* No Selection */}
        {!selectedAssignmentId && (
          <div className="card text-center py-12">
            <p className="text-sm text-gray-400">Select an assignment to see the leaderboard.</p>
          </div>
        )}

        {/* No Submissions Yet */}
        {selectedAssignmentId && submissions.length === 0 && (
          <div className="card text-center py-4">
            <p className="text-sm text-gray-400">No submissions for this assignment yet.</p>
          </div>
        )}

        {/* Has Submissions */}
        {selectedAssignmentId && submissions.length > 0 && (
          <div className="card">
            <h2 className="section-heading">{selectedAssignmentTitle}</h2>

            <div className="overflow-x-auto">
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
                  {submissions.map((s, i) => {
                    const isCurrentUser = s.student_id === userId;
                    const rowClass = isCurrentUser
                      ? "table-row bg-college-peach font-semibold"
                      : "table-row";

                    let rankDisplay: string;
                    if (i === 0) {
                      rankDisplay = "🥇 1";
                    } else if (i === 1) {
                      rankDisplay = "🥈 2";
                    } else if (i === 2) {
                      rankDisplay = "🥉 3";
                    } else {
                      rankDisplay = (i + 1).toString();
                    }

                    return (
                      <tr key={s.id} className={rowClass}>
                        <td className="px-4 py-3 text-sm text-college-text">{rankDisplay}</td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {userMap[s.student_id]?.full_name ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {userMap[s.student_id]?.email ?? s.student_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">
                          {s.tests_passed}/{s.tests_total}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text">{s.percent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
