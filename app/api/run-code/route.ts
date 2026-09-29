import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TestCase {
  input: string;
  expected_output: string;
}

interface RequestBody {
  language_id: number;
  code: string;
  tests: TestCase[];
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
  index: number;
  passed: boolean;
  status: string;
  input: string;
  expected: string;
  actual: string;
  error: string;
  time: number;
  memory: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { language_id, code, tests } = body;

    if (!language_id || !code || !tests || !Array.isArray(tests)) {
      return NextResponse.json(
        { error: "Missing required fields: language_id, code, tests" },
        { status: 400 }
      );
    }

    const BASE = process.env.JUDGE0_URL || "https://ce.judge0.com";
    const results: TestResult[] = [];
    let passedCount = 0;
    let maxTime = 0;
    let maxMemory = 0;

    // Run tests sequentially
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];

      const submissionPayload = {
        source_code: code,
        language_id,
        stdin: test.input,
        expected_output: test.expected_output,
        cpu_time_limit: 2,
        memory_limit: 128000,
      };

      const response = await fetch(
        `${BASE}/submissions?base64_encoded=false&wait=true`,
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

      // Check for compilation error (status.id === 6)
      if (result.status.id === 6) {
        return NextResponse.json({
          compile_error: result.compile_output || "Compilation failed",
          results: [],
          passed: 0,
          total: tests.length,
          max_time: 0,
          max_memory: 0,
        });
      }

      // Test passed if status.id === 3 (Accepted)
      const passed = result.status.id === 3;
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
        index: i,
        passed,
        status: result.status.description,
        input: test.input,
        expected: test.expected_output,
        actual: result.stdout ?? "",
        error: result.stderr ?? "",
        time: testTime,
        memory: testMemory,
      });
    }

    return NextResponse.json({
      compile_error: null,
      results,
      passed: passedCount,
      total: tests.length,
      max_time: maxTime,
      max_memory: maxMemory,
    });
  } catch (error: any) {
    console.error("Code runner error:", error);
    return NextResponse.json(
      { error: "Code runner unavailable, try again" },
      { status: 500 }
    );
  }
}
