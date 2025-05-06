import express from 'express';
import jwt     from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv  from 'dotenv';
import path    from 'node:path';
import crypto  from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import cookieParser from 'cookie-parser';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
console.log('✅ Mongo connected:', mongoose.connection.name);

dotenv.config();

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Dummy schema
const UserSchema = new mongoose.Schema({
    telegram_id: { type: Number, unique: true },
    username: String,
    first_name: String,
    last_name: String,
    auth_date: Number // Unix timestamp from Telegram
});const User = mongoose.model('User', UserSchema);

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

    const token = jwt.sign({ telegram_id: id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('jwt', token, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 24 * 3600 * 1000 // 1day
    });
    res.redirect('/dashboard.html');
});

function authRequired(req, res, next) {
    try {
        const payload = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'unauthorized' });
    }
}

app.get('/api/ping', authRequired, (_, res) => res.json({ ok: true }));

app.get('/logout', (_req, res) => {
    res.clearCookie('jwt', { sameSite: 'lax' });
    return res.redirect('/');
});

const staticDir = path.join(__dirname, 'web');
app.use(express.static(staticDir, { extensions: ['html'] }));

app.listen(process.env.PORT || 8080, () => console.log('🚀 Server running'));
