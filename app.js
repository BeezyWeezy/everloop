import express from 'express';
import helmet  from 'helmet';
import jwt     from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv  from 'dotenv';
import path    from 'node:path';
import fs      from 'node:fs';
import crypto  from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
console.log('✅ Mongo connected:', mongoose.connection.name);

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Dummy schema for example
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

    const token = jwt.sign({ telegram_id: id }, process.env.JWT_SECRET || 'changeme', { expiresIn: '24h' });
    res.send(`<h1>Login successful</h1><p>Your token: ${token}</p>`);
});

const staticDir = path.join(__dirname, 'web');
app.use(express.static(staticDir, { extensions: ['html'] }));

app.listen(process.env.PORT || 8080, () => console.log('🚀 Server running'));
