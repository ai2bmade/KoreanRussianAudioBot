const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(ROOT_DIR, "content", "expressions.json");
const DEFAULT_DAILY_LIMIT = 3;

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("Missing required environment variable TELEGRAM_BOT_TOKEN");
}

const buyMeACoffeeUrl = process.env.BUY_ME_A_COFFEE_URL || "";
const dailyLimit = Number.parseInt(process.env.FREE_DAILY_LIMIT || `${DEFAULT_DAILY_LIMIT}`, 10);
const activeChatIds = new Set(
  (process.env.ACTIVE_CHAT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const usageByDay = new Map();

function loadExpressions() {
  const raw = fs.readFileSync(CONTENT_PATH, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.expressions) || parsed.expressions.length === 0) {
    throw new Error("content/expressions.json must contain a non-empty expressions array");
  }
  return parsed.expressions;
}

const expressions = loadExpressions();
const bot = new Telegraf(token);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function chatIdOf(ctx) {
  return String(ctx.chat?.id || ctx.from?.id || "");
}

function isActive(chatId) {
  return activeChatIds.has(chatId);
}

function usageKey(chatId) {
  return `${todayKey()}:${chatId}`;
}

function getUsage(chatId) {
  return usageByDay.get(usageKey(chatId)) || 0;
}

function incrementUsage(chatId) {
  const key = usageKey(chatId);
  usageByDay.set(key, (usageByDay.get(key) || 0) + 1);
}

function pickExpression() {
  return expressions[Math.floor(Math.random() * expressions.length)];
}

function keyboard() {
  const rows = [
    [Markup.button.callback("Next Practice", "practice")],
    [Markup.button.callback("Daily Challenge", "challenge")]
  ];

  if (buyMeACoffeeUrl) {
    rows.push([Markup.button.url("Buy Me a Coffee", buyMeACoffeeUrl)]);
  }

  return Markup.inlineKeyboard(rows);
}

function nextPracticeKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Next Practice", "practice")]]);
}

function challengeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Korean -> Russian", "challenge_ko_ru")],
    [Markup.button.callback("Russian -> Korean", "challenge_ru_ko")],
    [Markup.button.callback("Next Practice", "practice")]
  ]);
}

function supportKeyboard() {
  if (buyMeACoffeeUrl) {
    return Markup.inlineKeyboard([
      [Markup.button.url("Buy Me a Coffee", buyMeACoffeeUrl)],
      [Markup.button.callback("Next Practice", "practice")]
    ]);
  }

  return nextPracticeKeyboard();
}

function expressionText(expression) {
  return [
    "Korean:",
    expression.ko,
    "",
    `${expression.language}:`,
    expression.foreign,
    "",
    "오디오 파일을 다시 누르면 추가로 반복해서 들을 수 있습니다.",
    "Нажмите на аудиофайл ещё раз, чтобы повторить прослушивание."
  ].join("\n");
}

async function sendExpression(ctx, expression) {
  await ctx.reply(expressionText(expression));

  const audioPath = path.join(ROOT_DIR, expression.audio);
  if (fs.existsSync(audioPath)) {
    await ctx.replyWithAudio({ source: audioPath, filename: `${expression.id}.ogg` }, nextPracticeKeyboard());
    return;
  }

  await ctx.reply(`Audio file is not ready yet: ${expression.id}.ogg`, nextPracticeKeyboard());
}

