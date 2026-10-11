import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import { matchOutput } from "@/lib/output-matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const clean = (v: any): any =>
  typeof v === 'string' ? v.replace(/\u0000/g, '')
  : Array.isArray(v) ? v.map(clean)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]))
    : v;

const enc = (s: string) => Buffer.from(s ?? '', 'utf8').toString('base64');
const dec = (s: any) => typeof s === 'string' && s ? Buffer.from(s, 'base64').toString('utf8') : '';

const BASE = "https://ce.judge0.com";

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
        source_code: enc(source_code),
        language_id,
        stdin: enc(test_case.input || ""),
        expected_output: enc(test_case.expected_output || ""),
      };

      const response = await fetch(
        `${BASE}/submissions?base64_encoded=true&wait=true&fields=*`,
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

      // Decode text fields
      const stdout = dec(result.stdout);
      const stderr = dec(result.stderr);
      const compile_output = dec(result.compile_output);

      // Check for compilation error (status.id === 6)
      if (result.status.id === 6) {
        const compileError = compile_output || "Compilation failed";

        return NextResponse.json({
          compile_error: clean(compileError),
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
        input: clean(test_case.input),
        expected: clean(test_case.expected_output),
        actual: clean(stdout.trim()),
        passed,
        match_reason: clean(reason),
        status: clean(result.status?.description ?? "Unknown"),
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
