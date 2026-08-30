/**
 * Exam & Challenge Generator for CTF
 * Extracted from: student_exam_generator_and_analyzer (S.E.S.)
 * Patterns: Question generation, unique exam variants, auto-grading,
 *           analytics, anti-cheating via permutation
 */

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'crypto' | 'forensics' | 'web' | 'pwn';

export interface Question {
  id: string;
  type: QuestionType;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  points: number;
  hints: string[];
  tags: string[];
  timeLimit?: number; // seconds
}

export interface ExamVariant {
  id: string;
  questions: Question[];
  createdAt: number;
  seed: number;
  totalTime: number;
  totalPoints: number;
}

export interface ExamResult {
  variantId: string;
  answers: { questionId: string; answer: string; timeSpent: number }[];
  score: number;
  maxScore: number;
  percentage: number;
  gradedAt: number;
  feedback: QuestionFeedback[];
}

export interface QuestionFeedback {
  questionId: string;
  correct: boolean;
  points: number;
  maxPoints: number;
  explanation: string;
}

// ─── Seeded Random ─────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Question Bank ─────────────────────────────────────────────────────

const QUESTION_BANK: Question[] = [
  {
    id: 'crypto-caesar',
    type: 'crypto',
    category: 'Cryptography',
    difficulty: 'easy',
    prompt: 'Decrypt the following Caesar cipher (shift=3): WKLV LV D WHVW',
    correctAnswer: 'THIS IS A TEST',
    points: 100,
    hints: ['Try shifting each letter back by 3', 'A shifts to X, B to Y, C to Z'],
    tags: ['caesar', 'classical'],
  },
  {
    id: 'crypto-rsa-small',
    type: 'crypto',
    category: 'Cryptography',
    difficulty: 'medium',
    prompt: 'Factor n=3233 to find p and q for RSA. What is φ(n)?',
    correctAnswer: '3120',
    points: 200,
    hints: ['n = p * q, try small primes', 'φ(n) = (p-1)(q-1)'],
    tags: ['rsa', 'factoring'],
  },
  {
    id: 'web-sqli',
    type: 'web',
    category: 'Web Security',
    difficulty: 'easy',
    prompt: 'What SQL injection payload bypasses login for admin with no password?',
    correctAnswer: "' OR '1'='1' --",
    points: 150,
    hints: ['Think about always-true conditions', 'Use comment to ignore rest of query'],
    tags: ['sqli', 'authentication'],
  },
  {
    id: 'forensics-pcap',
    type: 'forensics',
    category: 'Forensics',
    difficulty: 'medium',
    prompt: 'In a pcap file, what tool can extract HTTP objects?',
    correctAnswer: 'wireshark',
    points: 200,
    hints: ['Network protocol analyzer', 'Has an export objects feature'],
    tags: ['pcap', 'wireshark', 'network'],
  },
  {
    id: 'pwn-buffer',
    type: 'pwn',
    category: 'Binary Exploitation',
    difficulty: 'hard',
    prompt: 'What is the offset to overwrite the return address if the buffer is 64 bytes and there is an 8-byte saved RBP?',
    correctAnswer: '72',
    points: 300,
    hints: ['buffer size + saved frame pointer', '64 + 8 = ?'],
    tags: ['buffer-overflow', 'stack'],
  },
  {
    id: 'tf-bool',
    type: 'true_false',
    category: 'General',
    difficulty: 'easy',
    prompt: 'ASLR makes buffer overflow exploits harder by randomizing memory addresses.',
    correctAnswer: 'true',
    points: 50,
    hints: ['Address Space Layout Randomization'],
    tags: ['aslr', 'fundamentals'],
  },
];

// ─── Exam Generation ───────────────────────────────────────────────────

