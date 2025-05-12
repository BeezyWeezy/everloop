import express from 'express';
import jwt     from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv  from 'dotenv';
import path    from 'node:path';
import crypto  from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuid } from 'uuid';
import { WebSocketServer } from 'ws';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
console.log('✅ Mongo connected:', mongoose.connection.name);

const app = express();
const server = app.listen(process.env.PORT || 3000);
const wss = new WebSocketServer({ server });
// Хранение активных соединений
const connections = new Map();
wss.on('connection', (ws, req) => {
    // Получаем JWT из cookie при подключении
    const token = req.headers.cookie?.split(';')
        .find(c => c.trim().startsWith('jwt='))
        ?.split('=')[1];
    if (token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            ws.telegram_id = payload.telegram_id;

            // Сохраняем соединение
            if (!connections.has(payload.telegram_id)) {
                connections.set(payload.telegram_id, new Set());
            }
            connections.get(payload.telegram_id).add(ws);

            // Очистка при закрытии соединения
            ws.on('close', () => {
                const userConnections = connections.get(payload.telegram_id);
                if (userConnections) {
                    userConnections.delete(ws);
                    if (userConnections.size === 0) {
                        connections.delete(payload.telegram_id);
                    }
                }
            });
        } catch {
            ws.close();
        }
    }
});
// Функция для отправки уведомлений всем подключенным клиентам пользователя
// function notifyUserClients(telegram_id, message) {
//     const userConnections = connections.get(telegram_id);
//     if (userConnections) {
//         const messageStr = JSON.stringify(message);
//         for (const ws of userConnections) {
//             ws.send(messageStr);
//         }
//     }
// }
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Dummy schema
const UserSchema = new mongoose.Schema({
    telegram_id: {
        type: Number,
        unique: true,
        required: true,
        min: 1
    },
    username: String,
    first_name: String,
    last_name: String,
    auth_date: {
        type: Number,
        required: true
    }
});

const User = mongoose.model('User', UserSchema);

const LoginCodeSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    telegram_id: { type: Number },
    expires_in: Date,
});

const LoginCode = mongoose.model('LoginCode', LoginCodeSchema);

app.get('/auth/telegram', async (req, res) => {
    console.log('Received GET /auth/telegram', req.query);

    const { id, username, first_name, last_name, hash, auth_date } = req.query;
    if (!id || !hash) return res.status(400).send('Missing id or hash');

    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const checkString = Object.entries(req.query)
        .filter(([k]) => k !== 'hash')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (hmac !== hash) return res.status(401).send('Invalid hash');

    const user = await User.findOneAndUpdate(
        { telegram_id: id },
        { username, first_name, last_name, auth_date },
        { upsert: true, new: true }
    );
    console.log('Saved user:', user);
    issueJwtAndRedirect(res, id);

    const token = jwt.sign({ telegram_id: id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('jwt', token, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 24 * 3600 * 1000 // 1day
    });
    res.redirect('/dashboard.html');
});

/* ─── Bot creates one‑time login URL ─── */
app.post('/api/create-login-code', async (req, res) => {
    if (req.get('x-bot-token') !== process.env.BOT_API_SECRET) return res.sendStatus(403);
    const { telegram_id } = req.body;
    const code = uuid();
    await LoginCode.create({ code, telegram_id, expires_in: new Date(Date.now() + 10 * 60 * 1000) });
    res.json({ url: `${process.env.BASE_URL}/bot-login?code=${code}` });
});

/* ─── User opens link from bot ─── */
app.get('/bot-login', async (req, res) => {
    try {
        const { code } = req.query;
        console.log('Processing login code:', code);
        if (!code) return res.status(400).send('Missing code parameter');

        const doc = await LoginCode.findOneAndDelete({
            code,
            expires_in: { $gt: new Date() }
        });
        if (!doc) return res.status(410).send('Link expired or invalid');

        // Find or create user
        let user = await User.findOne({ telegram_id: doc.telegram_id });
        if (!user) {
            user = await User.create({
                telegram_id: doc.telegram_id,
                auth_date: Math.floor(Date.now() / 1000)
            });
        }
        issueJwtAndRedirect(res, user.telegram_id);
    } catch (error) {
        console.error('Bot login error:', error);
        res.status(500).send('Internal server error');
    }
});

/* ─── Helper to set cookie + redirect ─── */
function issueJwtAndRedirect(res, telegram_id) {
    const token = jwt.sign({ telegram_id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('jwt', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400_000 });
    res.redirect('/dashboard.html');
}

/* ─── Auth middleware ─── */
function authRequired(req, res, next) {
    try {
        const payload = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'unauthorized' });
    }
}

/* ─── Protected routes ─── */
app.get('/dashboard.html', authRequired, (_req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'dashboard.html'));
});

app.get('/api/ping', authRequired, (_, res) => res.json({ ok: true }));

/* ─── Logout ─── */
app.get('/logout', (_req, res) => {
    res.clearCookie('jwt', { sameSite: 'lax' });
    res.redirect('/');
});

const staticDir = path.join(__dirname, 'web');
app.use(express.static(staticDir, { extensions: ['html'] }));

app.listen(process.env.PORT || 8080, () => console.log('🚀 Server running'));
