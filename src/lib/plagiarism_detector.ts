/**
 * Plagiarism Detector - Code similarity detection.
 * Extracted from copydetect (inspiration).
 * Tokenization, fingerprinting, winnowing, and overlap detection.
 */

export interface Fingerprint {
  hash: number;
  index: number;
  tokenCount: number;
}

export interface SimilarityResult {
  file1: string;
  file2: string;
  similarity: number;
  overlapCount: number;
  totalTokens1: number;
  totalTokens2: number;
  copiedSlices: CopiedSlice[];
}

export interface CopiedSlice {
  start1: number;
  end1: number;
  start2: number;
  end2: number;
  length: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "because", "but", "and",
  "or", "if", "while", "this", "that", "these", "those", "it", "its",
]);

const CODE_KEYWORDS = new Set([
  "function", "return", "if", "else", "for", "while", "class", "const",
  "let", "var", "import", "export", "from", "default", "new", "this",
  "try", "catch", "throw", "async", "await", "switch", "case", "break",
  "continue", "typeof", "instanceof", "void", "delete", "in", "of",
]);

function tokenize(code: string): string[] {
  const tokens: string[] = [];
  const regex = /[a-zA-Z_$][a-zA-Z0-9_$]*|[0-9]+(?:\.[0-9]+)?|[^\s\w]+/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function filterTokens(tokens: string[]): string[] {
  return tokens.map(token => {
    const lower = token.toLowerCase();
    if (CODE_KEYWORDS.has(lower)) return token;
    if (STOPWORDS.has(lower)) return "_";
    if (/^[0-9]+$/.test(token)) return "N";
    if (/^[0-9]+\.[0-9]+$/.test(token)) return "N";
    if (/^[a-z][A-Z]/.test(token)) return "V";
    if (/^[A-Z][a-z]/.test(token)) return "C";
    if (/^[A-Z]+$/.test(token)) return "C";
    return "V";
  });
}

function generateKgrams(tokens: string[], k: number): string[] {
  const kgrams: string[] = [];
  for (let i = 0; i <= tokens.length - k; i++) {
    kgrams.push(tokens.slice(i, i + k).join(" "));
  }
  return kgrams;
}

function hashKgram(kgram: string): number {
  let hash = 0;
  for (let i = 0; i < kgram.length; i++) {
    hash = ((hash << 5) - hash + kgram.charCodeAt(i)) | 0;
  }
  return hash;
}

function winnow(hashes: number[], windowSize: number): Fingerprint[] {
  if (hashes.length === 0) return [];
  const fingerprints: Fingerprint[] = [];
  const window: { hash: number; index: number }[] = [];
  for (let i = 0; i < hashes.length; i++) {
    window.push({ hash: hashes[i], index: i });
    if (window.length > windowSize) window.shift();
    if (i >= windowSize - 1) {
      const minHash = window.reduce((min, curr) =>
        curr.hash < min.hash ? curr : min
      );
      if (fingerprints.length === 0 || fingerprints[fingerprints.length - 1].hash !== minHash.hash ||
          fingerprints[fingerprints.length - 1].index !== minHash.index) {
        fingerprints.push({ hash: minHash.hash, index: minHash.index, tokenCount: windowSize });
      }
    }
  }
  return fingerprints;
}

export function createFingerprint(
  code: string,
  filename: string,
  k: number = 5,
  windowSize: number = 4,
): { filename: string; fingerprints: Fingerprint[]; tokens: string[] } {
  const tokens = tokenize(code);
  const filtered = filterTokens(tokens);
  const kgrams = generateKgrams(filtered, k);
  const hashes = kgrams.map(hashKgram);
  const fingerprints = winnow(hashes, windowSize);
  return { filename, fingerprints, tokens: filtered };
}

export function compareFingerprints(
  fp1: { filename: string; fingerprints: Fingerprint[]; tokens: string[] },
  fp2: { filename: string; fingerprints: Fingerprint[]; tokens: string[] },
): SimilarityResult {
  const hashes1 = new Set(fp1.fingerprints.map(f => f.hash));
  const hashes2 = new Set(fp2.fingerprints.map(f => f.hash));
  let overlap = 0;
  for (const h of hashes1) {
    if (hashes2.has(h)) overlap++;
  }
  const total = Math.max(hashes1.size, hashes2.size, 1);
  const similarity = overlap / total;
  const copiedSlices = findCopiedSlices(fp1, fp2);
  return {
    file1: fp1.filename,
    file2: fp2.filename,
    similarity: Math.round(similarity * 1000) / 1000,
    overlapCount: overlap,
    totalTokens1: fp1.tokens.length,
    totalTokens2: fp2.tokens.length,
    copiedSlices,
  };
}

function findCopiedSlices(
  fp1: { filename: string; fingerprints: Fingerprint[]; tokens: string[] },
  fp2: { filename: string; fingerprints: Fingerprint[]; tokens: string[] },
): CopiedSlice[] {
  const slices: CopiedSlice[] = [];
  const hashToIndex1 = new Map<number, number[]>();
  for (const f of fp1.fingerprints) {
    const indices = hashToIndex1.get(f.hash) || [];
    indices.push(f.index);
    hashToIndex1.set(f.hash, indices);
  }
  for (const f of fp2.fingerprints) {
    const indices1 = hashToIndex1.get(f.hash);
    if (indices1 && indices1.length > 0) {
      slices.push({
        start1: indices1[0], end1: indices1[0] + f.tokenCount,
        start2: f.index, end2: f.index + f.tokenCount,
        length: f.tokenCount,
      });
    }
  }
  return slices;
}

export function detectPlagiarism(
  files: { filename: string; code: string }[],
  threshold: number = 0.3,
  k: number = 5,
  windowSize: number = 4,
): SimilarityResult[] {
  const fingerprints = files.map(f => createFingerprint(f.code, f.filename, k, windowSize));
  const results: SimilarityResult[] = [];
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const result = compareFingerprints(fingerprints[i], fingerprints[j]);
      if (result.similarity >= threshold) {
        results.push(result);
      }
    }
  }
  return results.sort((a, b) => b.similarity - a.similarity);
}
