import express from 'express';
import helmet  from 'helmet';
import jwt     from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv  from 'dotenv';
import path    from 'node:path';
import fs      from 'node:fs';
import crypto  from 'node:crypto';
import { fileURLToPath } from 'node:url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ───── MongoDB ───── */
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
console.log('✅ Mongo connected to DB:', mongoose.connection.name);

const User = mongoose.model('User', new mongoose.Schema({
    telegram_id: { type: Number, unique: true },
    username: String,
    first_name: String,
    last_name: String,
    photo_url: String,
    paid_until: Date,
}, { timestamps: true }));

/* ───── Helpers ───── */
function checkTelegramHash(data) {
    const { hash, ...fields } = data;
    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const check = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
    const hmac  = crypto.createHmac('sha256', secret).update(check).digest('hex');
    return hmac === hash;
}

/* ───── Express ───── */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
    contentSecurityPolicy:{ directives:{
            defaultSrc:["'self'"],
            scriptSrc:["'self'","'unsafe-eval'",'https://telegram.org'],
            frameSrc:['https://t.me','https://oauth.telegram.org'],
            connectSrc:["'self'",'https://telegram.org'],
            imgSrc:["'self'",'data:','https://telegram.org'] } }
}));

/* ───── Routes ───── */
app.post('/auth/telegram', async (req, res) => {
    console.log(req, res);
    if (!checkTelegramHash(req.body)) return res.status(401).json({ error: 'invalid hash' });
    const { id: telegram_id, username, first_name, last_name, photo_url } = req.body;
    const user = await User.findOneAndUpdate({ telegram_id }, { username, first_name, last_name, photo_url }, { new: true, upsert: true });
    console.log('➕ Saved user', user.telegram_id);
    res.json({ token: jwt.sign({ telegram_id }, process.env.JWT_SECRET, { expiresIn:'24h' }) });
});

const staticDir = path.join(__dirname, 'web');
app.use(express.static(staticDir, { extensions:['html'] }));
app.get('/', (_, res) => {
    const html = fs.readFileSync(path.join(staticDir,'index.html'),'utf8').replace('__BOTNAME__', process.env.TELEGRAM_BOT_USERNAME);
    res.type('html').send(html);
});

app.get('/api/ping', (_, res) => res.json({ ok: true }));
app.listen(process.env.PORT || 8080, () => console.log('🚀 Server ready'));
