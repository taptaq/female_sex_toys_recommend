import { motion } from "motion/react";
import { Orbit } from "lucide-react";

export function MatchingPage({
  pageVariants,
  isAiMatching,
  tags,
}: {
  pageVariants: any;
  isAiMatching: boolean;
  tags: string[];
}) {
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

      <div className="text-center space-y-4 h-24">
        <p className="text-xs font-mono text-cyan-500/70 tracking-widest mb-4">
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
    </motion.div>
  );
}
