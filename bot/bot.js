import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Start handler – shows login button immediately
bot.start(async ctx => {
    try {
        const response = await fetch(`${process.env.BASE_URL}/api/create-login-code`, {
            method: 'POST',
            headers: {
                'Content-Type': "application/json",
                'x-bot-token': process.env.BOT_API_SECRET
            },
            body: JSON.stringify({ telegram_id: ctx.from.id })
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('Login code creation failed:', response.status, text);
            return ctx.reply('⚠️ Не удалось получить ссылку для входа, попробуйте позже.');
        }
        const { url } = await response.json();
        return ctx.reply(
            'Добро пожаловать в Everloop! Используйте кнопку ниже, чтобы войти в веб‑интерфейс.',
            Markup.inlineKeyboard([
                Markup.button.url('Войти в дашборд', url)
            ])
        );
    } catch (err) {
        console.error('Error during /start command:', err);
        return ctx.reply('⚠️ Произошла ошибка, попробуйте позже.');
    }
});

// Legacy /login command fallback
bot.command('login', async ctx => {
    try {
        const response = await fetch(`${process.env.BASE_URL}/api/create-login-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': process.env.BOT_API_SECRET
            },
            body: JSON.stringify({ telegram_id: ctx.from.id })
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('Login code creation failed:', {
                status: response.status,
                text,
                telegram_id: ctx.from.id
            });
            return ctx.reply('⚠️ Не удалось получить ссылку для входа, попробуйте позже.');
        }
        const { url } = await response.json();
        return ctx.reply(
            'Нажмите «Войти» в браузере 👇',
            Markup.inlineKeyboard([
                Markup.button.url('Войти в дашборд', url)
            ])
        );
    } catch (err) {
        console.error('Error during /login command:', err);
        return ctx.reply('⚠️ Произошла ошибка, попробуйте позже.');
    }
});

bot.launch();
console.log('🤖 Bot started');
