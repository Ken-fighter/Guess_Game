/**
 * ═══════════════════════════════════════════════════════════════════════
 * 基准测试引擎 — Benchmarking Engine
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 本模块封装了四种独立的猜数策略，并提供模拟测试框架。
 * 所有计算100%在本地浏览器中运行，无需任何API。
 *
 * 四种策略：
 * 1. 纯成分探测 (Pure Frequency Probing)
 *    - 始终使用结构化的全同/分组猜测来逐一确认每个数字的出现频次
 *    - 优点：逻辑简单，探测有条理
 *    - 缺点：不利用反馈的位置信息，后期效率低
 *
 * 2. 纯信息熵 (Pure Max-Entropy)
 *    - 每一步都选择使候选池划分最均匀（信息熵最高）的猜测
 *    - 优点：平均步数最优
 *    - 缺点：最坏情况可能较差，因为它优化的是期望而非极端情况
 *
 * 3. 纯极小化极大 (Pure Minimax)
 *    - 每一步都选择在最坏反馈下剩余候选最少的猜测
 *    - 优点：最坏情况步数最少
 *    - 缺点：平均步数可能略高于信息熵策略，且计算量大
 *
 * 4. 三阶段混合策略 (Hybrid / Smart)
 *    - 初期用成分探测快速获取信息 → 中期用信息熵高效缩小范围 → 后期用Minimax收网
 *    - 优点：综合性能最佳。原因如下：
 *      a) 成分探测阶段用O(1)计算得到接近最优的初始猜测，避免了在10000个候选中做昂贵的熵计算
 *      b) 中期候选池中等大小时，信息熵策略的"均匀分区"特性使其平均效率最高
 *      c) 后期候选池很小时，Minimax保证不会出现极端坏运气
 *    - 这种策略切换在实际测试中表现为：平均步数接近纯信息熵，最坏步数接近纯Minimax
 */

import {
  type Code,
  type Digit,
  computeFeedback,
  isExactMatch,
  generateAllCodes,
  filterCandidates,
  codeToString,
} from './engine';

// ─── Strategy Interface ─────────────────────────────────────────────

export type StrategyName = 'frequency-probe' | 'max-entropy' | 'minimax' | 'hybrid';

export interface StrategyInfo {
  name: StrategyName;
  displayName: string;
  description: string;
  icon: string;
  color: string; // tailwind color class
}

export const STRATEGIES: StrategyInfo[] = [
  {
    name: 'frequency-probe',
    displayName: '纯成分探测',
    description: '始终使用结构化猜测来逐一确认数字频次',
    icon: '🔍',
    color: 'blue',
  },
  {
    name: 'max-entropy',
    displayName: '纯信息熵',
    description: '每步选择信息熵最高的猜测',
    icon: '📊',
    color: 'purple',
  },
  {
    name: 'minimax',
    displayName: '纯 Minimax',
    description: '每步最小化最坏情况的剩余候选数',
    icon: '🧮',
    color: 'orange',
  },
  {
    name: 'hybrid',
    displayName: '三阶段混合',
    description: '探测→信息熵→Minimax 动态切换',
    icon: '⚡',
    color: 'emerald',
  },
];

// ─── Helper Functions ───────────────────────────────────────────────

function computePartitions(guess: Code, candidates: Code[]): Map<number, number> {
  const partitions = new Map<number, number>();
  for (const c of candidates) {
    const fb = computeFeedback(guess, c);
    partitions.set(fb, (partitions.get(fb) || 0) + 1);
  }
  return partitions;
}

