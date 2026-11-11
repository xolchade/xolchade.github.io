// Данные сайта: контакты и работы. Меняй только этот файл.
export const contacts = {
  telegram: "https://t.me/xolchade",   // заглушка — поставь свой ник
  telegramLabel: "@xolchade",
  github: "https://github.com/xolchade",
};

export const categories = {
  miniapp: "Mini App",
  bot: "Бот",
  ui: "UI/UX",
};

// kind: miniapp | bot | ui ; hue — оттенок обложки-заглушки (0–360)
export const works = [
  { id: "miniapp-1", kind: "miniapp", title: "Telegram Mini App", year: "2026", hue: 230 },
  { id: "bot-1",     kind: "bot",     title: "Telegram-бот",      year: "2026", hue: 170 },
  { id: "ui-1",      kind: "ui",      title: "UI/UX-проект",      year: "2026", hue: 280 },
  { id: "miniapp-2", kind: "miniapp", title: "Telegram Mini App", year: "2026", hue: 200 },
  { id: "bot-2",     kind: "bot",     title: "Telegram-бот",      year: "2026", hue: 140 },
  { id: "ui-2",      kind: "ui",      title: "UI/UX-проект",      year: "2026", hue: 320 },
];
