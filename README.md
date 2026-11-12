# xolchade.dev

Portfolio: Telegram Mini Apps & bots, API integrations, AI integrations, UI/UX, 2D/3D.
No build step, no dependencies: plain HTML/CSS/ES modules, a raw WebGL shader for the hero,
one self-hosted variable font. Light & dark themes.

- `works.js` — projects, contacts, stack. The only file to edit for content (search for `[ЗАМЕНИТЬ]`).
  Keep each project a flat one-line object: the Telegram bot parses this file.
- `DESIGN.md` — design spec: concept, type, colors, every animation.
- `bot/` — Telegram bot (Cloudflare Worker) that mirrors the site chat.
- Press `` ` `` on the site for a little surprise.
