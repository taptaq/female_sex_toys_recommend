import type { AnswerState } from "../data/mock.ts";

export function deriveAnswersFromNaturalLanguage(prompt: string) {
  const text = String(prompt || "").trim();
  const tags = new Set<string>();
  const answers: AnswerState = { tags: [] };

  if (/女生|女性|女用|给自己|阴蒂|g点|跳蛋|震动棒/.test(text)) {
    answers.gender = "female";
    tags.add("女性向");
  } else if (/男生|男性|男用|飞机杯|前列腺|阴茎|杯/.test(text)) {
    answers.gender = "male";
    tags.add("男性向");
  } else if (/情侣|两个人|双人|异地|共用/.test(text)) {
    answers.gender = "unisex";
    tags.add("情侣共玩");
  }

  if (/异地|远程|互动/.test(text)) {
    answers.interactionMode = "remote";
    tags.add("远程互动");
  }

  if (/新手|第一次|怕刺激|慢热/.test(text)) {
    answers.experienceLevel = "sensitive";
    answers.motorType = "gentle";
    tags.add("温柔慢热");
  }

  if (/静音|不要太吵|别太吵|宿舍|同住|夜晚/.test(text)) {
    answers.maxDb = 50;
    tags.add("静音优先");
  }

  if (/容易清洁|好清洁|好打理|防水|可水洗/.test(text)) {
    answers.waterproof = 7;
    tags.add("清洁省心");
  }

  if (/低调|别太高调|外观低调|隐蔽|伪装/.test(text)) {
    answers.appearance = "normal";
    tags.add("外观低调");
  }

  const budgetWithinMatch =
    text.match(/预算\s*([0-9]{2,5})\s*(以内|以下|内)/) ||
    text.match(/([0-9]{2,5})\s*块.*?(以内|以下|内)/) ||
    text.match(/([0-9]{2,5})\s*元.*?(以内|以下|内)/);
  if (budgetWithinMatch) {
    const max = Number(budgetWithinMatch[1]);
    if (Number.isFinite(max) && max > 0) {
      answers.budget = [0, max];
      tags.add("预算约束");
    }
  }

  answers.tags = Array.from(tags);

  return {
    prompt: text,
    answers,
  };
}
