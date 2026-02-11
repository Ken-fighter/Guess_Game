// Game Engine for 4-digit number guessing game
// ALL ALGORITHMS ARE LOCAL — NO API OR NETWORK NEEDED
// Feedback is based on multiset intersection cardinality

export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Code = [Digit, Digit, Digit, Digit];

// ─── Core Functions ─────────────────────────────────────────────────

export function computeFeedback(guess: Code, target: Code): number {
  const gCount = new Array(10).fill(0);
  const tCount = new Array(10).fill(0);
  for (let i = 0; i < 4; i++) {
    gCount[guess[i]]++;
    tCount[target[i]]++;
  }
  let match = 0;
  for (let d = 0; d < 10; d++) {
    match += Math.min(gCount[d], tCount[d]);
  }
  return match;
}

export function isExactMatch(guess: Code, target: Code): boolean {
  return guess.every((d, i) => d === target[i]);
}

export function generateAllCodes(): Code[] {
  const codes: Code[] = [];
  for (let a = 0; a <= 9; a++)
    for (let b = 0; b <= 9; b++)
      for (let c = 0; c <= 9; c++)
        for (let d = 0; d <= 9; d++)
          codes.push([a as Digit, b as Digit, c as Digit, d as Digit]);
  return codes;
}

export function filterCandidates(candidates: Code[], guess: Code, feedback: number): Code[] {
  return candidates.filter(c => computeFeedback(guess, c) === feedback);
}

export function codeToString(code: Code): string {
  return code.join('');
}

export function stringToCode(s: string): Code | null {
  if (s.length !== 4) return null;
  const digits = s.split('').map(Number);
  if (digits.some(d => isNaN(d) || d < 0 || d > 9)) return null;
  return digits as unknown as Code;
}

// ─── Knowledge State ────────────────────────────────────────────────
// Tracks what we know about each digit's frequency in the target

export interface DigitKnowledge {
  digit: number;
  // How many times this digit appears in the target
  // null means unknown, a number means confirmed count
  confirmedCount: number | null;
  // The minimum count we know this digit appears
  minCount: number;
  // The maximum count this digit could appear
  maxCount: number;
}

export interface KnowledgeState {
  digits: DigitKnowledge[];
  // Confirmed digits (we know they appear at least once)
  confirmedDigits: number[];
  // Eliminated digits (we know they appear 0 times)
  eliminatedDigits: number[];
  // Digits with uncertain status
  unknownDigits: number[];
  // Total confirmed digit slots filled (sum of confirmed counts)
  confirmedSlots: number;
  // Remaining slots to figure out
  remainingSlots: number;
  // Do we know all 4 digit slots (composition known)?
  compositionKnown: boolean;
  // Summary text
  summary: string;
}