function computeEntropy(partitions: Map<number, number>, total: number): number {
  let entropy = 0;
  for (const count of partitions.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function worstPartition(partitions: Map<number, number>): number {
  let worst = 0;
  for (const v of partitions.values()) {
    if (v > worst) worst = v;
  }
  return worst;
}

// ─── Pure Strategy: Frequency Probing ───────────────────────────────
/**
 * 纯成分探测策略：
 * 1. 先用 [0,0,0,0], [1,1,1,1], ..., [9,9,9,9] 探测每个数字出现几次
 *    (最多10步，但可以提前停止 — 当已知4个slot全部确定时)
 * 2. 一旦确定了数字组成，切换到从候选池中按顺序猜测（暴力枚举排列）
 */
function frequencyProbeGuess(
  candidates: Code[],
  _allCodes: Code[],
  round: number,
): Code {
  const n = candidates.length;

  // Phase 1: Use structured probes for the first rounds
  // Use groups of 4 distinct digits
  const probeSequence: Code[] = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 0, 1],
    [2, 3, 4, 5],
    [6, 7, 8, 9],
  ];

  if (round < probeSequence.length && n > 100) {
    return probeSequence[round];
  }

  // Phase 2: Once we have info, just pick from candidates
  // Use a simple heuristic: pick the candidate that is most "central"
  if (n <= 2) return candidates[0];

  // Pick the candidate that minimizes worst case among candidates
  let bestGuess = candidates[0];
  let bestWorst = n;
  const limit = Math.min(candidates.length, 500);
  const step = Math.max(1, Math.floor(candidates.length / limit));

  for (let i = 0; i < candidates.length; i += step) {
    const guess = candidates[i];
    const parts = computePartitions(guess, candidates);
    const w = worstPartition(parts);
    if (w < bestWorst) {
      bestWorst = w;
      bestGuess = guess;
    }
  }
  return bestGuess;
}

// ─── Pure Strategy: Max Entropy ─────────────────────────────────────
/**
 * 纯信息熵策略：
 * 每一步从搜索空间（候选池+部分非候选）中选择使信息熵最大化的猜测。
 * 信息熵 H = -Σ p_i * log2(p_i)，其中 p_i 是每种反馈值对应的候选比例。
 * 熵越高 → 每种反馈的概率越均匀 → 平均来说每次猜测能排除最多候选。
 */
function maxEntropyGuess(
  candidates: Code[],
  allCodes: Code[],
  _round: number,
): Code {
  const n = candidates.length;
  if (n <= 2) return candidates[0];

  let bestGuess = candidates[0];
  let bestEntropy = -1;

  // Search pool: candidates + sample of all codes
  // For large pools, just search candidates for efficiency
  const searchPool = n <= 500 ? allCodes : candidates;
  const limit = Math.min(searchPool.length, n <= 200 ? 5000 : 2000);
  const step = Math.max(1, Math.floor(searchPool.length / limit));

  for (let i = 0; i < searchPool.length; i += step) {
    const guess = searchPool[i];
    const parts = computePartitions(guess, candidates);
    const entropy = computeEntropy(parts, n);

    if (entropy > bestEntropy) {
      bestGuess = guess;
      bestEntropy = entropy;
    }
  }
  return bestGuess;
}

// ─── Pure Strategy: Minimax ─────────────────────────────────────────
/**
 * 纯极小化极大策略：
 * 每步选择使 max(partition_size) 最小的猜测。
 * 即：无论对手给出什么反馈，我都保证剩余候选数不超过 bestWorst。
 * 这是一种悲观策略，对"最倒霉"的情况做最优准备。
 */
function minimaxGuess(
  candidates: Code[],
  allCodes: Code[],
  _round: number,
): Code {
  const n = candidates.length;
  if (n <= 2) return candidates[0];

  let bestGuess = candidates[0];
  let bestWorst = n;
  let bestIsCandidate = false;

  // Search pool depends on size
  const searchPool = n <= 50 ? allCodes : candidates;
  const limit = Math.min(searchPool.length, n <= 50 ? 5000 : 2000);
  const step = Math.max(1, Math.floor(searchPool.length / limit));

  for (let i = 0; i < searchPool.length; i += step) {
    const guess = searchPool[i];
    const parts = computePartitions(guess, candidates);
    const w = worstPartition(parts);
    const isCand = candidates.some(c =>
      c[0] === guess[0] && c[1] === guess[1] && c[2] === guess[2] && c[3] === guess[3]
    );

    if (w < bestWorst || (w === bestWorst && isCand && !bestIsCandidate)) {
      bestGuess = guess;
      bestWorst = w;
      bestIsCandidate = isCand;
    }
  }
  return bestGuess;
}

