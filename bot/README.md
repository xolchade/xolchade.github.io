# xolchade bot + live site chat

Cloudflare Worker with one Durable Object (`Hub`, SQLite). Runs 24/7 on Cloudflare, free plan.

- **Site chat** (`live-chat.js`): a visitor types on xolchade.dev → the message lands in a Telegram group, one forum topic per visitor → the owner writes in that topic → the answer appears in the visitor's chat live (WebSocket). History survives a reload; if there is no answer for a while the chat asks for an email or @handle.
- **Telegram bot**: the same menu as the site, and DMs to the bot also open a topic in the group.
- **Anti-spam**: Turnstile on a visitor's first message, rate limits per session and per IP, 1000 characters max.

## Deploy

Needs Node.js 20+.

```bash
cd bot
npx wrangler login
npx wrangler secret put BOT_TOKEN          # from @BotFather
npx wrangler secret put SETUP_KEY          # any long password
npx wrangler secret put TURNSTILE_SECRET   # Turnstile widget secret key
npx wrangler deploy                        # prints https://xolchade-bot.<you>.workers.dev
```

1. Open `https://xolchade-bot.<you>.workers.dev/setup?key=<SETUP_KEY>` once (webhook, commands, menu).
2. In the inbox group (Topics on, bot is admin with "Manage topics") send `/bind <SETUP_KEY>`. The bot deletes that message.
3. In `works.js` set `chatApi` to the worker URL and `turnstileKey` to the Turnstile site key.

## Owner commands

`/online`, `/away`: what visitors see in the chat header (also turns "away" by itself after 3 h without activity).
`/status`: state, number of chats, visitors connected right now.

Reactions on your answer: 👍 delivered live, 🕊 stored until the visitor comes back.

## Tests

```bash
node --test bot/test/*.test.mjs
```