export function generateExamVariant(
  bank: Question[] = QUESTION_BANK,
  options: {
    questionCount?: number;
    difficulty?: string;
    seed?: number;
    categories?: string[];
    timePerQuestion?: number;
  } = {},
): ExamVariant {
  const {
    questionCount = 10,
    difficulty,
    seed = Date.now(),
    categories,
    timePerQuestion = 300,
  } = options;

  const rng = mulberry32(seed);
  let pool = [...bank];

  if (difficulty) {
    pool = pool.filter((q) => q.difficulty === difficulty);
  }
  if (categories && categories.length > 0) {
    pool = pool.filter((q) => categories.includes(q.category));
  }

  const selected = shuffle(pool, rng).slice(0, Math.min(questionCount, pool.length));

  // Shuffle options for MC questions
  const processed = selected.map((q) => {
    if (q.options) {
      return { ...q, options: shuffle(q.options, rng) };
    }
    return q;
  });

  return {
    id: `exam-${seed}`,
    questions: processed,
    createdAt: Date.now(),
    seed,
    totalTime: processed.length * timePerQuestion,
    totalPoints: processed.reduce((sum, q) => sum + q.points, 0),
  };
}

// ─── Grading ───────────────────────────────────────────────────────────

export function gradeExam(
  variant: ExamVariant,
  answers: { questionId: string; answer: string; timeSpent: number }[],
): ExamResult {
  const feedback: QuestionFeedback[] = [];
  let totalScore = 0;

  for (const ans of answers) {
    const question = variant.questions.find((q) => q.id === ans.questionId);
    if (!question) continue;

    const correct = normalizeAnswer(ans.answer) === normalizeAnswer(question.correctAnswer);
    const points = correct ? question.points : 0;
    totalScore += points;

    feedback.push({
      questionId: ans.questionId,
      correct,
      points,
      maxPoints: question.points,
      explanation: correct
        ? `Correct! ${question.hints[question.hints.length - 1] || ''}`
        : `Incorrect. The answer is: ${question.correctAnswer}. ${question.hints[question.hints.length - 1] || ''}`,
    });
  }

  return {
    variantId: variant.id,
    answers,
    score: totalScore,
    maxScore: variant.totalPoints,
    percentage: Math.round((totalScore / variant.totalPoints) * 100),
    gradedAt: Date.now(),
    feedback,
  };
}

function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Analytics ─────────────────────────────────────────────────────────

export function analyzeExamResults(results: ExamResult[]) {
  if (results.length === 0) return null;

  const scores = results.map((r) => r.percentage);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const questionStats: Record<string, { correct: number; total: number; avgTime: number }> = {};
  for (const result of results) {
    for (const fb of result.feedback) {
      if (!questionStats[fb.questionId]) {
        questionStats[fb.questionId] = { correct: 0, total: 0, avgTime: 0 };
      }
      questionStats[fb.questionId].total++;
      if (fb.correct) questionStats[fb.questionId].correct++;
    }
  }

  for (const [qId, stats] of Object.entries(questionStats)) {
    stats.avgTime =
      results.reduce((sum, r) => {
        const ans = r.answers.find((a) => a.questionId === qId);
        return sum + (ans?.timeSpent || 0);
      }, 0) / stats.total;
  }

  return {
    totalExams: results.length,
    averageScore: Math.round(avg),
    minScore: min,
    maxScore: max,
    passRate: Math.round((scores.filter((s) => s >= 60).length / scores.length) * 100),
    questionStats,
  };
}

// ─── Unique Exam Per Student (Anti-Cheating) ──────────────────────────

export function generateUniqueExams(
  students: string[],
  bank: Question[] = QUESTION_BANK,
  options: { questionCount?: number; difficulty?: string } = {},
): Map<string, ExamVariant> {
  const exams = new Map<string, ExamVariant>();
  const usedQuestions = new Map<string, Set<string>>();

  for (const student of students) {
    // Create a seed from student ID for reproducibility
    let seed = 0;
    for (let i = 0; i < student.length; i++) {
      seed = ((seed << 5) - seed + student.charCodeAt(i)) | 0;
    }

    const variant = generateExamVariant(bank, { ...options, seed: Math.abs(seed) });
    exams.set(student, variant);
  }

  return exams;
}
