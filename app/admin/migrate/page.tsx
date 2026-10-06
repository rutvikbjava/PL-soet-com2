"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MigratePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runMigration = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch("/api/migrate/fix-approver-ids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Migration failed");
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Database Migration: Fix Approver IDs
          </h1>
          
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              This migration will populate the <code className="bg-gray-100 px-2 py-1 rounded">approver_id</code> field 
              for all existing approvals that have it set to NULL.
            </p>
            <p className="text-sm text-gray-600 mb-2">
              It will:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>Find all approvals with approver_id = NULL</li>
              <li>Look up the workflow's generated_steps to find the required role</li>
              <li>Assign the appropriate user ID based on their role</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Important:</strong> This migration should only be run once. 
              New documents created after the fix will automatically have approver_id set correctly.
            </p>
          </div>

          <button
            onClick={runMigration}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Running Migration..." : "Run Migration"}
          </button>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Error:</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-3">
                ✅ {result.message}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Total Approvals Found:</span>
                  <span className="font-semibold text-gray-900">{result.total_approvals}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Successfully Updated:</span>
                  <span className="font-semibold text-green-700">{result.updated}</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Failed:</span>
                    <span className="font-semibold text-red-700">{result.failed}</span>
                  </div>
                )}
              </div>

              {result.failed_details && result.failed_details.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-300">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Failed Details:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.failed_details.map((detail: any, index: number) => (
                      <div key={index} className="text-xs text-gray-600">
                        {detail.approval_id}: {detail.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-green-300">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
