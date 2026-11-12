// Site data: contacts, stack and projects. Edit only this file.
// The Telegram bot reads the projects from here: keep each one a flat one-line object,
// with id / kind / title / year as double-quoted strings.

export const contacts = {
  upwork: "https://www.upwork.com/",      // [ЗАМЕНИТЬ] ссылка на профиль Upwork
  telegram: "https://t.me/xolchade",      // [ЗАМЕНИТЬ] ник или ссылка на бота
  github: "https://github.com/xolchade",
  email: "hello@xolchade.dev",            // [ЗАМЕНИТЬ] почта
};

export const categories = {
  miniapp: "Mini App",
  bot: "Bot",
  api: "API",
  ai: "AI",
  ui: "UI/UX",
  "3d": "2D/3D",
};

// Portfolio filter: label → which kinds it shows, color = CSS variable of the wire
export const filters = [
  { key: "all", label: "All", kinds: [] },
  { key: "telegram", label: "Telegram", kinds: ["miniapp", "bot"], color: "tg" },
  { key: "api", label: "API", kinds: ["api"], color: "api" },
  { key: "ai", label: "AI", kinds: ["ai"], color: "ai" },
  { key: "ui", label: "UI/UX", kinds: ["ui"], color: "ui" },
  { key: "3d", label: "2D/3D", kinds: ["3d"], color: "d3" },
];

// Running line "Stack / AI I work with"
export const stack = [
  "Telegram Bot API",
  "Telegram Mini Apps",
  "Cloudflare Workers",
  "REST & webhooks",
  "Figma",
  "[ЗАМЕНИТЬ]",
  "[ЗАМЕНИТЬ]",
  "[ЗАМЕНИТЬ]",
];
export const stackAI = [
  "[ЗАМЕНИТЬ] AI model",
  "[ЗАМЕНИТЬ] AI model",
  "[ЗАМЕНИТЬ] AI model",
  "[ЗАМЕНИТЬ] AI tool",
  "[ЗАМЕНИТЬ] AI tool",
  "[ЗАМЕНИТЬ] AI tool",
];

// kind: miniapp | bot | api | ai | ui | 3d ; hue — cover hue (oklch, 0–360)
export const works = [
  { id: "miniapp-1", kind: "miniapp", title: "Telegram Mini App", year: "2026", hue: 256 },
  { id: "ai-1",      kind: "ai",      title: "AI feature",        year: "2026", hue: 5 },
  { id: "api-1",     kind: "api",     title: "API integration",   year: "2026", hue: 72 },
  { id: "bot-1",     kind: "bot",     title: "Telegram bot",      year: "2026", hue: 238 },
  { id: "ui-1",      kind: "ui",      title: "UI/UX project",     year: "2026", hue: 172 },
  { id: "3d-1",      kind: "3d",      title: "2D/3D piece",       year: "2026", hue: 296 },
  { id: "api-2",     kind: "api",     title: "API integration",   year: "2026", hue: 55 },
  { id: "miniapp-2", kind: "miniapp", title: "Telegram Mini App", year: "2026", hue: 268 },
  { id: "ai-2",      kind: "ai",      title: "AI feature",        year: "2026", hue: 350 },
  { id: "bot-2",     kind: "bot",     title: "Telegram bot",      year: "2026", hue: 225 },
  { id: "ui-2",      kind: "ui",      title: "UI/UX project",     year: "2026", hue: 160 },
];
