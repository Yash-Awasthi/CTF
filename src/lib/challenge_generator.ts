/**
 * Challenge Generator — Inspired by CTFd's challenge management patterns.
 *
 * Generates CTF challenges from templates with configurable difficulty,
 * categories, and flag formats. Supports dynamic point values and
 * progressive hint systems.
 */

import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {'crypto'|'web'|'pwn'|'reverse'|'forensics'|'misc'|'osint'} Category
 * @typedef {'easy'|'medium'|'hard'|'extreme'} Difficulty
 */

/**
 * @typedef {Object} ChallengeTemplate
 * @property {string} id
 * @property {string} title
 * @property {Category} category
 * @property {Difficulty} difficulty
 * @property {string} description
 * @property {string} flag
 * @property {string} flagFormat - Regex or literal flag format
 * @property {number} basePoints
 * @property {Array<{text: string, cost: number}>} hints
 * @property {string[]} tags
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} GeneratedChallenge
 * @property {string} id
 * @property {string} title
 * @property {Category} category
 * @property {Difficulty} difficulty
 * @property {string} description
 * @property {string} flag
 * @property {string} flagFormat
 * @property {number} basePoints
 * @property {number} dynamicPoints
 * @property {Array<{text: string, cost: number, revealed: boolean}>} hints
 * @property {string[]} tags
 * @property {string} createdAt
 * @property {number} solveCount
 * @property {number} maxSolves
 */

// ---------------------------------------------------------------------------
// Difficulty → Points mapping
// ---------------------------------------------------------------------------

const DIFFICULTY_POINTS = {
  easy: { base: 100, min: 50, max: 150 },
  medium: { base: 250, min: 150, max: 350 },
  hard: { base: 500, min: 350, max: 700 },
  extreme: { base: 1000, min: 700, max: 1500 },
};

// ---------------------------------------------------------------------------
// Challenge templates
// ---------------------------------------------------------------------------

