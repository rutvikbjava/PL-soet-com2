export function matchOutput(
  expected: string,
  actual: string,
  matchType: 'exact' | 'smart'
): { passed: boolean; reason: string } {
  if (matchType === 'exact') {
    const pass = expected.trim() === actual.trim();
    return {
      passed: pass,
      reason: pass ? 'Exact match' : 'Output does not match exactly',
    };
  }

  // matchType === 'smart'
  // Check 1 — Exact match after trim
  if (expected.trim() === actual.trim()) {
    return { passed: true, reason: 'Exact match' };
  }

  // Check 2 — Case insensitive match
  if (expected.trim().toLowerCase() === actual.trim().toLowerCase()) {
    return { passed: true, reason: 'Case-insensitive match' };
  }

  // Check 3 — Extract numbers and compare
  const extractNumbers = (s: string) =>
    s.match(/-?\d+\.?\d*/g)?.join(' ') ?? '';
  const expNums = extractNumbers(expected.trim());
  const actNums = extractNumbers(actual.trim());
  if (expNums.length > 0 && expNums === actNums) {
    return { passed: true, reason: 'Numeric values match' };
  }

  // Check 4 — Floating point tolerance
  const expFloat = parseFloat(expected.trim());
  const actFloat = parseFloat(actual.trim());
  if (!isNaN(expFloat) && !isNaN(actFloat)) {
    if (Math.abs(expFloat - actFloat) < 0.001) {
      return { passed: true, reason: 'Numeric match within tolerance' };
    }
  }

  // Check 5 — Expected value contained in actual output
  if (actual.trim().includes(expected.trim())) {
    return { passed: true, reason: 'Expected value found in output' };
  }

  // Check 6 — Normalize whitespace and compare
  const normalize = (s: string) =>
    s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalize(expected) === normalize(actual)) {
    return { passed: true, reason: 'Match after whitespace normalization' };
  }

  // Check 7 — Array/list comparison
  const extractTokens = (s: string) =>
    s.match(/[\w.-]+/g)?.map((t) => t.toLowerCase()).sort().join(',') ?? '';
  const expTokens = extractTokens(expected);
  const actTokens = extractTokens(actual);
  if (expTokens.length > 0 && expTokens === actTokens) {
    return { passed: true, reason: 'All values present (order independent)' };
  }

  // If all checks fail
  return {
    passed: false,
    reason: 'Output does not match expected value',
  };
}
