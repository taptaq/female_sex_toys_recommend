import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import { createAppAiService } from './app-ai-service.ts';
import { createRecalibrateResultsHandler } from './app-ai-recalibration-route.ts';
import {
  createKnowledgeNebulaCreateCardHandler,
  createKnowledgeNebulaRecordCardViewHandler,
  createKnowledgeNebulaTopicHandler,
  createKnowledgeNebulaUpdateCardHandler,
} from './knowledge-nebula-route.ts';
import {
  createKnowledgeNebulaStore,
  ensureKnowledgeNebulaSchema,
} from './knowledge-nebula-store.ts';
import { createKnowledgeEmbeddingService } from './knowledge-embedding-service.ts';
import { ensureUserRecommendationSchema } from './user-recommendation-store.ts';
import {
  createListUserRecommendationProfilesHandler,
  createSaveUserRecommendationProfileHandler,
} from './user-recommendation-route.ts';
import { createUserRecommendationStore } from './user-recommendation-store.ts';
import { createUsernameRegistrationHandler } from './user-register-route.ts';
import { createUsernameRegistrationService } from './user-register-service.ts';
import { createSupabaseAccessTokenVerifier } from './user-auth.ts';
import { buildSafeDisplayName } from '../lib/product-display-name.ts';
import {
  resolveLibraryAudienceGender,
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from '../lib/library-product-type-classifier.ts';
import { ensureRecommenderItemsSchema } from './recommender-items-schema.ts';

dotenv.config();

const { Pool } = pg;
const app = express();
const port = 3010;
const appAiService = createAppAiService();
const recalibrateResultsHandler = createRecalibrateResultsHandler({ appAiService });

app.use(express.json({ limit: '1mb' }));

// 使用直连数据库地址，确保高稳定性
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const knowledgeEmbeddingService = createKnowledgeEmbeddingService();
const knowledgeNebulaStore = createKnowledgeNebulaStore({
  pool,
  embeddingService: knowledgeEmbeddingService,
});
const userRecommendationStore = createUserRecommendationStore({ pool });
const usernameRegistrationService = createUsernameRegistrationService({
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
const supabaseAccessTokenVerifier = createSupabaseAccessTokenVerifier({
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// 监听连接错误
pool.on('error', (err) => {
  console.error('💥 [Server/DB] 数据库连接池发生灾难性错误:', err);
});

app.get('/api/recommender/toys', async (_req, res) => {
  console.log('📡 [Server] 收到全息库同步指令...');
  try {
    await pool.query(`
      ALTER TABLE public.recommender_toys
      ADD COLUMN IF NOT EXISTS subtype_code TEXT
    `);

    const result = await pool.query(`
      SELECT 
        t.id, t.name, t.safe_display_name, t.price, t.max_db, t.waterproof, 
        t.appearance, t.physical_form, t.motor_type, t.gender, t.type_code, t.subtype_code,
        t.brand, t.material, t.image_url, t.raw_description,
        COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description,
        p.link, p.tags, p.persona_\x61nalysis AS persona_analysis,
        c.is_domestic
      FROM public.recommender_toys t
      LEFT JOIN public.products p ON t.original_id = p.id
      LEFT JOIN public.competitors c ON p.competitor_id = c.id
      ORDER BY t.created_at DESC
    `);

    // 格式化输出为前端兼容的驼峰命名
    const normalized = result.rows.map((t) => {
      const resolvedGender = resolveLibraryAudienceGender({
        gender: t.gender,
        physicalForm: t.physical_form,
        name: t.name,
        rawDescription: [t.raw_description, t.product_raw_description]
          .filter(Boolean)
          .join('\n') || null,
        tags: Array.isArray(t.tags) ? t.tags : [],
      });
      const resolvedTypeCode = resolveLibraryTypeCode(t.type_code, {
        gender: resolvedGender,
        physicalForm: t.physical_form,
        name: t.name,
        rawDescription: [t.raw_description, t.product_raw_description]
          .filter(Boolean)
          .join('\n') || null,
        tags: Array.isArray(t.tags) ? t.tags : [],
      });
      const resolvedSubtypeCode = resolveLibrarySubtypeCode(t.subtype_code, {
        typeCode: resolvedTypeCode,
        gender: resolvedGender,
        physicalForm: t.physical_form,
        name: t.name,
        rawDescription: [t.raw_description, t.product_raw_description]
          .filter(Boolean)
          .join('\n') || null,
        tags: Array.isArray(t.tags) ? t.tags : [],
      });

      return {
        id: t.id,
        name: t.name,
        canonicalName: t.name,
        displayName: t.safe_display_name || buildSafeDisplayName(t.name),
        safeDisplayName: t.safe_display_name || buildSafeDisplayName(t.name),
        price: Number(t.price),
        maxDb: t.max_db,
        waterproof: t.waterproof,
        appearance: t.appearance,
        physicalForm: t.physical_form,
        motorType: t.motor_type,
        gender: resolvedGender,
        typeCode: resolvedTypeCode,
        subtypeCode: resolvedSubtypeCode,
        brand: t.brand || '探索品牌',
        material: t.material || '亲肤材质',
        rawDescription: t.raw_description || t.product_raw_description || null,
        imagePlaceholder: t.image_url || 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40',
        link: t.link,
        sourceUrl: t.link,
        tags: t.tags || [],
        personaAnalysis: t.persona_analysis,
        isDomestic: t.is_domestic,
      };
    });


    console.log(`✅ [Server] 已同步 ${normalized.length} 条晶体库数据`);
    res.json(normalized);
  } catch (error) {
    console.error('❌ [Server] 数据库同步中断:', error);
    res.status(500).json({ error: 'Database synchronization failed', details: String(error) });
  }
});

app.post('/api/ai/rerank', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  try {
    const result = await appAiService.runServerAiProxy<unknown[]>({
      prompt,
      temperature: 0.1,
      emptyJson: '[]',
      logContext: 'Top3 重排',
    });
    res.json(result);
  } catch (error) {
    console.error('❌ [Server/AI] Top3 重排链路全部中断:', error);
    res.status(500).json({ error: 'AI rerank failed', details: String(error) });
  }
});

app.post('/api/ai/result-enhancement', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  try {
    const result = await appAiService.runServerAiProxy<Record<string, unknown>>({
      prompt,
      temperature: 0.3,
      emptyJson: '{}',
      logContext: '结果增强',
    });
    res.json(result);
  } catch (error) {
    console.error('❌ [Server/AI] 结果增强链路全部中断:', error);
    res.status(500).json({ error: 'AI result enhancement failed', details: String(error) });
  }
});

app.post('/api/ai/recalibrate-results', recalibrateResultsHandler);
app.post(
  '/api/auth/register',
  createUsernameRegistrationHandler({
    service: usernameRegistrationService,
  }),
);
app.get(
  '/api/knowledge/topics/:slug',
  createKnowledgeNebulaTopicHandler({ store: knowledgeNebulaStore }),
);
app.post(
  '/api/knowledge/topics/:slug/cards',
  createKnowledgeNebulaCreateCardHandler({ store: knowledgeNebulaStore }),
);
app.patch(
  '/api/knowledge/cards/:cardId',
  createKnowledgeNebulaUpdateCardHandler({ store: knowledgeNebulaStore }),
);
app.post(
  '/api/knowledge/cards/:cardId/view',
  createKnowledgeNebulaRecordCardViewHandler({ store: knowledgeNebulaStore }),
);
app.post(
  '/api/user/recommendation-profiles',
  createSaveUserRecommendationProfileHandler({
    encryptionKey: process.env.PRIVATE_DATA_ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET,
    authVerifier: supabaseAccessTokenVerifier,
    store: userRecommendationStore,
  }),
);
app.get(
  '/api/user/recommendation-profiles',
  createListUserRecommendationProfilesHandler({
    encryptionKey: process.env.PRIVATE_DATA_ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET,
    authVerifier: supabaseAccessTokenVerifier,
    store: userRecommendationStore,
  }),
);

void Promise.all([
  ensureRecommenderItemsSchema(pool),
  ensureKnowledgeNebulaSchema(pool),
  ensureUserRecommendationSchema(pool),
])
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 [Server] 稳定后端桥梁已启动: http://localhost:${port}`);
      console.log(`🔗 [Server] 前端通过 Vite Proxy (/api) 进行量子透传...`);
      console.log(`🪐 [Server] 知识星云表与默认卡片已校准`);
      console.log(`🔐 [Server] 用户推荐档案加密表已校准`);
    });
  })
  .catch((error) => {
    console.error('💥 [Server/Init] 服务初始化失败:', error);
    process.exit(1);
  });