const TEMPLATES = {
  crypto: [
    {
      title: 'RSA basics',
      difficulty: 'easy',
      description: 'Decrypt this RSA-encrypted message. The public key has been weakened.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Check the modulus for small factors', cost: 10 },
        { text: 'Use factordb.com to factor N', cost: 25 },
      ],
    },
    {
      title: 'XOR cipher',
      difficulty: 'easy',
      description: 'A single-byte XOR cipher was used to encrypt the flag. Can you break it?',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Try all 256 possible keys', cost: 10 },
        { text: 'The flag starts with "flag{"', cost: 20 },
      ],
    },
    {
      title: 'AES ECB oracle',
      difficulty: 'medium',
      description: 'An AES-ECB encryption oracle. Can you extract the secret?',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'ECB mode encrypts identical blocks to identical ciphertext', cost: 20 },
        { text: 'Use byte-at-a-time attack', cost: 40 },
      ],
    },
    {
      title: 'Hash length extension',
      difficulty: 'hard',
      description: 'A MAC is computed using MD5(secret || message). Forge a valid MAC for a new message.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'MD5 is vulnerable to length extension attacks', cost: 30 },
        { text: 'Use hashpump or hlextend', cost: 50 },
      ],
    },
  ],

  web: [
    {
      title: 'SQL injection 101',
      difficulty: 'easy',
      description: 'A login form seems vulnerable. Can you bypass authentication?',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: "Try the classic ' OR 1=1 --", cost: 10 },
        { text: 'Check the error messages for SQL syntax hints', cost: 20 },
      ],
    },
    {
      title: 'XSS challenge',
      difficulty: 'medium',
      description: 'Find and exploit a reflected XSS vulnerability to steal the admin cookie.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Look for user input that is reflected without encoding', cost: 20 },
        { text: 'Try event handlers like onerror or onload', cost: 35 },
      ],
    },
    {
      title: 'SSRF to RCE',
      difficulty: 'hard',
      description: 'A webhook feature makes HTTP requests. Can you reach internal services?',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Try accessing localhost services', cost: 30 },
        { text: 'Check for metadata endpoints (169.254.169.254)', cost: 50 },
      ],
    },
  ],

  pwn: [
    {
      title: 'Buffer overflow',
      difficulty: 'easy',
      description: 'A simple buffer overflow challenge. Redirect execution to the win function.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'The buffer is 64 bytes, the return address is at offset 72', cost: 10 },
        { text: 'Use pattern_create/pattern_offset to find the offset', cost: 20 },
      ],
    },
    {
      title: 'Format string',
      difficulty: 'medium',
      description: 'A printf(user_input) vulnerability. Read the flag from memory.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Use %x to leak stack values', cost: 20 },
        { text: 'The flag is stored at a known address', cost: 40 },
      ],
    },
  ],

  reverse: [
    {
      title: 'Simple crackme',
      difficulty: 'easy',
      description: 'A binary asks for a password. Reverse engineer the check.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Use strings to find obvious clues', cost: 10 },
        { text: 'Open in Ghidra and find the comparison function', cost: 20 },
      ],
    },
    {
      title: 'Anti-debug crackme',
      difficulty: 'hard',
      description: 'A binary with anti-debugging protections. Bypass them to find the flag.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'The binary checks for ptrace', cost: 30 },
        { text: 'Patch the ptrace check to always return 0', cost: 50 },
      ],
    },
  ],

  forensics: [
    {
      title: 'PCAP analysis',
      difficulty: 'easy',
      description: 'Analyze this network capture to find the hidden flag.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Look for HTTP traffic', cost: 10 },
        { text: 'Follow the TCP stream', cost: 20 },
      ],
    },
    {
      title: 'Memory forensics',
      difficulty: 'medium',
      description: 'A memory dump from a compromised machine. Find the malicious process.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Use Volatility to analyze the dump', cost: 20 },
        { text: 'Check for hidden processes with pslist', cost: 35 },
      ],
    },
  ],

  misc: [
    {
      title: 'QR code challenge',
      difficulty: 'easy',
      description: 'A QR code that contains more than meets the eye.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Decode the QR code normally first', cost: 10 },
        { text: 'Check for hidden data in the image metadata', cost: 20 },
      ],
    },
    {
      title: 'AI prompt injection',
      difficulty: 'medium',
      description: 'An AI chatbot guards the flag. Can you make it reveal the secret?',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Try ignoring previous instructions', cost: 20 },
        { text: 'Ask it to repeat its system prompt', cost: 35 },
      ],
    },
  ],

  osint: [
    {
      title: 'Find the person',
      difficulty: 'easy',
      description: 'Given only a username, find the real name and city of this person.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Check their social media profiles', cost: 10 },
        { text: 'Look at their GitHub repositories for clues', cost: 20 },
      ],
    },
    {
      title: 'Trace the cryptocurrency',
      difficulty: 'hard',
      description: 'Follow the money trail through blockchain transactions to find the final destination.',
      flagFormat: 'flag\\{.*\\}',
      hints: [
        { text: 'Use blockchain explorers like etherscan', cost: 30 },
        { text: 'Follow the transaction graph', cost: 50 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Challenge generator
// ---------------------------------------------------------------------------

class ChallengeGenerator {
  /**
   * @param {Object} options
   * @param {string} options.flagPrefix - Flag prefix (default: 'flag{')
   * @param {string} options.flagSuffix - Flag suffix (default: '}')
   * @param {number} options.maxSolves - Max solves before point decay (default: 50)
   * @param {number} options.decayRate - Point decay rate per solve (default: 0.02)
   */
  constructor(options = {}) {
    this.flagPrefix = options.flagPrefix || 'flag{';
    this.flagSuffix = options.flagSuffix || '}';
    this.maxSolves = options.maxSolves || 50;
    this.decayRate = options.decayRate || 0.02;
    this._idCounter = 0;
  }

  /**
   * Generate a random flag string.
   * @returns {string}
   */
  generateFlag() {
    const random = randomBytes(16).toString('hex');
    return `${this.flagPrefix}${random}${this.flagSuffix}`;
  }

  /**
   * Generate a challenge from a template.
   * @param {string} category - Challenge category
   * @param {string} [difficulty] - Optional difficulty override
   * @returns {GeneratedChallenge}
   */
  generate(category, difficulty) {
    const templates = TEMPLATES[category];
    if (!templates || templates.length === 0) {
      throw new Error(`No templates for category: ${category}`);
    }

    // Filter by difficulty if specified
    let pool = templates;
    if (difficulty) {
      pool = templates.filter(t => t.difficulty === difficulty);
      if (pool.length === 0) pool = templates;
    }

    const template = pool[Math.floor(Math.random() * pool.length)];
    const diff = template.difficulty;
    const points = DIFFICULTY_POINTS[diff];

    this._idCounter++;
    const id = `challenge_${this._idCounter}_${randomBytes(4).toString('hex')}`;

    return {
      id,
      title: template.title,
      category,
      difficulty: diff,
      description: template.description,
      flag: this.generateFlag(),
      flagFormat: template.flagFormat,
      basePoints: points.base,
      dynamicPoints: points.base,
      hints: template.hints.map(h => ({
        text: h.text,
        cost: h.cost,
        revealed: false,
      })),
      tags: [category, diff],
      createdAt: new Date().toISOString(),
      solveCount: 0,
      maxSolves: this.maxSolves,
    };
  }

  /**
   * Generate a full CTF set with balanced categories.
   * @param {number} totalChallenges - Total challenges to generate
   * @returns {GeneratedChallenge[]}
   */
  generateSet(totalChallenges = 30) {
    const categories = Object.keys(TEMPLATES);
    const challenges = [];
    
    // Distribute evenly across categories
    const perCategory = Math.floor(totalChallenges / categories.length);
    const remainder = totalChallenges % categories.length;
    
    let catIndex = 0;
    for (let i = 0; i < totalChallenges; i++) {
      const category = categories[catIndex % categories.length];
      catIndex++;
      
      // Balance difficulties within category
      const difficulties = ['easy', 'medium', 'hard'];
      const diffIndex = challenges.filter(c => c.category === category).length;
      const diff = difficulties[diffIndex % difficulties.length];
      challenges.push(this.generate(category, diff));
    }
    
    return challenges;
  }

  /**
   * Calculate dynamic points based on solve count.
   * Points decay as more teams solve the challenge.
   * @param {GeneratedChallenge} challenge
   * @returns {number}
   */
  calculateDynamicPoints(challenge) {
    const { basePoints, solveCount, maxSolves } = challenge;
    const decay = Math.floor(basePoints * this.decayRate * solveCount);
    const minPoints = Math.floor(basePoints * 0.1);
    return Math.max(minPoints, basePoints - decay);
  }

  /**
   * Submit a flag for a challenge.
   * @param {GeneratedChallenge} challenge
   * @param {string} submittedFlag
   * @returns {{correct: boolean, points: number, message: string}}
   */
  submitFlag(challenge, submittedFlag) {
    // Normalize flag
    const normalized = submittedFlag.trim().toLowerCase();
    const expected = challenge.flag.toLowerCase();
    
    if (normalized === expected) {
      const points = this.calculateDynamicPoints(challenge);
      challenge.solveCount++;
      return {
        correct: true,
        points,
        message: `Correct! +${points} points`,
      };
    }
    
    return {
      correct: false,
      points: 0,
      message: 'Incorrect flag',
    };
  }

  /**
   * Reveal a hint for a challenge.
   * @param {GeneratedChallenge} challenge
   * @param {number} hintIndex
   * @param {number} currentPoints
   * @returns {{hint: string|null, cost: number, newPoints: number}}
   */
  revealHint(challenge, hintIndex, currentPoints) {
    if (hintIndex < 0 || hintIndex >= challenge.hints.length) {
      return { hint: null, cost: 0, newPoints: currentPoints };
    }

    const hint = challenge.hints[hintIndex];
    if (hint.revealed) {
      return { hint: hint.text, cost: 0, newPoints: currentPoints };
    }

    hint.revealed = true;
    const newPoints = Math.max(0, currentPoints - hint.cost);
    return { hint: hint.text, cost: hint.cost, newPoints };
  }
}

export {
  ChallengeGenerator,
  TEMPLATES,
  DIFFICULTY_POINTS,
};