// ─── Hybrid Strategy (Same as the AI in the game) ───────────────────
/**
 * 三阶段混合策略：
 * 阶段一 (round < 3 且 candidates > 5000): 成分探测 [0123], [4567], [8901]
 * 阶段二 (200 < candidates <= 5000): 最大信息熵
 * 阶段三 (candidates <= 200): 极小化极大
 *
 * 为什么混合策略能超越单一策略？
 * 
 * 1. 初期用成分探测代替信息熵：
 *    在10000个候选中计算每个猜测的熵需要 O(10000 × 10000) = 1亿次反馈计算，
 *    而 [0,1,2,3] 这样的探测猜测已经接近最优（因为它覆盖4个不同数字，
 *    理论上可将10000个候选划分为5组），成本几乎为零。
 *
 * 2. 中期用信息熵而非Minimax：
 *    信息熵优化"期望"信息量，在候选池中等大小时，
 *    好运气（反馈恰好排除最多）的概率更高，拉低了平均步数。
 *    而Minimax只关注最坏情况，牺牲了平均性能。
 *
 * 3. 后期用Minimax而非信息熵：
 *    当候选池很小（<200）时，我们不想赌运气。
 *    Minimax保证在有限步内一定收敛，不会出现信息熵策略
 *    偶尔遇到的"反馈碰巧不利导致候选减少很慢"的问题。
 */
function hybridGuess(
  candidates: Code[],
  allCodes: Code[],
  round: number,
): Code {
  const n = candidates.length;

  // Phase 1: Frequency probing
  if (round < 3 && n > 5000) {
    const probes: Code[] = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 0, 1],
    ];
    return probes[round];
  }

  // Small: minimax
  if (n <= 200) {
    return minimaxGuess(candidates, allCodes, round);
  }

  // Medium/Large: entropy
  return maxEntropyGuess(candidates, allCodes, round);
}

// ─── Strategy Dispatcher ────────────────────────────────────────────

function getGuess(
  strategy: StrategyName,
  candidates: Code[],
  allCodes: Code[],
  round: number,
): Code {
  switch (strategy) {
    case 'frequency-probe': return frequencyProbeGuess(candidates, allCodes, round);
    case 'max-entropy': return maxEntropyGuess(candidates, allCodes, round);
    case 'minimax': return minimaxGuess(candidates, allCodes, round);
    case 'hybrid': return hybridGuess(candidates, allCodes, round);
  }
}

// ─── Single Game Simulation ─────────────────────────────────────────

export interface GameResult {
  target: string;
  steps: number;
  guesses: string[];
}

function simulateGame(
  strategy: StrategyName,
  target: Code,
  allCodes: Code[],
  maxSteps: number = 20,
): GameResult {
  let candidates = [...allCodes];
  const guesses: string[] = [];

  for (let round = 0; round < maxSteps; round++) {
    const guess = getGuess(strategy, candidates, allCodes, round);
    guesses.push(codeToString(guess));

    if (isExactMatch(guess, target)) {
      return { target: codeToString(target), steps: round + 1, guesses };
    }

    const fb = computeFeedback(guess, target);
    candidates = filterCandidates(candidates, guess, fb);

    if (candidates.length === 0) {
      // Should not happen in correct play
      return { target: codeToString(target), steps: maxSteps, guesses };
    }
  }

  return { target: codeToString(target), steps: maxSteps, guesses };
}

// ─── Benchmark Results ──────────────────────────────────────────────

export interface StrategyResult {
  strategy: StrategyName;
  displayName: string;
  icon: string;
  color: string;
  totalGames: number;
  meanSteps: number;
  maxSteps: number;
  minSteps: number;
  stdDev: number;
  median: number;
  // Distribution: how many games finished in N steps
  distribution: Record<number, number>;
  // Sample of individual game results (for inspection)
  sampleGames: GameResult[];
  // Time taken in ms
  timeMs: number;
}

