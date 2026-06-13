import dotenv from "dotenv";
import pg from "pg";

import { createRecommendationSessionStore } from "../server/recommendation-session-store.ts";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const store = createRecommendationSessionStore({ pool });
  const { deletedCount } = await store.deleteExpiredSessions();
  console.log(`✅ 已清理 ${deletedCount} 条过期推荐会话`);
}

main()
  .catch((error) => {
    console.error("💥 清理过期推荐会话失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