function analyzeKnowledge(history: GameRound[]): KnowledgeState {
  // We build knowledge from all past guesses and their feedback
  const digits: DigitKnowledge[] = [];
  for (let d = 0; d <= 9; d++) {
    digits.push({
      digit: d,
      confirmedCount: null,
      minCount: 0,
      maxCount: 4,
    });
  }

  // Process each round to extract frequency information
  for (const round of history) {
    const guess = round.guess;
    const fb = round.feedback;
    if (fb === null) continue;

    // Count digits in this guess
    const guessCount = new Array(10).fill(0);
    for (let i = 0; i < 4; i++) guessCount[guess[i]]++;

    // Special case: all-same-digit guesses (like 0000, 1111, etc.)
    const uniqueDigitsInGuess = guessCount.filter(c => c > 0).length;
    
    if (uniqueDigitsInGuess === 1) {
      // e.g., guessing 3333, feedback=2 means target has exactly 2 threes
      const d = guess[0];
      digits[d].confirmedCount = fb;
      digits[d].minCount = fb;
      digits[d].maxCount = fb;
    }
    // For mixed guesses, we can derive bounds
    // The feedback tells us the total multiset intersection
    // For each digit d in the guess: contribution = min(guessCount[d], targetCount[d])
    // Sum of contributions = fb
    
    // We can set lower bounds: each digit contributes at least 0
    // We can set upper bounds: each digit contributes at most guessCount[d]
  }

  // Cross-reference constraints: sum of all digit counts in target must be exactly 4
  // If we know some counts, we can bound others
  let knownSum = 0;
  let unknownCount = 0;
  for (let d = 0; d <= 9; d++) {
    if (digits[d].confirmedCount !== null) {
      knownSum += digits[d].confirmedCount!;
    } else {
      unknownCount++;
    }
  }
  const remainingSlots = 4 - knownSum;

  // If all remaining slots are 0, unknown digits must all be 0
  if (remainingSlots === 0) {
    for (let d = 0; d <= 9; d++) {
      if (digits[d].confirmedCount === null) {
        digits[d].confirmedCount = 0;
        digits[d].minCount = 0;
        digits[d].maxCount = 0;
      }
    }
  }

  // Update maxCount for unknowns based on remaining slots
  for (let d = 0; d <= 9; d++) {
    if (digits[d].confirmedCount === null) {
      digits[d].maxCount = Math.min(digits[d].maxCount, remainingSlots);
    }
  }

  const confirmedDigits: number[] = [];
  const eliminatedDigits: number[] = [];
  const unknownDigits: number[] = [];

  for (let d = 0; d <= 9; d++) {
    if (digits[d].confirmedCount !== null) {
      if (digits[d].confirmedCount! > 0) confirmedDigits.push(d);
      else eliminatedDigits.push(d);
    } else if (digits[d].maxCount === 0) {
      eliminatedDigits.push(d);
      digits[d].confirmedCount = 0;
    } else {
      unknownDigits.push(d);
    }
  }

  const compositionKnown = unknownDigits.length === 0 && remainingSlots === 0;
  const confirmedSlots = knownSum;

  // Build summary
  let summary = '';
  if (confirmedDigits.length > 0) {
    const parts = confirmedDigits.map(d => {
      const count = digits[d].confirmedCount!;
      return `${d}×${count}`;
    });
    summary += `✅ 已确认: ${parts.join(', ')}`;
  }
  if (eliminatedDigits.length > 0) {
    summary += `  ❌ 已排除: ${eliminatedDigits.join(', ')}`;
  }
  if (unknownDigits.length > 0) {
    summary += `  ❓ 待确认: ${unknownDigits.join(', ')}`;
  }
  if (compositionKnown) {
    summary += '  🎯 成分已完全确定！现在需要确定排列顺序';
  }

  return {
    digits,
    confirmedDigits,
    eliminatedDigits,
    unknownDigits,
    confirmedSlots,
    remainingSlots: 4 - confirmedSlots,
    compositionKnown,
    summary,
  };
}

// ─── Detailed Analysis ──────────────────────────────────────────────

export interface DetailedAnalysis {
  strategy: string;
  strategyName: string;
  candidatesRemaining: number;
  candidatesBefore: number;
  expectedReduction: number;
  worstCaseRemaining: number;
  bestCaseRemaining: number;
  partitions: Record<number, number>;
  knowledge: KnowledgeState;
  // Detailed reasoning steps
  reasoning: string[];
  // Why this specific guess was chosen
  guessRationale: string;
  // What each possible feedback would tell us
  feedbackPreview: { feedback: number; remaining: number; meaning: string }[];
  // Phase description
  phase: string;
  phaseDescription: string;
  // Position analysis (if in permutation phase)
  positionClues: string[];
}

export interface GameRound {
  round: number;
  guess: Code;
  feedback: number | null;
  analysis: DetailedAnalysis;
  isCorrect: boolean;
}

// ─── Strategy Functions ─────────────────────────────────────────────

function computePartitions(guess: Code, candidates: Code[]): Record<number, number> {
  const partitions: Record<number, number> = {};
  for (const c of candidates) {
    const fb = computeFeedback(guess, c);
    partitions[fb] = (partitions[fb] || 0) + 1;
  }
  return partitions;
}