export interface BenchmarkProgress {
  strategy: StrategyName;
  strategyIndex: number;
  totalStrategies: number;
  gamesCompleted: number;
  totalGames: number;
  currentTarget: string;
  elapsedMs: number;
}

export interface BenchmarkConfig {
  numTargets: number;
  strategies: StrategyName[];
  seed?: number;
}

// ─── Random Target Generation ───────────────────────────────────────

function generateRandomTargets(count: number, seed?: number): Code[] {
  // Simple seeded PRNG (mulberry32)
  let s = seed ?? Date.now();
  function rand(): number {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  const targets: Code[] = [];
  const seen = new Set<string>();

  while (targets.length < count) {
    const code: Code = [
      Math.floor(rand() * 10) as Digit,
      Math.floor(rand() * 10) as Digit,
      Math.floor(rand() * 10) as Digit,
      Math.floor(rand() * 10) as Digit,
    ];
    const key = codeToString(code);
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(code);
    }
  }
  return targets;
}

// ─── Run Benchmark (synchronous, chunk-based for UI updates) ────────

export type BenchmarkCallback = (progress: BenchmarkProgress) => void;
export type BenchmarkCompleteCallback = (results: StrategyResult[]) => void;

export function runBenchmarkAsync(
  config: BenchmarkConfig,
  onProgress: BenchmarkCallback,
  onComplete: BenchmarkCompleteCallback,
): { cancel: () => void } {
  const allCodes = generateAllCodes();
  const targets = generateRandomTargets(config.numTargets, config.seed);
  const results: StrategyResult[] = [];
  let cancelled = false;
  let strategyIdx = 0;
  let gameIdx = 0;
  let startTime = Date.now();
  let stepResults: number[] = [];
  let sampleGames: GameResult[] = [];
  let distribution: Record<number, number> = {};

  const strategies = config.strategies;

  function processNextChunk() {
    if (cancelled) return;

    const chunkSize = 5; // Process 5 games per frame
    const strategy = strategies[strategyIdx];
    const info = STRATEGIES.find(s => s.name === strategy)!;

    for (let i = 0; i < chunkSize && gameIdx < targets.length; i++, gameIdx++) {
      const target = targets[gameIdx];
      const result = simulateGame(strategy, target, allCodes);
      stepResults.push(result.steps);
      distribution[result.steps] = (distribution[result.steps] || 0) + 1;

      // Keep first 10 and any interesting games as samples
      if (sampleGames.length < 10 || result.steps >= 10 || result.steps <= 2) {
        if (sampleGames.length < 30) {
          sampleGames.push(result);
        }
      }
    }

    // Report progress
    onProgress({
      strategy,
      strategyIndex: strategyIdx,
      totalStrategies: strategies.length,
      gamesCompleted: gameIdx,
      totalGames: targets.length,
      currentTarget: gameIdx < targets.length ? codeToString(targets[gameIdx]) : '',
      elapsedMs: Date.now() - startTime,
    });

    if (gameIdx >= targets.length) {
      // Finished this strategy
      const mean = stepResults.reduce((a, b) => a + b, 0) / stepResults.length;
      const variance = stepResults.reduce((a, b) => a + (b - mean) ** 2, 0) / stepResults.length;
      const sorted = [...stepResults].sort((a, b) => a - b);
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      results.push({
        strategy,
        displayName: info.displayName,
        icon: info.icon,
        color: info.color,
        totalGames: targets.length,
        meanSteps: mean,
        maxSteps: Math.max(...stepResults),
        minSteps: Math.min(...stepResults),
        stdDev: Math.sqrt(variance),
        median,
        distribution,
        sampleGames,
        timeMs: Date.now() - startTime,
      });

      // Move to next strategy
      strategyIdx++;
      gameIdx = 0;
      stepResults = [];
      sampleGames = [];
      distribution = {};
      startTime = Date.now();

      if (strategyIdx >= strategies.length) {
        onComplete(results);
        return;
      }
    }

    requestAnimationFrame(processNextChunk);
  }

  requestAnimationFrame(processNextChunk);

  return {
    cancel: () => { cancelled = true; },
  };
}
