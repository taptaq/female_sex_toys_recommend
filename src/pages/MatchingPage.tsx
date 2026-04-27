import { motion } from "motion/react";
import { Orbit } from "lucide-react";
import { LoadingFunFacts } from "../components/LoadingFunFacts";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";

export function MatchingPage({
  pageVariants,
  isAiMatching,
  tags,
}: {
  pageVariants: any;
  isAiMatching: boolean;
  tags: string[];
}) {
  const matchingFunFacts = getLoadingFunFacts("matching", {
    preferredTags: tags,
    preferredThemes: ["decision", "care", "experience"],
  });

  return (
    <motion.div
      key="loading"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="flex flex-col items-center justify-center py-12"
    >
      <div className="radar-container mb-12">
        <div className="radar-sweep"></div>
        <Orbit className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-500/50" />
      </div>

      <div className="w-full max-w-md text-center space-y-4 min-h-[12.5rem] sm:min-h-[11rem]">
        <p className="text-xs font-mono text-cyan-500/70 tracking-widest">
          {isAiMatching ? "AI 专家深度匹配中..." : "解析物理标签中..."}
        </p>
        {tags.slice(0, 3).map((tag, index) => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.8 }}
            className="text-lg font-light text-white tag-flash"
          >
            {tag}
          </motion.div>
        ))}
      </div>

      <LoadingFunFacts
        facts={matchingFunFacts}
        title={isAiMatching ? "匹配期间，也许这条刚好有用" : "标签解析中，顺手补一条小知识"}
        eyebrow={isAiMatching ? "深度匹配" : "标签参考"}
        className="mt-10 w-full max-w-2xl"
      />
    </motion.div>
  );
}
