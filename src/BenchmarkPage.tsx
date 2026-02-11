import { useState, useRef, useCallback } from 'react';
import {
  STRATEGIES,
  runBenchmarkAsync,
  type StrategyResult,
  type BenchmarkProgress,
  type StrategyName,
} from './benchmark';

type BenchmarkState = 'idle' | 'running' | 'done';

// ─── Distribution Chart ─────────────────────────────────────────────
function DistributionChart({ results }: { results: StrategyResult[] }) {
  // Find the range of steps across all strategies
  const allSteps = new Set<number>();
  for (const r of results) {
    for (const key of Object.keys(r.distribution)) {
      allSteps.add(Number(key));
    }
  }
  const steps = [...allSteps].sort((a, b) => a - b);
  if (steps.length === 0) return null;

  const maxCount = Math.max(
    ...results.flatMap(r => Object.values(r.distribution))
  );

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    emerald: 'bg-emerald-500',
  };

  const colorMapLight: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <span className="text-xl">📊</span>
        步数分布对比
      </h3>
      <p className="text-xs text-white/40">每种策略在各步数上完成游戏的次数</p>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {results.map(r => (
          <div key={r.strategy} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${colorMap[r.color]}`} />
            <span className={`text-xs font-medium ${colorMapLight[r.color]}`}>
              {r.icon} {r.displayName}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="space-y-2">
        {steps.map(step => (
          <div key={step} className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/40 w-8 text-right shrink-0">
              {step}步
            </span>
            <div className="flex-1 space-y-0.5">
              {results.map(r => {
                const count = r.distribution[step] || 0;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={r.strategy} className="flex items-center gap-2">
                    <div className="flex-1 h-3.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colorMap[r.color]} transition-all duration-700`}
                        style={{ width: `${Math.max(pct > 0 ? 1 : 0, pct)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-10 text-right ${count > 0 ? colorMapLight[r.color] : 'text-white/15'}`}>
                      {count > 0 ? count : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Results Table ──────────────────────────────────────────────────
function ResultsTable({ results }: { results: StrategyResult[] }) {
  const colorMapBg: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-400/20',
    purple: 'bg-purple-500/10 border-purple-400/20',
    orange: 'bg-orange-500/10 border-orange-400/20',
    emerald: 'bg-emerald-500/10 border-emerald-400/20',
  };

  const colorMapText: Record<string, string> = {
    blue: 'text-blue-300',
    purple: 'text-purple-300',
    orange: 'text-orange-300',
    emerald: 'text-emerald-300',
  };

  // Find the best in each category
  const bestMean = Math.min(...results.map(r => r.meanSteps));
  const bestMax = Math.min(...results.map(r => r.maxSteps));
  const bestStd = Math.min(...results.map(r => r.stdDev));

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <span className="text-xl">🏆</span>
        性能对比总览
      </h3>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map(r => (
          <div key={r.strategy} className={`rounded-xl p-5 border ${colorMapBg[r.color]} space-y-3`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{r.icon}</span>
              <div>
                <h4 className={`font-bold ${colorMapText[r.color]}`}>{r.displayName}</h4>
                <p className="text-xs text-white/30">{r.totalGames} 局 · {(r.timeMs / 1000).toFixed(1)}s</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className={`text-xl font-bold ${r.meanSteps === bestMean ? 'text-green-400' : 'text-white'}`}>
                  {r.meanSteps.toFixed(2)}
                </div>
                <div className="text-[10px] text-white/30">平均步数</div>
                {r.meanSteps === bestMean && <div className="text-[10px] text-green-400 font-bold">🏆 最优</div>}
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${r.maxSteps === bestMax ? 'text-green-400' : 'text-white'}`}>
                  {r.maxSteps}
                </div>
                <div className="text-[10px] text-white/30">最坏情况</div>
                {r.maxSteps === bestMax && <div className="text-[10px] text-green-400 font-bold">🏆 最优</div>}
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${r.stdDev === bestStd ? 'text-green-400' : 'text-white'}`}>
                  {r.stdDev.toFixed(2)}
                </div>
                <div className="text-[10px] text-white/30">标准差</div>
                {r.stdDev === bestStd && <div className="text-[10px] text-green-400 font-bold">🏆 最稳</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="text-white/40">最少</span>
                <span className="text-white font-bold ml-1">{r.minSteps}步</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="text-white/40">中位数</span>
                <span className="text-white font-bold ml-1">{r.median}步</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-white/40 font-medium">指标</th>
              {results.map(r => (
                <th key={r.strategy} className={`text-center py-2 px-3 font-medium ${colorMapText[r.color]}`}>
                  {r.icon} {r.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-white/70">
            <tr className="border-b border-white/5">
              <td className="py-2 px-3 text-white/50">平均步数 (Mean)</td>
              {results.map(r => (
                <td key={r.strategy} className={`text-center py-2 px-3 font-mono font-bold ${r.meanSteps === bestMean ? 'text-green-400' : ''}`}>
                  {r.meanSteps.toFixed(3)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 px-3 text-white/50">最坏情况 (Max)</td>
              {results.map(r => (
                <td key={r.strategy} className={`text-center py-2 px-3 font-mono font-bold ${r.maxSteps === bestMax ? 'text-green-400' : ''}`}>
                  {r.maxSteps}
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 px-3 text-white/50">最好情况 (Min)</td>
              {results.map(r => (
                <td key={r.strategy} className="text-center py-2 px-3 font-mono">
                  {r.minSteps}
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 px-3 text-white/50">中位数 (Median)</td>
              {results.map(r => (
                <td key={r.strategy} className="text-center py-2 px-3 font-mono">
                  {r.median}
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 px-3 text-white/50">标准差 (Std Dev)</td>
              {results.map(r => (
                <td key={r.strategy} className={`text-center py-2 px-3 font-mono ${r.stdDev === bestStd ? 'text-green-400' : ''}`}>
                  {r.stdDev.toFixed(3)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 px-3 text-white/50">计算耗时</td>
              {results.map(r => (
                <td key={r.strategy} className="text-center py-2 px-3 font-mono text-white/40">
                  {(r.timeMs / 1000).toFixed(1)}s
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analysis Panel ─────────────────────────────────────────────────
function AnalysisPanel({ results }: { results: StrategyResult[] }) {
  // Find best strategy for each metric
  const bestMeanStrategy = results.reduce((a, b) => a.meanSteps < b.meanSteps ? a : b);
  const bestMaxStrategy = results.reduce((a, b) => a.maxSteps < b.maxSteps ? a : b);
  const bestStdStrategy = results.reduce((a, b) => a.stdDev < b.stdDev ? a : b);

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <span className="text-xl">🔬</span>
        分析与结论
      </h3>

      <div className="space-y-4 text-sm text-white/70">
        {/* Key findings */}
        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/15 space-y-2">
          <h4 className="font-bold text-emerald-300 text-base">📌 关键发现</h4>
          <p>
            <strong className="text-white">平均步数最优：</strong>
            {bestMeanStrategy.icon} {bestMeanStrategy.displayName}（{bestMeanStrategy.meanSteps.toFixed(2)} 步）
          </p>
          <p>
            <strong className="text-white">最坏情况最优：</strong>
            {bestMaxStrategy.icon} {bestMaxStrategy.displayName}（{bestMaxStrategy.maxSteps} 步）
          </p>
          <p>
            <strong className="text-white">最稳定（标准差最小）：</strong>
            {bestStdStrategy.icon} {bestStdStrategy.displayName}（σ = {bestStdStrategy.stdDev.toFixed(3)}）
          </p>
        </div>

        {/* Why hybrid wins */}
        <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-400/15 space-y-3">
          <h4 className="font-bold text-indigo-300 text-base">🧠 为什么混合策略能超越单一策略？</h4>

          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-indigo-400 font-bold shrink-0">1.</span>
              <div>
                <strong className="text-white">初期成本优势</strong>
                <p className="text-white/50 mt-0.5">
                  在 10,000 个候选中做熵计算需要 ~1亿次反馈计算，而成分探测 [0,1,2,3] 
                  几乎是"免费"的。更关键的是，这个猜测的信息熵本身就接近最优——它覆盖4个不同数字，
                  能将候选池划分为5组（反馈0~4），接近理论最大值 log₂5 ≈ 2.32 bit。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-indigo-400 font-bold shrink-0">2.</span>
              <div>
                <strong className="text-white">中期信息效率</strong>
                <p className="text-white/50 mt-0.5">
                  信息熵优化"期望"信息量。在候选池中等大小时，大多数反馈都能排除大量候选，
                  只有少数不利反馈会留下较多候选。统计上，"好运气"出现的概率更高，
                  所以信息熵策略的<em>平均</em>表现优于 Minimax。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-indigo-400 font-bold shrink-0">3.</span>
              <div>
                <strong className="text-white">后期安全保障</strong>
                <p className="text-white/50 mt-0.5">
                  当候选池 ≤ 200 时切换到 Minimax。此时计算量可控，
                  而 Minimax 能保证即使遇到最不利的反馈序列，也能在有限步内收敛。
                  这避免了纯信息熵策略偶尔遇到的"尾部风险"——少数游戏需要异常多的步数。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-indigo-400 font-bold shrink-0">4.</span>
              <div>
                <strong className="text-white">本质是"探索-利用"的权衡</strong>
                <p className="text-white/50 mt-0.5">
                  单一策略要么全局最优但某些场景差（信息熵），要么处处保守但整体偏慢（Minimax），
                  要么信息获取方式单一（成分探测）。混合策略根据博弈阶段动态调整"激进度"，
                  实现了探索与利用的最佳平衡。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pure strategies analysis */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
          <h4 className="font-bold text-white text-base">📋 各策略特性分析</h4>

          <div className="space-y-2">
            <div className="border-l-2 border-blue-400/50 pl-3">
              <strong className="text-blue-300">🔍 纯成分探测</strong>
              <p className="text-white/40 text-xs mt-0.5">
                前几步信息效率高，但一旦完成成分确认后缺乏高效的排列确认手段。
                后期只能在候选中逐个尝试，导致总步数偏高。适合理解游戏结构，但不适合竞速。
              </p>
            </div>
            <div className="border-l-2 border-purple-400/50 pl-3">
              <strong className="text-purple-300">📊 纯信息熵</strong>
              <p className="text-white/40 text-xs mt-0.5">
                平均表现优秀，但初期在大候选池中计算量大（采样可能错过最优），
                后期可能出现少数"倒霉"游戏拖高最坏步数。
              </p>
            </div>
            <div className="border-l-2 border-orange-400/50 pl-3">
              <strong className="text-orange-300">🧮 纯 Minimax</strong>
              <p className="text-white/40 text-xs mt-0.5">
                最坏情况控制最好，但过于保守。在大候选池中计算量大且必须采样，
                牺牲了平均性能来换取最坏情况的保证。
              </p>
            </div>
            <div className="border-l-2 border-emerald-400/50 pl-3">
              <strong className="text-emerald-300">⚡ 三阶段混合</strong>
              <p className="text-white/40 text-xs mt-0.5">
                综合了三种策略的优点：初期低成本高信息、中期高效率、后期强保证。
                在大规模测试中表现最为均衡。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sample Games ───────────────────────────────────────────────────
function SampleGames({ results }: { results: StrategyResult[] }) {
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  const colorMapText: Record<string, string> = {
    blue: 'text-blue-300',
    purple: 'text-purple-300',
    orange: 'text-orange-300',
    emerald: 'text-emerald-300',
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <span className="text-xl">🎮</span>
        样本游戏回放
      </h3>
      <p className="text-xs text-white/40">点击查看每种策略的部分游戏详情</p>

      <div className="space-y-3">
        {results.map(r => (
          <div key={r.strategy}>
            <button
              onClick={() => setExpandedStrategy(expandedStrategy === r.strategy ? null : r.strategy)}
              className="w-full flex items-center justify-between glass-card-light rounded-xl p-3 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span>{r.icon}</span>
                <span className={`font-medium ${colorMapText[r.color]}`}>{r.displayName}</span>
                <span className="text-xs text-white/30">{r.sampleGames.length} 个样本</span>
              </div>
              <span className={`text-xs transition-transform ${expandedStrategy === r.strategy ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {expandedStrategy === r.strategy && (
              <div className="mt-2 space-y-1.5 animate-slide-up">
                {r.sampleGames.slice(0, 15).map((game, i) => (
                  <div key={i} className="flex items-center gap-3 glass-card-light rounded-lg px-3 py-2 text-xs">
                    <span className="font-mono text-white/30 w-4">{i + 1}</span>
                    <span className="font-mono text-white/80 font-bold w-12">
                      {game.target}
                    </span>
                    <span className={`font-bold w-8 text-center ${
                      game.steps <= 5 ? 'text-green-400' : game.steps <= 8 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {game.steps}步
                    </span>
                    <div className="flex-1 flex flex-wrap gap-1">
                      {game.guesses.map((g, j) => (
                        <span key={j} className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                          j === game.guesses.length - 1
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-white/5 text-white/40'
                        }`}>
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Benchmark Page ────────────────────────────────────────────
export function BenchmarkPage() {
  const [state, setState] = useState<BenchmarkState>('idle');
  const [numTargets, setNumTargets] = useState(200);
  const [selectedStrategies, setSelectedStrategies] = useState<StrategyName[]>([
    'frequency-probe', 'max-entropy', 'minimax', 'hybrid'
  ]);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [results, setResults] = useState<StrategyResult[] | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const toggleStrategy = useCallback((name: StrategyName) => {
    setSelectedStrategies(prev => {
      if (prev.includes(name)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(s => s !== name);
      }
      return [...prev, name];
    });
  }, []);

  const startBenchmark = useCallback(() => {
    setState('running');
    setResults(null);
    setProgress(null);

    const { cancel } = runBenchmarkAsync(
      {
        numTargets,
        strategies: selectedStrategies,
        seed: Date.now(),
      },
      (p) => setProgress(p),
      (r) => {
        setResults(r);
        setState('done');
      },
    );
    cancelRef.current = cancel;
  }, [numTargets, selectedStrategies]);

  const cancelBenchmark = useCallback(() => {
    cancelRef.current?.();
    setState('idle');
    setProgress(null);
  }, []);

  const colorMapBg: Record<string, string> = {
    blue: 'bg-blue-500/20 border-blue-400/30 text-blue-300',
    purple: 'bg-purple-500/20 border-purple-400/30 text-purple-300',
    orange: 'bg-orange-500/20 border-orange-400/30 text-orange-300',
    emerald: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
  };

  const colorMapInactive: Record<string, string> = {
    blue: 'border-white/10 text-white/30 hover:border-blue-400/20',
    purple: 'border-white/10 text-white/30 hover:border-purple-400/20',
    orange: 'border-white/10 text-white/30 hover:border-orange-400/20',
    emerald: 'border-white/10 text-white/30 hover:border-emerald-400/20',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-5xl">⚗️</div>
        <h2 className="text-2xl font-bold text-white">策略基准测试</h2>
        <p className="text-white/40 text-sm max-w-lg mx-auto">
          自动化对比四种猜数策略的性能，用数据验证哪种策略最优
        </p>
      </div>

      {/* Config Panel */}
      {state !== 'running' && (
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h3 className="text-base font-bold text-white">⚙️ 测试配置</h3>

          {/* Number of targets */}
          <div className="space-y-2">
            <label className="text-sm text-white/50">测试局数</label>
            <div className="flex items-center gap-3">
              {[50, 100, 200, 500].map(n => (
                <button
                  key={n}
                  onClick={() => setNumTargets(n)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    numTargets === n
                      ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {n} 局
                </button>
              ))}
            </div>
            <p className="text-xs text-white/25">
              {numTargets >= 500 ? '⚠️ 500局测试可能需要几分钟' : `预计总耗时 ${Math.ceil(numTargets * selectedStrategies.length * 0.05)}~${Math.ceil(numTargets * selectedStrategies.length * 0.2)}秒`}
            </p>
          </div>

          {/* Strategy selection */}
          <div className="space-y-2">
            <label className="text-sm text-white/50">参与测试的策略</label>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGIES.map(s => {
                const selected = selectedStrategies.includes(s.name);
                return (
                  <button
                    key={s.name}
                    onClick={() => toggleStrategy(s.name)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      selected ? colorMapBg[s.color] : colorMapInactive[s.color]
                    }`}
                  >
                    <span className="text-lg">{s.icon}</span>
                    <div className="text-left">
                      <div>{s.displayName}</div>
                      <div className="text-[10px] text-white/25 font-normal">{s.description}</div>
                    </div>
                    {selected && <span className="ml-auto text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startBenchmark}
            disabled={selectedStrategies.length === 0}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            🚀 开始测试 ({selectedStrategies.length} 种策略 × {numTargets} 局)
          </button>
        </div>
      )}

      {/* Progress Panel */}
      {state === 'running' && progress && (
        <div className="glass-card rounded-2xl p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              ⏳ 正在测试...
            </h3>
            <button
              onClick={cancelBenchmark}
              className="px-4 py-1.5 text-sm border border-red-400/30 text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              取消
            </button>
          </div>

          {/* Strategy progress */}
          <div className="space-y-2">
            {selectedStrategies.map((s, idx) => {
              const info = STRATEGIES.find(st => st.name === s)!;
              const isActive = idx === progress.strategyIndex;
              const isDone = idx < progress.strategyIndex;
              const pct = isActive ? (progress.gamesCompleted / progress.totalGames) * 100 : isDone ? 100 : 0;

              return (
                <div key={s} className={`rounded-xl p-3 border transition-all ${
                  isActive ? 'bg-indigo-500/10 border-indigo-400/20' : isDone ? 'bg-green-500/5 border-green-400/10' : 'bg-white/3 border-white/5'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span>{info.icon}</span>
                      <span className={`text-sm font-medium ${isActive ? 'text-indigo-300' : isDone ? 'text-green-400' : 'text-white/30'}`}>
                        {info.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-white/40">
                      {isDone ? '✅ 完成' : isActive ? `${progress.gamesCompleted}/${progress.totalGames}` : '等待中'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isDone ? 'bg-green-500' : isActive ? 'bg-indigo-500' : 'bg-white/5'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live stats */}
          <div className="flex items-center justify-center gap-4 text-xs text-white/30">
            <span>策略 {progress.strategyIndex + 1}/{progress.totalStrategies}</span>
            <span>·</span>
            <span>已耗时 {(progress.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      )}

      {/* Results */}
      {state === 'done' && results && (
        <div className="space-y-6 animate-fade-in">
          <ResultsTable results={results} />
          <DistributionChart results={results} />
          <AnalysisPanel results={results} />
          <SampleGames results={results} />

          {/* Run again */}
          <div className="text-center">
            <button
              onClick={() => { setState('idle'); setResults(null); }}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-purple-500 transition-all shadow-md shadow-indigo-500/20"
            >
              🔄 重新配置测试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
