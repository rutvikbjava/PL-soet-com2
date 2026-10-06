import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import { matchOutput } from "@/lib/output-matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TestCase {
  input: string;
  expected_output: string;
  match_type?: "exact" | "smart";
}

interface RequestBody {
  source_code: string;
  language_id: number;
  assignment_id: string;
  test_cases: TestCase[];
}

interface Judge0Status {
  id: number;
  description: string;
}

interface Judge0Response {
  status: Judge0Status;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
}

interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  match_reason: string;
  status: string;
  time: number;
  memory: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const { source_code, language_id, assignment_id, test_cases } = body;

    if (!source_code || !language_id || !assignment_id || !test_cases || !Array.isArray(test_cases)) {
      return NextResponse.json(
        { error: "Missing required fields: source_code, language_id, assignment_id, test_cases" },
        { status: 400 }
      );
    }

    // Fetch assignment to get smart_grading setting
    const adminClient = createAdminClient();
    const { data: assignment } = await (adminClient as any)
      .from("assignments")
      .select("smart_grading")
      .eq("id", assignment_id)
      .single();

    const useSmartGrading = assignment?.smart_grading ?? true;

    const results: TestResult[] = [];
    let passedCount = 0;
    let maxTime = 0;
    let maxMemory = 0;

    // Run tests sequentially
    for (const test_case of test_cases) {
      // Prepare submission for Judge0
      const submissionPayload = {
        source_code: Buffer.from(source_code).toString("base64"),
        language_id,
        stdin: Buffer.from(test_case.input || "").toString("base64"),
        expected_output: Buffer.from(test_case.expected_output || "").toString("base64"),
        base64_encoded: true,
      };

      const response = await fetch(
        "https://ce.judge0.com/submissions?wait=true",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(submissionPayload),
        }
      );

      if (!response.ok) {
        throw new Error(`Judge0 API error: ${response.statusText}`);
      }

      const result: Judge0Response = await response.json();

      // Decode stdout
      const stdout = result.stdout
        ? Buffer.from(result.stdout, "base64").toString()
        : "";

      // Check for compilation error (status.id === 6)
      if (result.status.id === 6) {
        const compileError = result.compile_output
          ? Buffer.from(result.compile_output, "base64").toString()
          : "Compilation failed";

        return NextResponse.json({
          compile_error: compileError,
          results: [],
          passed: 0,
          total: test_cases.length,
          max_time: 0,
          max_memory: 0,
        });
      }

      // Determine match type
      const matchType = useSmartGrading
        ? (test_case.match_type ?? "smart")
        : "exact";

      // Use output matcher
      const { passed, reason } = matchOutput(
        test_case.expected_output,
        stdout,
        matchType
      );

      if (passed) {
        passedCount++;
      }

      const testTime = Number(result.time ?? 0);
      const testMemory = Number(result.memory ?? 0);

      if (testTime > maxTime) {
        maxTime = testTime;
      }
      if (testMemory > maxMemory) {
        maxMemory = testMemory;
      }

      results.push({
        input: test_case.input,
        expected: test_case.expected_output,
        actual: stdout.trim(),
        passed,
        match_reason: reason,
        status: result.status?.description ?? "Unknown",
        time: testTime,
        memory: testMemory,
      });
    }

    return NextResponse.json({
      results,
      passed: passedCount,
      total: test_cases.length,
      compile_error: null,
      max_time: maxTime,
      max_memory: maxMemory,
    });
  } catch (error: any) {
    console.error("Code runner error:", error);
    return NextResponse.json(
      { error: error.message || "Code runner unavailable, try again" },
      { status: 500 }
    );
  }
}
