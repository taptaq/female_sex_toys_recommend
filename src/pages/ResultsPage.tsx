import { motion } from "motion/react";
import { Sparkles, VolumeX, Droplets, Zap } from "lucide-react";
import { AnswerState } from "../data/mock";
import { RankedProduct } from "../lib/app-shell";

export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  recommendationTips,
  onReset,
}: {
  pageVariants: any;
  answers: AnswerState;
  topProducts: RankedProduct[];
  recommendationTips: string[];
  onReset: () => void;
}) {
  return (
    <motion.div
      key="result"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="w-full space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-light text-white mb-2">匹配完成</h2>
        <div className="flex flex-wrap justify-center gap-1.5 mb-4 max-w-sm mx-auto">
          {answers.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-400">
          基于你的以上偏好，我们找到了如下装备
        </p>
      </div>

      {recommendationTips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-8"
        >
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wider uppercase">
              AI 匹配建议
            </span>
          </div>
          <ul className="space-y-1.5">
            {recommendationTips.map((tip, index) => (
              <li
                key={index}
                className="text-[11px] text-amber-200/70 leading-relaxed flex gap-2"
              >
                <span className="shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {topProducts.length > 0 ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-xl p-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

            <div className="h-36 w-full rounded-2xl overflow-hidden mb-4 relative bg-black/20">
              {topProducts[0].imagePlaceholder.startsWith("http") ? (
                <img
                  src={topProducts[0].imagePlaceholder}
                  className="w-full h-full object-cover opacity-90"
                />
              ) : (
                <div
                  className={`w-full h-full ${topProducts[0].imagePlaceholder} flex items-center justify-center`}
                >
                  <Sparkles className="w-8 h-8 text-white/50" />
                </div>
              )}
            </div>
            <div className="px-5 pb-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="inline-block px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono mb-2">
                    算法最匹配 (TOP 1)
                  </span>
                  <h3 className="text-lg font-medium text-white">
                    {topProducts[0].name}
                  </h3>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-lg font-semibold text-cyan-400">
                    ¥{topProducts[0].price}
                  </span>
                  {(topProducts[0].sourceUrl || topProducts[0].link) && (
                    <a
                      href={topProducts[0].sourceUrl || topProducts[0].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-cyan-500/80 underline mt-1"
                    >
                      立即探索
                    </a>
                  )}
                </div>
              </div>

              {topProducts[0].tags && topProducts[0].tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
                  {topProducts[0].tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {topProducts[0].reason && (
                <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <p className="text-[11px] text-cyan-200/80 leading-relaxed italic">
                    <Sparkles className="w-3 h-3 inline-block mr-1 mb-0.5 text-cyan-400" />
                    “ {topProducts[0].reason} ”
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                  <VolumeX className="w-3 h-3" />
                  {topProducts[0].maxDb == null
                    ? "无噪音参数"
                    : `<${topProducts[0].maxDb}dB`}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                  <Droplets className="w-3 h-3" />
                  {topProducts[0].waterproof == null
                    ? "无防水参数"
                    : `IPX${topProducts[0].waterproof}`}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                  <Zap className="w-3 h-3" />
                  {topProducts[0].motorType === "gentle" ? "温柔" : "强力"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {topProducts.slice(1, 3).map((product, index) => (
              <div
                key={product.id}
                className="glass-panel rounded-2xl p-3 flex flex-col"
              >
                <div className="h-24 w-full rounded-xl overflow-hidden mb-3 relative bg-black/20">
                  {product.imagePlaceholder.startsWith("http") ? (
                    <img
                      src={product.imagePlaceholder}
                      className="w-full h-full object-cover opacity-90"
                    />
                  ) : (
                    <div
                      className={`w-full h-full ${product.imagePlaceholder} flex items-center justify-center`}
                    >
                      <Sparkles className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">
                    {index === 0 ? "最具性价比" : "探索备选"}
                  </span>
                  <span className="text-[10px] text-cyan-500/70">
                    {product.brand}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-white mb-1 truncate leading-tight">
                  {product.name}
                </h3>
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {product.tags.slice(0, 2).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="text-[8px] bg-indigo-500/10 text-indigo-300/80 border border-indigo-500/20 px-1 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {product.reason && (
                  <p className="text-[9px] text-slate-400 mb-2 line-clamp-2 italic leading-tight">
                    “{product.reason}”
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  {product.sourceUrl || product.link ? (
                    <>
                      <span className="text-sm text-cyan-400">
                        ¥{product.price}
                      </span>
                      <a
                        href={product.sourceUrl || product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-cyan-500/80 underline hover:text-cyan-400 transition-colors"
                      >
                        立即探索
                      </a>
                    </>
                  ) : (
                    <span className="text-sm text-cyan-400">
                      ¥{product.price}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <p className="text-slate-300">未找到完全匹配的装备，请尝试放宽条件。</p>
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full py-4 mt-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors text-sm"
      >
        重新校准
      </button>
    </motion.div>
  );
}