async function startPractice(ctx) {
  const chatId = chatIdOf(ctx);
  if (!chatId) return;

  const active = isActive(chatId);
  const used = getUsage(chatId);

  if (!active && used >= dailyLimit) {
    await ctx.reply(
      [
        "오늘의 무료 연습이 끝났습니다.",
        "24시간 후에 다시 연습하실 수 있습니다.",
        "",
        "Бесплатная практика на сегодня закончена.",
        "Вы сможете снова заниматься через 24 часа.",
        "",
        "Buy Me a Coffee로 후원하시면 3개월 동안 제한 없이 연습하실 수 있습니다."
      ].join("\n"),
      supportKeyboard()
    );
    return;
  }

  const expression = pickExpression();
  if (!active) {
    incrementUsage(chatId);
  }
  await sendExpression(ctx, expression);

  if (!active && getUsage(chatId) >= dailyLimit) {
    await ctx.reply(
      [
        "오늘의 무료 3개 표현을 모두 들으셨습니다.",
        "24시간 후에 다시 연습하실 수 있습니다.",
        "",
        "Вы прослушали 3 бесплатных выражения на сегодня.",
        "Следующая бесплатная практика будет доступна через 24 часа."
      ].join("\n"),
      supportKeyboard()
    );
  }
}

async function sendChallenge(ctx) {
  const chatId = chatIdOf(ctx);
  if (!isActive(chatId)) {
    await ctx.reply(
      [
        "Daily Challenge는 유료 회원용 연습입니다.",
        "$5 Buy Me a Coffee 후원 후 Telegram ID를 보내주시면 3개월 동안 활성화됩니다.",
        "",
        "Daily Challenge доступен для активных пользователей.",
        "После поддержки проекта на $5 отправьте ваш Telegram ID для активации на 3 месяца."
      ].join("\n"),
      supportKeyboard()
    );
    return;
  }

  await ctx.reply("Choose your daily challenge type.", challengeKeyboard());
}

bot.start(async (ctx) => {
  await ctx.reply(
    [
      "안녕하세요!",
      "",
      "이 봇은 한국어를 배우고 싶은 러시아어권 학습자를 위한 듣기 연습 봇입니다.",
      "동시에 러시아어를 배우는 한국인에게도 도움이 되도록 만들었습니다.",
      "",
      "각 오디오 파일에는 한국어 표현과 러시아어 표현이 함께 들어 있으며, 같은 표현이 최소 20번 이상 반복됩니다.",
      "오디오 파일을 다시 누르면 추가로 반복해서 들을 수 있습니다.",
      "",
      `무료 학습자는 하루에 ${dailyLimit}개의 표현을 들을 수 있습니다.`,
      "Buy Me a Coffee로 $5를 후원해 주시면 3개월 동안 약 3,000개의 다양한 표현을 제한 없이 듣고 연습하실 수 있습니다.",
      "",
      "Здравствуйте!",
      "",
      "Этот бот создан для русскоязычных учеников, которые хотят изучать корейский язык.",
      "Он также полезен корейцам, которые изучают русский язык.",
      "",
      "В каждом аудиофайле есть корейское выражение и русский вариант. Одно выражение повторяется не менее 20 раз.",
      "Чтобы повторить прослушивание, просто нажмите на аудиофайл ещё раз.",
      "",
      `Бесплатные пользователи могут слушать ${dailyLimit} выражения в день.`,
      "Поддержите проект на $5 через Buy Me a Coffee, и вы получите доступ на 3 месяца примерно к 3,000 выражениям.",
      "",
      "Use /id to check your Telegram ID."
    ].join("\n"),
    keyboard()
  );
});

bot.command("id", async (ctx) => {
  await ctx.reply(`Your Telegram ID: ${chatIdOf(ctx)}`);
});

bot.command("practice", startPractice);

bot.action("practice", async (ctx) => {
  await ctx.answerCbQuery();
  await startPractice(ctx);
});

bot.action("challenge", async (ctx) => {
  await ctx.answerCbQuery();
  await sendChallenge(ctx);
});

bot.action("challenge_ko_ru", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Korean -> Russian challenge will be added after the expression set is finalized.", nextPracticeKeyboard());
});

bot.action("challenge_ru_ko", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Russian -> Korean challenge will be added after the expression set is finalized.", nextPracticeKeyboard());
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

bot.launch();
console.log(`Listening practice bot started with ${expressions.length} expressions.`);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
