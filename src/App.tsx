import { useState, useCallback, useRef, useEffect } from 'react';
import { Starfield } from './Starfield';
import { BenchmarkPage } from './BenchmarkPage';
import {
  Code,
  GameRound,
  DetailedAnalysis,
  generateAllCodes,
  filterCandidates,
  getSmartGuess,
  codeToString,
  stringToCode,
  computeFeedback,
  isExactMatch,
} from './engine';

type Tab = 'rules' | 'ai-guesses' | 'user-guesses' | 'theory' | 'benchmark';

// ─── Strategy Badge ─────────────────────────────────────────────────
function StrategyBadge({ strategy }: { strategy: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    'frequency-probe': { label: '🔍 成分探测', cls: 'bg-blue-500/20 text-blue-300 border-blue-400/30' },
    'max-entropy': { label: '📊 最大信息熵', cls: 'bg-purple-500/20 text-purple-300 border-purple-400/30' },
    'minimax': { label: '🧮 极小化极大', cls: 'bg-orange-500/20 text-orange-300 border-orange-400/30' },
    'entropy-sampled': { label: '📊 信息熵(采样)', cls: 'bg-violet-500/20 text-violet-300 border-violet-400/30' },
    'direct': { label: '🎯 二选一', cls: 'bg-green-500/20 text-green-300 border-green-400/30' },
    'unique-solution': { label: '✅ 唯一解', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
  };
  const info = map[strategy] || { label: strategy, cls: 'bg-gray-500/20 text-gray-300 border-gray-400/30' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ─── Knowledge Panel (Dark Theme) ───────────────────────────────────
function KnowledgePanel({ analysis }: { analysis: DetailedAnalysis }) {
  const { knowledge } = analysis;
  return (
    <div className="glass-card-light rounded-xl p-4">
      <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">📋 当前知识库</h4>
      <div className="grid grid-cols-10 gap-1.5 mb-3">
        {knowledge.digits.map((dk) => {
          let bg = 'bg-white/5 text-white/30 border-white/10';
          let label = '?';
          if (knowledge.confirmedDigits.includes(dk.digit)) {
            bg = 'bg-green-500/20 text-green-300 border-green-400/30';
            label = `×${dk.confirmedCount}`;
          } else if (knowledge.eliminatedDigits.includes(dk.digit)) {
            bg = 'bg-red-500/10 text-red-400/40 border-red-400/20 line-through';
            label = '×0';
          }
          return (
            <div key={dk.digit} className={`text-center rounded-lg border p-1.5 transition-all ${bg}`}>
              <div className="text-sm font-bold">{dk.digit}</div>
              <div className="text-[10px]">{label}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {knowledge.confirmedDigits.length > 0 && (
          <span className="text-green-400">✅ 已确认 {knowledge.confirmedSlots}/4 个数字</span>
        )}
        {knowledge.eliminatedDigits.length > 0 && (
          <span className="text-red-400">❌ 排除 {knowledge.eliminatedDigits.length} 个</span>
        )}
        {knowledge.unknownDigits.length > 0 && (
          <span className="text-white/40">❓ 待验证 {knowledge.unknownDigits.length} 个</span>
        )}
        {knowledge.compositionKnown && (
          <span className="text-indigo-300 font-semibold">🎯 成分完全确定！</span>
        )}
      </div>
    </div>
  );
}

// ─── Reasoning Panel (Dark Theme) ───────────────────────────────────
function ReasoningPanel({ analysis, expanded }: { analysis: DetailedAnalysis; expanded: boolean }) {
  const [isExpanded, setIsExpanded] = useState(expanded);

  return (
    <div className="space-y-3">
      {/* Phase */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
          {analysis.phase}
        </span>
        <span className="text-xs text-white/40">{analysis.phaseDescription}</span>
      </div>

      <KnowledgePanel analysis={analysis} />

      {/* Reasoning */}
      <div className="space-y-1.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white/80 transition-colors"
        >
          <span className={`transition-transform text-[10px] ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          🧠 思考过程 ({analysis.reasoning.length} 步)
        </button>
        {isExpanded && (
          <div className="glass-card-light rounded-lg p-3 space-y-1.5 animate-slide-up">
            {analysis.reasoning.map((step, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-indigo-400/60 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                <span className="text-white/70">{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rationale */}
      <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-400/15">
        <h4 className="text-xs font-bold text-blue-300 mb-1">💡 猜测理由</h4>
        <p className="text-sm text-blue-200/80">{analysis.guessRationale}</p>
      </div>

      {/* Position clues */}
      {analysis.positionClues.length > 0 && (
        <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-400/15">
          <h4 className="text-xs font-bold text-amber-300 mb-1">📍 位置分析</h4>
          <div className="grid grid-cols-2 gap-1">
            {analysis.positionClues.map((clue, i) => (
              <span key={i} className="text-sm text-amber-200/70">{clue}</span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass-card-light rounded-xl p-2.5">
          <div className="text-lg font-bold text-white">{analysis.candidatesRemaining.toLocaleString()}</div>
          <div className="text-[10px] text-white/30">候选数</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-2.5 border border-green-400/10">
          <div className="text-lg font-bold text-green-400">{analysis.bestCaseRemaining}</div>
          <div className="text-[10px] text-green-300/50">最好</div>
        </div>
        <div className="bg-red-500/10 rounded-xl p-2.5 border border-red-400/10">
          <div className="text-lg font-bold text-red-400">{analysis.worstCaseRemaining}</div>
          <div className="text-[10px] text-red-300/50">最坏</div>
        </div>
      </div>

      {/* Feedback preview */}
      {analysis.feedbackPreview.length > 0 && (
        <div className="glass-card-light rounded-xl p-3">
          <h4 className="text-xs font-bold text-white/50 mb-2">🔮 反馈预测</h4>
          <div className="space-y-1.5">
            {analysis.feedbackPreview.map(fp => (
              <div key={fp.feedback} className="flex items-center gap-2 text-sm">
                <span className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-sm
                  ${fp.feedback === 4 ? 'bg-green-500/60' : fp.feedback >= 3 ? 'bg-yellow-500/60' : fp.feedback >= 1 ? 'bg-orange-500/60' : 'bg-white/10'}`}>
                  {fp.feedback}
                </span>
                <span className="text-white/30">→</span>
                <span className="font-bold text-white/80">{fp.remaining}</span>
                <span className="text-white/30">个候选</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rules Page ─────────────────────────────────────────────────────
function RulesPage({ onStart }: { onStart: (tab: Tab) => void }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-4 mb-8">
        <div className="text-7xl animate-float">🔢</div>
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          4位数猜数博弈
        </h1>
        <p className="text-white/50 text-lg">多重集交集 × 信息熵 × 极小化极大</p>
      </div>

      <div className="glass-card rounded-2xl p-6 md:p-8 space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-sm">📖</span>
          游戏规则
        </h2>

        <div className="space-y-4 text-white/70">
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold text-sm shrink-0">1</span>
            <div>
              <p className="text-white/90 font-medium">一方想一个 4 位数字</p>
              <p className="text-sm text-white/50">范围 0000 ~ 9999，数字可以重复</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-sm shrink-0">2</span>
            <div>
              <p className="text-white/90 font-medium">另一方每轮给出一个猜测</p>
              <p className="text-sm text-white/50">猜测方需要通过有限次尝试推断出目标数字</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-300 font-bold text-sm shrink-0">3</span>
            <div>
              <p className="text-white/90 font-medium">想数方给出"匹配数"反馈</p>
              <p className="text-sm text-white/50">匹配数 = 多重集交集基数（详见下方说明）</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-300 font-bold text-sm shrink-0">4</span>
            <div>
              <p className="text-white/90 font-medium">只有每一位都正确才算猜中</p>
              <p className="text-sm text-white/50">匹配数 = 4 不代表猜中！位置也必须完全一致</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback explanation */}
      <div className="glass-card rounded-2xl p-6 md:p-8 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center text-sm">🧮</span>
          匹配数计算方法
        </h2>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm mb-2">对每个数字 (0-9)，取它在猜测与目标中出现次数的<strong className="text-white/90">较小值</strong>，全部加起来。</p>
          <code className="block text-indigo-300 font-mono text-sm bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
            k = Σ(d=0→9) min(count_guess(d), count_target(d))
          </code>
        </div>

        <div className="space-y-3">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-blue-300 font-bold">目标 1302</span>
              <span className="text-white/20">vs</span>
              <span className="font-mono text-purple-300 font-bold">猜测 4527</span>
            </div>
            <p className="text-sm text-white/50">数字 2: min(1,1) = 1 → 反馈 = <strong className="text-white text-lg">1</strong></p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-blue-300 font-bold">目标 1122</span>
              <span className="text-white/20">vs</span>
              <span className="font-mono text-purple-300 font-bold">猜测 2211</span>
            </div>
            <p className="text-sm text-white/50">1: min(2,2)=2，2: min(2,2)=2 → 反馈 = <strong className="text-white text-lg">4</strong>
              <span className="text-amber-400/60 ml-2 text-xs">（但位置全错，未猜中！）</span>
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-blue-300 font-bold">目标 1111</span>
              <span className="text-white/20">vs</span>
              <span className="font-mono text-purple-300 font-bold">猜测 1234</span>
            </div>
            <p className="text-sm text-white/50">数字 1: min(1,4) = 1 → 反馈 = <strong className="text-white text-lg">1</strong></p>
          </div>
        </div>
      </div>

      {/* Start buttons */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => onStart('ai-guesses')}
          className="group glass-card rounded-2xl p-6 hover:bg-indigo-500/15 hover:border-indigo-400/30 transition-all text-left"
        >
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🤖</div>
          <h3 className="text-lg font-bold text-white mb-1">AI 来猜你的数字</h3>
          <p className="text-sm text-white/40">观看 AI 的完整推理过程</p>
          <div className="mt-3 text-xs text-indigo-400 font-medium">开始游戏 →</div>
        </button>

        <button
          onClick={() => onStart('user-guesses')}
          className="group glass-card rounded-2xl p-6 hover:bg-emerald-500/15 hover:border-emerald-400/30 transition-all text-left"
        >
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🎯</div>
          <h3 className="text-lg font-bold text-white mb-1">你来猜电脑的数字</h3>
          <p className="text-sm text-white/40">挑战你的推理能力</p>
          <div className="mt-3 text-xs text-emerald-400 font-medium">开始游戏 →</div>
        </button>
      </div>

      {/* Benchmark entry */}
      <button
        onClick={() => onStart('benchmark')}
        className="group w-full glass-card rounded-2xl p-5 hover:bg-amber-500/10 hover:border-amber-400/20 transition-all text-left flex items-center gap-4"
      >
        <div className="text-3xl group-hover:scale-110 transition-transform">⚗️</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-0.5">策略基准测试</h3>
          <p className="text-sm text-white/40">自动化对比四种猜数策略，用数据验证哪种策略最优</p>
        </div>
        <div className="text-xs text-amber-400/60 font-medium shrink-0">查看 →</div>
      </button>
    </div>
  );
}

// ─── AI Guesses Mode ────────────────────────────────────────────────
function AIGuessesGame() {
  const allCodesRef = useRef<Code[]>(generateAllCodes());
  const [candidates, setCandidates] = useState<Code[]>(() => [...allCodesRef.current]);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [currentGuess, setCurrentGuess] = useState<{ guess: Code; analysis: DetailedAnalysis } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [showDetailFor, setShowDetailFor] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, currentGuess]);

  const startGame = useCallback(() => {
    const cands = [...allCodesRef.current];
    setCandidates(cands);
    setHistory([]);
    setGameOver(false);
    setStarted(true);
    setShowDetailFor(null);
    const result = getSmartGuess(cands, allCodesRef.current, 0, []);
    setCurrentGuess(result);
  }, []);

  const submitFeedback = useCallback(() => {
    if (!currentGuess) return;
    const fb = parseInt(feedbackInput);
    if (isNaN(fb) || fb < 0 || fb > 4) return;

    const round: GameRound = {
      round: history.length + 1,
      guess: currentGuess.guess,
      feedback: fb,
      analysis: currentGuess.analysis,
      isCorrect: fb === 4,
    };

    const newHistory = [...history, round];
    setHistory(newHistory);
    setFeedbackInput('');

    if (fb === 4) {
      setGameOver(true);
      setCurrentGuess(null);
      return;
    }

    const newCandidates = filterCandidates(candidates, currentGuess.guess, fb);
    setCandidates(newCandidates);

    if (newCandidates.length === 0) {
      setGameOver(true);
      setCurrentGuess(null);
      return;
    }

    const result = getSmartGuess(newCandidates, allCodesRef.current, newHistory.length, newHistory);
    setCurrentGuess(result);
  }, [currentGuess, feedbackInput, history, candidates]);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {!started ? (
        <div className="text-center space-y-6">
          <div className="glass-card rounded-2xl p-8">
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-white mb-3">AI 来猜你的数字</h2>
            <p className="text-white/50 mb-6">在心中想一个 4 位数字（0000-9999），AI 会展示完整推理过程来猜测。</p>
            <button onClick={startGame} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5">
              开始游戏
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="glass-card rounded-xl p-3">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-white/40">候选解范围</span>
              <span className="font-mono font-bold text-indigo-300">
                {candidates.length.toLocaleString()} / 10,000
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(1, (candidates.length / 10000) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/25 mt-1">
              <span>已排除 {(10000 - candidates.length).toLocaleString()}</span>
              <span>轮次 {history.length}</span>
            </div>
          </div>

          {/* History */}
          {history.map((r) => (
            <div key={r.round} className={`glass-card rounded-xl overflow-hidden animate-slide-up ${
              r.isCorrect ? 'border-green-400/30' : ''
            }`}>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono bg-white/10 px-2 py-0.5 rounded font-bold text-white/60">
                      R{r.round}
                    </span>
                    <StrategyBadge strategy={r.analysis.strategy} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-bold tracking-widest text-white">
                      {codeToString(r.guess)}
                    </span>
                    <span className="text-white/20">→</span>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl font-bold text-white ${
                      r.feedback === 4 ? 'bg-green-500/60' : r.feedback! >= 3 ? 'bg-yellow-500/60' : r.feedback! >= 1 ? 'bg-orange-500/60' : 'bg-white/10'
                    }`}>
                      {r.feedback}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-white/30">
                    {r.analysis.phase} · 候选 {r.analysis.candidatesRemaining.toLocaleString()}
                  </span>
                  <button
                    onClick={() => setShowDetailFor(showDetailFor === r.round ? null : r.round)}
                    className="text-xs text-indigo-400/70 hover:text-indigo-300 font-medium transition-colors"
                  >
                    {showDetailFor === r.round ? '收起 ▲' : '详情 ▼'}
                  </button>
                </div>
              </div>
              {showDetailFor === r.round && (
                <div className="border-t border-white/5 p-4 animate-slide-up">
                  <ReasoningPanel analysis={r.analysis} expanded={true} />
                </div>
              )}
            </div>
          ))}

          {/* Current guess */}
          {currentGuess && !gameOver && (
            <div className="glass-card rounded-xl overflow-hidden border-indigo-400/30 animate-glow">
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono bg-indigo-500/20 px-2 py-0.5 rounded font-bold text-indigo-300">
                    R{history.length + 1}
                  </span>
                  <StrategyBadge strategy={currentGuess.analysis.strategy} />
                  <span className="text-xs text-indigo-400/50 ml-auto animate-pulse-soft">等待反馈...</span>
                </div>

                <ReasoningPanel analysis={currentGuess.analysis} expanded={true} />

                {/* Big guess */}
                <div className="text-center py-4">
                  <p className="text-sm text-white/40 mb-3">我的猜测：</p>
                  <div className="flex justify-center gap-3">
                    {currentGuess.guess.map((d, i) => (
                      <div key={i} className="w-16 h-20 glass-card-light rounded-xl border-indigo-400/20 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/10 animate-digit-pop" style={{ animationDelay: `${i * 0.1}s` }}>
                        <span className="text-3xl font-mono font-bold text-white">{d}</span>
                        <span className="text-[10px] text-white/25">第{i+1}位</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback input */}
                <div className="glass-card-light rounded-xl p-4">
                  <p className="text-sm text-white/50 text-center mb-3">
                    匹配了几个数字？
                  </p>
                  <div className="flex items-center gap-3 justify-center flex-wrap">
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4].map(n => (
                        <button
                          key={n}
                          onClick={() => setFeedbackInput(String(n))}
                          className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${
                            feedbackInput === String(n)
                              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 scale-110 ring-2 ring-indigo-400/50'
                              : 'bg-white/5 text-white/60 border border-white/10 hover:border-indigo-400/40 hover:bg-indigo-500/10'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={submitFeedback}
                      disabled={feedbackInput === ''}
                      className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20"
                    >
                      确认 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Game over */}
          {gameOver && (
            <div className={`glass-card rounded-2xl p-6 text-center animate-slide-up ${
              history[history.length - 1]?.feedback === 4 ? 'border-green-400/30' : 'border-red-400/30'
            }`}>
              {history[history.length - 1]?.feedback === 4 ? (
                <>
                  <div className="text-6xl mb-3">🎉</div>
                  <h3 className="text-2xl font-bold text-white mb-2">猜中了！</h3>
                  <p className="text-white/60 mb-3">
                    AI 用了 <strong className="text-3xl text-indigo-300">{history.length}</strong> 轮猜出了你的数字
                  </p>
                  <div className="flex justify-center gap-2 mb-4">
                    {history[history.length - 1].guess.map((d, i) => (
                      <div key={i} className="w-14 h-16 bg-green-500/20 rounded-xl border border-green-400/30 flex items-center justify-center">
                        <span className="text-2xl font-mono font-bold text-green-300">{d}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/30">
                    {history.length <= 6 ? '🌟 极其幸运！' : history.length <= 8 ? '👍 非常高效！' : history.length <= 10 ? '📊 正常水平' : '🤔 有点曲折'}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-3">🤔</div>
                  <h3 className="text-2xl font-bold text-white mb-2">出现矛盾</h3>
                  <p className="text-white/50">反馈不一致，请检查是否正确计算了匹配数。</p>
                </>
              )}
              <button onClick={startGame} className="mt-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-purple-500 transition-all shadow-md shadow-indigo-500/20">
                再来一局
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ─── User Guesses Mode ─────────────────────────────────────────────
function UserGuessesGame() {
  const [target, setTarget] = useState<Code | null>(null);
  const [history, setHistory] = useState<{ guess: Code; feedback: number; exact: boolean }[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const startGame = useCallback(() => {
    const code: Code = [
      Math.floor(Math.random() * 10) as Code[0],
      Math.floor(Math.random() * 10) as Code[0],
      Math.floor(Math.random() * 10) as Code[0],
      Math.floor(Math.random() * 10) as Code[0],
    ];
    setTarget(code);
    setHistory([]);
    setGameOver(false);
    setInputVal('');
    setShowAnswer(false);
  }, []);

  const submitGuess = useCallback(() => {
    if (!target) return;
    const code = stringToCode(inputVal);
    if (!code) return;

    const fb = computeFeedback(code, target);
    const exact = isExactMatch(code, target);
    setHistory(prev => [...prev, { guess: code, feedback: fb, exact }]);
    setInputVal('');
    if (exact) setGameOver(true);
  }, [target, inputVal]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="glass-card rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <h2 className="text-2xl font-bold text-white mb-1">你来猜电脑的数字</h2>
        <p className="text-white/40 text-sm mb-3">电脑已经想好了一个 4 位数字，输入你的猜测</p>
        {!gameOver && (
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="text-xs text-white/20 hover:text-white/40 transition-colors"
          >
            {showAnswer ? '隐藏答案' : '偷看答案'}
          </button>
        )}
        {showAnswer && target && (
          <p className="text-sm text-red-400/60 mt-1 font-mono">{codeToString(target)}</p>
        )}
      </div>

      {history.map((r, i) => (
        <div key={i} className={`glass-card rounded-xl p-4 flex items-center justify-between animate-slide-up ${
          r.exact ? 'border-green-400/30' : ''
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono bg-white/10 px-2 py-0.5 rounded font-bold text-white/50">#{i + 1}</span>
            <div className="flex gap-1.5">
              {r.guess.map((d, j) => (
                <div key={j} className={`w-10 h-12 rounded-lg border flex items-center justify-center font-mono font-bold text-lg ${
                  r.exact ? 'bg-green-500/20 border-green-400/30 text-green-300' : 'bg-white/5 border-white/10 text-white/80'
                }`}>
                  {d}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl font-bold text-white ${
              r.exact ? 'bg-green-500/60' : r.feedback >= 3 ? 'bg-yellow-500/60' : r.feedback >= 1 ? 'bg-orange-500/60' : 'bg-white/10'
            }`}>
              {r.feedback}
            </span>
            {r.exact && <span className="text-green-400 text-xl">✓</span>}
          </div>
        </div>
      ))}

      {!gameOver && target && (
        <div className="glass-card rounded-xl p-5 border-emerald-400/20">
          <div className="flex items-center gap-3 justify-center">
            <input
              type="text"
              maxLength={4}
              value={inputVal}
              onChange={e => setInputVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && submitGuess()}
              placeholder="输入4位数字"
              className="w-48 text-center text-2xl font-mono tracking-widest border border-white/15 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
            />
            <button
              onClick={submitGuess}
              disabled={inputVal.length !== 4}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-500/20"
            >
              猜！
            </button>
          </div>
        </div>
      )}

      {gameOver && target && (
        <div className="glass-card rounded-2xl p-6 text-center border-green-400/30 animate-slide-up">
          <div className="text-6xl mb-3">🎊</div>
          <h3 className="text-2xl font-bold text-white mb-2">恭喜猜中！</h3>
          <p className="text-white/60">
            答案是 <strong className="font-mono text-xl text-emerald-300">{codeToString(target)}</strong>，你用了 <strong className="text-emerald-300">{history.length}</strong> 轮
          </p>
          <button onClick={startGame} className="mt-4 px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md shadow-emerald-500/20">
            再来一局
          </button>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Theory & Strategy ──────────────────────────────────────────────
function TheoryPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">📐</div>
        <h2 className="text-2xl font-bold text-white">数学分析与策略</h2>
        <p className="text-white/40 text-sm mt-1">深入理解博弈的数学本质</p>
      </div>

      {/* Problem scale */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-sm text-blue-300">1</span>
          问题规模
        </h3>
        <div className="space-y-2 text-white/60 text-sm">
          <p>• 总共 <strong className="text-white">10,000</strong> 种可能 (0000 ~ 9999)</p>
          <p>• 每次反馈有 <strong className="text-white">5</strong> 种值 (0, 1, 2, 3, 4)</p>
          <p>• 信息论下界：<strong className="text-white">6 次</strong>（⌈log₂10000 / log₂5⌉）</p>
          <p className="text-amber-400/60">⚠️ 理论下界，实际中反馈分布不均，通常需要更多</p>
        </div>
      </div>

      {/* Three-phase strategy */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-sm text-purple-300">2</span>
          AI 的三阶段策略
        </h3>

        <div className="space-y-4">
          <div className="border-l-2 border-blue-400/40 pl-4 py-1">
            <h4 className="font-semibold text-blue-300 mb-1 text-sm">🔍 阶段一：成分探测</h4>
            <p className="text-xs text-white/50">使用 [0,1,2,3]、[4,5,6,7] 等结构化组合，快速判断目标包含哪些数字</p>
            <span className="text-[10px] text-blue-400/40 mt-1 inline-block">候选池 &gt; 5000</span>
          </div>

          <div className="border-l-2 border-purple-400/40 pl-4 py-1">
            <h4 className="font-semibold text-purple-300 mb-1 text-sm">📊 阶段二：最大信息熵</h4>
            <p className="text-xs text-white/50">选择让候选集划分最均匀的猜测，最大化每次信息获取量</p>
            <span className="text-[10px] text-purple-400/40 mt-1 inline-block">候选池 200 ~ 1000</span>
          </div>

          <div className="border-l-2 border-orange-400/40 pl-4 py-1">
            <h4 className="font-semibold text-orange-300 mb-1 text-sm">🧮 阶段三：极小化极大</h4>
            <p className="text-xs text-white/50">保证最坏情况下仍能最大程度缩小范围</p>
            <span className="text-[10px] text-orange-400/40 mt-1 inline-block">候选池 &lt; 200</span>
          </div>
        </div>
      </div>

      {/* Worst case */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-sm text-orange-300">3</span>
          最坏情况对比
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-500/10 rounded-xl p-3 border border-red-400/10">
            <p className="font-semibold text-red-300 text-sm">❌ 随机策略</p>
            <p className="text-xs text-white/40">可能需要上百次</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-400/10">
            <p className="font-semibold text-blue-300 text-sm">🔍 纯探测</p>
            <p className="text-xs text-white/40">~13 次</p>
          </div>
          <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-400/10">
            <p className="font-semibold text-purple-300 text-sm">📊 信息熵</p>
            <p className="text-xs text-white/40">平均 ~7 次</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 border border-green-400/10">
            <p className="font-semibold text-green-300 text-sm">🧮 混合（本AI）</p>
            <p className="text-xs text-white/40">最坏 8-10 次</p>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm text-emerald-300">4</span>
          次数总结
        </h3>
        <div className="space-y-2">
          {[
            { label: '🍀 最幸运', value: '1 次', color: 'text-green-400' },
            { label: '📊 信息论下界', value: '6 次', color: 'text-blue-400' },
            { label: '🧮 本AI平均', value: '~7 次', color: 'text-purple-400' },
            { label: '⚙️ 本AI最坏', value: '8-10 次', color: 'text-orange-400' },
            { label: '🐌 纯探测最坏', value: '~13 次', color: 'text-red-400' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm text-white/60">{item.label}</span>
              <span className={`font-bold text-lg ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────
export function App() {
  const [tab, setTab] = useState<Tab>('rules');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'rules', label: '规则', icon: '📖' },
    { key: 'ai-guesses', label: 'AI猜', icon: '🤖' },
    { key: 'user-guesses', label: '你猜', icon: '🎯' },
    { key: 'theory', label: '策略', icon: '📐' },
    { key: 'benchmark', label: '测试', icon: '⚗️' },
  ];

  return (
    <div className="min-h-screen text-white relative">
      <Starfield />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => setTab('rules')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🔢</span>
            <h1 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hidden sm:block">
              4位数猜数博弈
            </h1>
          </button>

          <nav className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8 pb-20">
        {tab === 'rules' && <RulesPage onStart={setTab} />}
        {tab === 'ai-guesses' && <AIGuessesGame />}
        {tab === 'user-guesses' && <UserGuessesGame />}
        {tab === 'theory' && <TheoryPage />}
        {tab === 'benchmark' && <BenchmarkPage />}
      </main>
    </div>
  );
}
