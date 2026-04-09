export type Product = {
  id: string;
  name: string;
  price: number;
  maxDb: number;
  waterproof: number; // IPX level
  appearance: 'high_disguise' | 'normal';
  physicalForm: 'external' | 'internal' | 'composite';
  motorType: 'gentle' | 'strong';
  gender: 'male' | 'female' | 'unisex';
  brand: string;
  material: string;
  imagePlaceholder: string;
  link?: string;
  tags?: string[];
  reason?: string; // AI 推荐理由
  personaAnalysis?: string; // 适用人群分析
};

export const products: Product[] = [];

export type AnswerState = {
  gender?: 'male' | 'female' | 'unisex';
  physicalForm?: 'external' | 'internal' | 'composite';
  motorType?: 'gentle' | 'strong';
  maxDb?: number;
  waterproof?: number;
  budget?: [number, number];
  appearance?: 'high_disguise' | 'normal';
  tags: string[];
};

export type Question = {
  id: string;
  title: string;
  subtitle: string;
  field: keyof AnswerState;
  options: { label: string; value: any; tag: string }[];
  applicableGenders?: ('male' | 'female' | 'unisex')[];
};


export const questions: Question[] = [
  {
    id: 'q0',
    title: '航向选择',
    subtitle: '请选择你的内太空探索方向（提示：设备的使用对象分类）',
    field: 'gender',
    options: [
      { label: '女性向探索（跳蛋、震动棒、吮吸器等）', value: 'female', tag: '女性向' },
      { label: '男性向探索（飞机杯、飞机杯附件等）', value: 'male', tag: '男性向' },
      { label: '中性/情侣共用（情侣共震器等）', value: 'unisex', tag: '中性/共用' },
    ]
  },
  {
    id: 'q1',
    title: '探索倾向',
    subtitle: '你更期待哪种维度的内太空漫游？（提示：期望的刺激部位）',
    field: 'physicalForm',
    applicableGenders: ['female', 'unisex'],
    options: [
      { label: '外部星环的碰触（仅在外部震动/吮吸，不进入体重）', value: 'external', tag: '外部震动/吮吸' },
      { label: '深入核心的探索（纯入体，适合寻求充实与饱满感）', value: 'internal', tag: '纯入体' },
      { label: '内外维度的共振（内外同时刺激的复合机型）', value: 'composite', tag: '复合机型' },
    ]
  },
  {
    id: 'q1_m',
    title: '驱动倾向',
    subtitle: '你更喜欢哪种操控体验？（提示：手动或全自动）',
    field: 'physicalForm',
    applicableGenders: ['male'],
    options: [
      { label: '手动掌控（自主控制节奏，体验真实的包裹感）', value: 'external', tag: '手动型' },
      { label: '自动化驱动（释放双手，享受高频震动或活塞）', value: 'internal', tag: '自动型' },
      { label: '复合体验（动电结合或多重附件加持）', value: 'composite', tag: '复合型' },
    ]
  },
  {
    id: 'q2',
    title: '经验与敏感度',
    subtitle: '你的感官接收器处于什么状态？（提示：自身对刺激的敏感程度）',
    field: 'motorType',
    applicableGenders: ['female', 'unisex'],
    options: [
      { label: '信号敏锐（敏感易痛或纯新手，适合温柔电机）', value: 'gentle', tag: '温柔型电机' },
      { label: '需要强力能量注入（有经验或耐受度高，需要强力震感）', value: 'strong', tag: '强力型多频段' },
    ]
  },
  {
    id: 'q2_m',
    title: '通道体验',
    subtitle: '你偏好的通道刺激度是？（提示：材质柔软度与内壁纹理）',
    field: 'motorType',
    applicableGenders: ['male'],
    options: [
      { label: '慢玩柔软（低刺激，适合久战或敏感体质）', value: 'gentle', tag: '慢玩柔软' },
      { label: '紧致榨汁（高刺激，追求快速爆发或进阶体验）', value: 'strong', tag: '紧致刺激' },
    ]
  },
  {
    id: 'q3',
    title: '听觉隐蔽',
    subtitle: '你的内太空舱隔音效果如何？（提示：使用环境是否怕吵到别人）',
    field: 'maxDb',
    options: [
      { label: '舱壁较薄，需航行静音（合租或宿舍，要求设备极低噪音）', value: 45, tag: '< 45dB' },
      { label: '独立空间，无惧轰鸣（独居或隔音好，无需顾虑设备声音）', value: 100, tag: '无限制分贝' },
    ]
  },
  {
    id: 'q4',
    title: '清洁与维护',
    subtitle: '航行结束后的清理偏好？（提示：由于体液残留，是否需要深度水洗）',
    field: 'waterproof',
    options: [
      { label: '直接在水流中冲洗净化（可能在浴室使用，需全身强力防水）', value: 7, tag: '≥ IPX7 防水' },
      { label: '简单的表面擦拭即可（用专用湿巾擦拭表面即可，基础防水）', value: 6, tag: '基础防水' },
    ]
  },
  {
    id: 'q5',
    title: '能源预算',
    subtitle: '为这次探索准备了多少能量储备？（提示：心理预期的价格区间）',
    field: 'budget',
    options: [
      { label: '轻量级（100元以内的基础尝鲜）', value: [0, 100], tag: '入门级' },
      { label: '标准级（100-300元的进阶品质）', value: [100, 300], tag: '进阶级' },
      { label: '探索级（300元以上的旗舰体验）', value: [300, 10000], tag: '旗舰级' },
    ]
  },
  {
    id: 'q6',
    title: '视觉隐蔽',
    subtitle: '装备是否需要伪装形态？（提示：被室友或家人看到是否会社会性死亡）',
    field: 'appearance',
    options: [
      { label: '需要伪装（造型像口红、化妆盒等日常物品，绝对隐匿）', value: 'high_disguise', tag: '高伪装' },
      { label: '保持科技形态（藏得很严实或独居，造型夸张也无所谓）', value: 'normal', tag: '无伪装限制' },
    ]
  }
];