function computeEntropy(partitions: Record<number, number>, total: number): number {
  let entropy = 0;
  for (const count of Object.values(partitions)) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function buildFeedbackPreview(guess: Code, candidates: Code[]): DetailedAnalysis['feedbackPreview'] {
  const partitions = computePartitions(guess, candidates);
  const preview: DetailedAnalysis['feedbackPreview'][] = [];
  const result: DetailedAnalysis['feedbackPreview'] = [];

  for (let fb = 0; fb <= 4; fb++) {
    const remaining = partitions[fb] || 0;
    if (remaining === 0) continue;
    let meaning = '';
    switch (fb) {
      case 0:
        meaning = `目标中不含猜测里的任何数字`;
        break;
      case 1:
        meaning = `有1个数字匹配（考虑重复次数）`;
        break;
      case 2:
        meaning = `有2个数字匹配`;
        break;
      case 3:
        meaning = `有3个数字匹配`;
        break;
      case 4:
        meaning = `所有4个数字都匹配（但位置可能不对）`;
        break;
    }
    result.push({ feedback: fb, remaining, meaning });
  }
  void preview;
  return result;
}

function analyzePositionClues(history: GameRound[], candidates: Code[]): string[] {
  const clues: string[] = [];
  if (candidates.length > 100) return clues;

  // Analyze what positions we might know
  for (let pos = 0; pos < 4; pos++) {
    const possibleDigits = new Set<number>();
    for (const c of candidates) {
      possibleDigits.add(c[pos]);
    }
    if (possibleDigits.size === 1) {
      const d = [...possibleDigits][0];
      clues.push(`第${pos + 1}位已锁定为 ${d}`);
    } else if (possibleDigits.size <= 3) {
      clues.push(`第${pos + 1}位可能是 ${[...possibleDigits].sort().join('/')}`);
    } else {
      clues.push(`第${pos + 1}位有 ${possibleDigits.size} 种可能`);
    }
  }
  void history;
  return clues;
}

// ─── Smart AI Solver ────────────────────────────────────────────────

export function getSmartGuess(
  candidates: Code[],
  allCodes: Code[],
  round: number,
  history: GameRound[]
): { guess: Code; analysis: DetailedAnalysis } {
  const n = candidates.length;
  const knowledge = analyzeKnowledge(history);
  const positionClues = analyzePositionClues(history, candidates);
  const reasoning: string[] = [];

  // ── Direct / unique solution ──────────────────
  if (n <= 1) {
    const guess = candidates[0] || [0, 0, 0, 0] as Code;
    reasoning.push(`仅剩1个候选解，直接验证答案。`);
    return {
      guess,
      analysis: {
        strategy: 'unique-solution',
        strategyName: '唯一解验证',
        candidatesRemaining: n,
        candidatesBefore: n,
        expectedReduction: 0,
        worstCaseRemaining: n === 1 ? 1 : 0,
        bestCaseRemaining: n === 1 ? 1 : 0,
        partitions: { 4: 1 },
        knowledge,
        reasoning,
        guessRationale: `只剩下唯一的可能性 ${codeToString(guess)}，直接验证！`,
        feedbackPreview: [{ feedback: 4, remaining: 1, meaning: '这就是答案！' }],
        phase: '终局验证',
        phaseDescription: '仅剩唯一候选解',
        positionClues,
      }
    };
  }

  if (n === 2) {
    const guess = candidates[0];
    reasoning.push(`仅剩2个候选解: ${codeToString(candidates[0])} 和 ${codeToString(candidates[1])}`);
    reasoning.push(`先猜第一个，如果不对就知道是第二个。`);
    return {
      guess,
      analysis: {
        strategy: 'direct',
        strategyName: '二选一',
        candidatesRemaining: n,
        candidatesBefore: n,
        expectedReduction: 1,
        worstCaseRemaining: 1,
        bestCaseRemaining: 1,
        partitions: computePartitions(guess, candidates),
        knowledge,
        reasoning,
        guessRationale: `只剩2个候选解，先试 ${codeToString(guess)}，不对就是另一个。`,
        feedbackPreview: buildFeedbackPreview(guess, candidates),
        phase: '终局验证',
        phaseDescription: '仅剩2个候选解，最多再猜1次',
        positionClues,
      }
    };
  }

  // ── Phase 1: Frequency probing (first few rounds) ──────────────────
  if (round < 3 && n > 5000) {
    const probes: Code[] = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 0, 1],
    ];
    const guess = probes[round];
    const partitions = computePartitions(guess, candidates);
    const preview = buildFeedbackPreview(guess, candidates);

    if (round === 0) {
      reasoning.push(`游戏开始！总共有 10,000 种可能的4位数字。`);
      reasoning.push(`第一步策略：使用"成分探测"来快速了解目标中包含哪些数字。`);
      reasoning.push(`猜测 0123 —— 这覆盖了数字 0、1、2、3 四个数字。`);
      reasoning.push(`如果反馈为 k，就意味着目标中有 k 个数字属于 {0,1,2,3}。`);
      reasoning.push(`这一步可以帮我们初步判断目标由哪些"数字区间"组成。`);
    } else if (round === 1) {
      reasoning.push(`根据上一轮的信息，现在探测 4、5、6、7。`);
      reasoning.push(`结合第一轮 [0,1,2,3] 的结果，我们可以推断更多。`);
      reasoning.push(`两轮探测后，我们对10个数字中的8个在目标中出现的可能性有了认识。`);
    } else {
      reasoning.push(`第三轮探测：使用 [8,9,0,1] 交叉验证。`);
      reasoning.push(`这和第一轮有2个数字重叠(0,1)，可以通过差值推断出8、9的信息。`);
      reasoning.push(`三轮探测后，我们应该对目标的数字组成有了比较全面的了解。`);
    }

    return {
      guess,
      analysis: {
        strategy: 'frequency-probe',
        strategyName: '成分探测',
        candidatesRemaining: n,
        candidatesBefore: n,
        expectedReduction: 0,
        worstCaseRemaining: Math.max(...Object.values(partitions)),
        bestCaseRemaining: Math.min(...Object.values(partitions)),
        partitions,
        knowledge,
        reasoning,
        guessRationale: `使用结构化探测 [${codeToString(guess)}] 来快速获取数字频率信息。覆盖数字 ${[...new Set(guess)].sort().join(',')}。`,
        feedbackPreview: preview,
        phase: '第一阶段：成分探测',
        phaseDescription: `通过有结构的猜测快速了解目标中包含哪些数字。这比随机猜测效率高很多。`,
        positionClues: [],
      }
    };
  }

  // ── Determine strategy based on candidate pool size ──────────────

  // Phase 3: Small pool — use full minimax
  if (n <= 200) {
    reasoning.push(`候选池已缩小到 ${n} 个，进入精确推理阶段。`);
    reasoning.push(`使用"极小化极大"(Minimax)策略：遍历所有可能的猜测，找到在最坏情况下剩余候选最少的猜测。`);

    if (knowledge.compositionKnown) {
      reasoning.push(`数字成分已完全确定！现在的任务是确定排列顺序。`);
      reasoning.push(`剩余 ${n} 种排列可能，通过 Minimax 可在 2-3 次内锁定。`);
    }

    let bestGuess = candidates[0];
    let bestWorst = n;
    let bestBest = n;
    let bestPartitions: Record<number, number> = {};
    let bestIsCandidate = true;

    // Try all candidates + sample from all codes
    const searchPool = n <= 50 ? allCodes : candidates;
    const limit = Math.min(searchPool.length, n <= 50 ? 10000 : 5000);
    const step = Math.max(1, Math.floor(searchPool.length / limit));

    for (let i = 0; i < searchPool.length; i += step) {
      const guess = searchPool[i];
      const partitions = computePartitions(guess, candidates);
      const values = Object.values(partitions);
      const worstCase = Math.max(...values);
      const bestCase = Math.min(...values);
      const isCandidate = candidates.some(c =>
        c[0] === guess[0] && c[1] === guess[1] && c[2] === guess[2] && c[3] === guess[3]
      );

      if (worstCase < bestWorst || (worstCase === bestWorst && isCandidate && !bestIsCandidate)) {
        bestGuess = guess;
        bestWorst = worstCase;
        bestBest = bestCase;
        bestPartitions = partitions;
        bestIsCandidate = isCandidate;
      }
    }

    const numPartitions = Object.keys(bestPartitions).length;
    reasoning.push(`找到最优猜测 ${codeToString(bestGuess)}：将候选池分成 ${numPartitions} 组。`);
    reasoning.push(`最坏情况下剩余 ${bestWorst} 个候选（从 ${n} 个减少到 ${bestWorst} 个）。`);
    if (bestIsCandidate) {
      reasoning.push(`这个猜测本身就是候选解之一 —— 如果反馈为4就直接猜中了！`);
    } else {
      reasoning.push(`注意：这个猜测不在候选池中，但它能更好地区分剩余候选。`);
    }

    return {
      guess: bestGuess,
      analysis: {
        strategy: 'minimax',
        strategyName: '极小化极大',
        candidatesRemaining: n,
        candidatesBefore: n,
        expectedReduction: n - bestWorst,
        worstCaseRemaining: bestWorst,
        bestCaseRemaining: bestBest,
        partitions: bestPartitions,
        knowledge,
        reasoning,
        guessRationale: `在 ${n} 个候选解中，${codeToString(bestGuess)} 的"最大分区"最小(${bestWorst})，保证最坏情况下仍能最大幅度缩小范围。` +
          (bestIsCandidate ? ` 而且它是候选解之一，有机会直接命中！` : ''),
        feedbackPreview: buildFeedbackPreview(bestGuess, candidates),
        phase: knowledge.compositionKnown ? '第三阶段：排列验证' : '第二阶段：精确收网',
        phaseDescription: knowledge.compositionKnown
          ? `数字成分已确定，现在逐步锁定每个位置的数字。`
          : `候选池较小，使用 Minimax 确保每次都能最大程度缩小范围。`,
        positionClues,
      }
    };
  }

  // Phase 2: Medium pool — use entropy
  if (n <= 1000) {
    reasoning.push(`候选池有 ${n} 个，使用"最大信息熵"策略。`);
    reasoning.push(`目标：找到能让候选池分割最均匀的猜测，最大化每次获取的信息量。`);

    let bestGuess = candidates[0];
    let bestEntropy = -1;
    let bestPartitions: Record<number, number> = {};
    let bestWorst = n;

    const searchPool = n <= 500 ? allCodes : candidates;
    const limit = Math.min(searchPool.length, 3000);
    const step = Math.max(1, Math.floor(searchPool.length / limit));

    for (let i = 0; i < searchPool.length; i += step) {
      const guess = searchPool[i];
      const partitions = computePartitions(guess, candidates);
      const entropy = computeEntropy(partitions, n);

      if (entropy > bestEntropy) {
        bestGuess = guess;
        bestEntropy = entropy;
        bestPartitions = partitions;
        bestWorst = Math.max(...Object.values(partitions));
      }
    }

    const numPartitions = Object.keys(bestPartitions).length;
    reasoning.push(`最佳猜测 ${codeToString(bestGuess)} 的信息熵为 ${bestEntropy.toFixed(3)} bit。`);
    reasoning.push(`可将候选池分成 ${numPartitions} 组，最大组 ${bestWorst} 个。`);
    reasoning.push(`理论最大熵为 ${Math.log2(5).toFixed(3)} bit（均匀分成5组），当前效率 ${(bestEntropy / Math.log2(5) * 100).toFixed(1)}%。`);

    return {
      guess: bestGuess,
      analysis: {
        strategy: 'max-entropy',
        strategyName: '最大信息熵',
        candidatesRemaining: n,
        candidatesBefore: n,
        expectedReduction: n - bestWorst,
        worstCaseRemaining: bestWorst,
        bestCaseRemaining: Math.min(...Object.values(bestPartitions)),
        partitions: bestPartitions,
        knowledge,
        reasoning,
        guessRationale: `在 ${n} 个候选中，${codeToString(bestGuess)} 的信息熵最高(${bestEntropy.toFixed(2)} bit)，能最均匀地划分候选池。`,
        feedbackPreview: buildFeedbackPreview(bestGuess, candidates),
        phase: '第二阶段：信息收集',
        phaseDescription: `候选池中等大小，使用最大信息熵策略，每次猜测尽可能获取最多信息。`,
        positionClues,
      }
    };
  }

  // Large pool — entropy with sampling
  reasoning.push(`候选池还很大(${n} 个)，使用采样信息熵策略。`);
  reasoning.push(`在候选解中随机采样进行信息熵评估，平衡计算效率和决策质量。`);

  let bestGuess = candidates[0];
  let bestEntropy = -1;
  let bestPartitions: Record<number, number> = {};
  let bestWorst = n;

  const limit = 2000;
  const step = Math.max(1, Math.floor(candidates.length / limit));

  for (let i = 0; i < candidates.length; i += step) {
    const guess = candidates[i];
    const partitions = computePartitions(guess, candidates);
    const entropy = computeEntropy(partitions, n);

    if (entropy > bestEntropy) {
      bestGuess = guess;
      bestEntropy = entropy;
      bestPartitions = partitions;
      bestWorst = Math.max(...Object.values(partitions));
    }
  }

  const numPartitions = Object.keys(bestPartitions).length;
  reasoning.push(`采样后最佳: ${codeToString(bestGuess)}，熵 ${bestEntropy.toFixed(3)} bit，${numPartitions} 个分区。`);

  return {
    guess: bestGuess,
    analysis: {
      strategy: 'entropy-sampled',
      strategyName: '信息熵(采样)',
      candidatesRemaining: n,
      candidatesBefore: n,
      expectedReduction: n - bestWorst,
      worstCaseRemaining: bestWorst,
      bestCaseRemaining: Math.min(...Object.values(bestPartitions)),
      partitions: bestPartitions,
      knowledge,
      reasoning,
      guessRationale: `候选池较大，采样评估后选择信息熵最高的 ${codeToString(bestGuess)}。`,
      feedbackPreview: buildFeedbackPreview(bestGuess, candidates),
      phase: '第一阶段：信息收集',
      phaseDescription: `候选池仍然很大，通过采样找到信息量最大的猜测来快速缩小范围。`,
      positionClues: [],
    }
  };
}
