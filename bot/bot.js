import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import dotenv from "dotenv";

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('login', async ctx => {
    const res = await fetch(`${process.env.BASE_URL}/api/create-login-code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-bot-token': process.env.BOT_API_SECRET
        },
        body: JSON.stringify({ telegram_id: ctx.from.id })
    });
    const { url } = await res.json();
    ctx.reply('Нажмите «Войти» в браузере', { reply_markup: { inline_keyboard: [[{ text: 'Войти', url }]] } });
});

bot.launch();

console.log('🤖 Bot started');
