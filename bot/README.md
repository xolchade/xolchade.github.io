# xolchade bot

Telegram bot for Cloudflare Workers. Same conversation as the chat on the site,
plus lead forwarding: anything a visitor writes lands in the owner's DMs, and the owner
answers by replying to that message.

Env vars: `BOT_TOKEN` (secret), `OWNER_ID`, `SETUP_KEY` (secret).
After deploy open `https://<worker-url>/setup?key=<SETUP_KEY>` once.
Projects are read from `/works.js` on the site.
