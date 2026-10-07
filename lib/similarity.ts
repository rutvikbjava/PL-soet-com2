/**
 * Calculate similarity percentage between two strings using 5-character shingles.
 * Returns 0 if either string is empty or under 10 characters.
 * Returns percentage (0-100) rounded to nearest integer.
 */
export function similarityPercent(a: string, b: string): number {
  // Return 0 if either input is empty or under 10 chars
  if (!a || !b || a.length < 10 || b.length < 10) {
    return 0;
  }

  // Lowercase both strings and strip all whitespace
  const cleanA = a.toLowerCase().replace(/\s+/g, '');
  const cleanB = b.toLowerCase().replace(/\s+/g, '');

  // Return 0 if cleaned strings are too short
  if (cleanA.length < 5 || cleanB.length < 5) {
    return 0;
  }

  // Build overlapping 5-character shingles
  const shingles = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - 5; i++) {
      set.add(s.slice(i, i + 5));
    }
    return set;
  };

  const shinglesA = shingles(cleanA);
  const shinglesB = shingles(cleanB);

  // Compute intersection size
  let intersectionSize = 0;
  for (const shingle of shinglesA) {
    if (shinglesB.has(shingle)) {
      intersectionSize++;
    }
  }

  // Calculate similarity: intersection / smaller set size * 100
  const smallerSetSize = Math.min(shinglesA.size, shinglesB.size);
  
  if (smallerSetSize === 0) {
    return 0;
  }

  const similarity = (intersectionSize / smallerSetSize) * 100;

  // Return rounded to nearest integer
  return Math.round(similarity);
}
