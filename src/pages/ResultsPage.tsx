import { motion } from "motion/react";
import { Sparkles, VolumeX, Droplets, Zap } from "lucide-react";
import { AnswerState } from "../data/mock";
import { RankedProduct } from "../lib/app-shell";
import type { BackupCandidate } from "../lib/recommendation-results";

type ResultsBackupProduct = BackupCandidate;

function renderProductImage(
  product: Pick<RankedProduct, "imagePlaceholder" | "name">,
  iconClassName: string,
) {
  if (product.imagePlaceholder.startsWith("http")) {
    return (
      <img
        src={product.imagePlaceholder}
        alt={product.name}
        className="h-full w-full object-cover opacity-90"
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${product.imagePlaceholder}`}
    >
      <Sparkles className={iconClassName} />
    </div>
  );
}

function getMetricChips(product: Pick<RankedProduct, "maxDb" | "waterproof" | "motorType">) {
  return [
    {
      id: "max-db",
      icon: VolumeX,
      label:
        product.maxDb == null ? "噪音参数缺失" : `噪音 < ${product.maxDb}dB`,
    },
    {
      id: "waterproof",
      icon: Droplets,
      label:
        product.waterproof == null
          ? "防水参数缺失"
          : `防水 IPX${product.waterproof}`,
    },
    {
      id: "motor-type",
      icon: Zap,
      label: product.motorType === "gentle" ? "温柔电机" : "强力电机",
    },
  ];
}

export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  onReset,
}: {
  pageVariants: any;
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: ResultsBackupProduct[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  onReset: () => void;
}) {
  const guidanceItems =
    shoppingGuidance.length > 0 ? shoppingGuidance : recommendationTips;

  return (
    <motion.div
      key="result"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="w-full space-y-6 overflow-x-hidden"
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

      {guidanceItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">选购建议</span>
          </div>
          <ul className="space-y-2">
            {guidanceItems.map((tip, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm leading-6 text-amber-100/85"
              >
                <span className="mt-1 shrink-0 text-amber-300">•</span>
                <span className="break-words">{tip}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {topProducts.length > 0 ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-xl p-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

            <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-black/20 sm:aspect-[2.4/1]">
              {renderProductImage(topProducts[0], "h-8 w-8 text-white/50")}
            </div>

            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <span className="inline-block px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono mb-2">
                    算法最匹配 (TOP 1)
                  </span>
                  <h3 className="break-words text-lg font-medium leading-snug text-white">
                    {topProducts[0].name}
                  </h3>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <span className="text-lg font-semibold text-cyan-400">
                    ¥{topProducts[0].price}
                  </span>
                  {(topProducts[0].sourceUrl || topProducts[0].link) && (
                    <a
                      href={topProducts[0].sourceUrl || topProducts[0].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-[11px] text-cyan-500/80 underline underline-offset-2"
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
                      className="break-words rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
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
                {getMetricChips(topProducts[0]).map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <div
                      key={chip.id}
                      className="flex max-w-full items-start gap-1 rounded bg-white/5 px-2 py-1 text-xs text-slate-300"
                    >
                      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="break-words">{chip.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {topProducts.slice(1, 3).map((product, index) => (
              <div
                key={product.id}
                className="glass-panel flex flex-col rounded-2xl p-3 sm:p-4"
              >
                <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/20">
                  {renderProductImage(product, "h-5 w-5 text-white/30")}
                </div>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">
                    {index === 0 ? "最具性价比" : "探索备选"}
                  </span>
                  <span className="text-[10px] text-cyan-500/70">
                    {product.brand}
                  </span>
                </div>
                <h3 className="mb-1 break-words text-sm font-medium leading-relaxed text-white">
                  {product.name}
                </h3>
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {product.tags.slice(0, 2).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="rounded border border-indigo-500/20 bg-indigo-500/10 px-1 py-0.5 text-[8px] text-indigo-300/80 break-words"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {product.reason && (
                  <p className="mb-2 text-[11px] italic leading-relaxed text-slate-400">
                    “{product.reason}”
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
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

          {backupProducts.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-white">
                  如果你想换一种侧重点
                </h3>
                <p className="max-w-3xl text-sm leading-6 text-slate-400">
                  这些备选不会改动主推荐排序，但能帮你快速切换到更静音、更省预算或更偏特定体验的方向。
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {backupProducts.map((product) => (
                  <article
                    key={product.id}
                    className="glass-panel overflow-hidden rounded-2xl"
                  >
                    <div className="flex h-full flex-col md:flex-row">
                      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/20 md:w-44">
                        {renderProductImage(product, "h-6 w-6 text-white/40")}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-2">
                            <span className="inline-flex max-w-full items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">
                              <span className="break-words">
                                {product.backupLabel}
                              </span>
                            </span>
                            <h4 className="break-words text-base font-medium leading-6 text-white">
                              {product.name}
                            </h4>
                          </div>

                          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                            <span className="text-base font-semibold text-cyan-400">
                              ¥{product.price}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {product.brand}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm leading-6 text-slate-300">
                          {product.backupReason}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {getMetricChips(product).map((chip) => {
                            const Icon = chip.icon;
                            return (
                              <div
                                key={chip.id}
                                className="flex max-w-full items-start gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                              >
                                <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                                <span className="break-words">{chip.label}</span>
                              </div>
                            );
                          })}
                        </div>

                        {(product.sourceUrl || product.link) && (
                          <div className="pt-1">
                            <a
                              href={product.sourceUrl || product.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 transition-colors hover:bg-cyan-500/15"
                            >
                              查看备选
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
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
