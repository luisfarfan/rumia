import { Bot } from 'grammy';
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables.');
}

/**
 * The Telegram client, constructed but deliberately NOT started.
 *
 * Handlers and workers import the bot from here — never from `./index.js` — so
 * that pulling in a handler cannot open a second `getUpdates` connection. Only
 * `src/bot/index.ts` starts polling; two pollers on one token make Telegram
 * reject both with HTTP 409 Conflict.
 */
export const bot = new Bot(token);
