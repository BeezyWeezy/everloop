import express from 'express';
import helmet  from 'helmet';
import jwt     from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv  from 'dotenv';
import path    from 'node:path';
import fs      from 'node:fs';
import crypto  from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MongoClient, ServerApiVersion } from 'mongodb';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ───────────────────────── Express init ─────────────────────────
const app = express();
app.use(express.json());
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-eval'", 'https://telegram.org'],
                connectSrc: ["'self'", 'https://telegram.org', 'https://infragrid.v.network'],
                frameSrc:  ["https://t.me", "https://oauth.telegram.org"],
                imgSrc:    ["'self'", 'data:', 'https://telegram.org'],
            },
        },
    })
);

// ───────────────────────── MongoDB ─────────────────────────


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (err) {
        console.error('Mongo error', err);
    }
})();

const User = mongoose.model(
    'User',
    new mongoose.Schema({
        telegram_id: { type: Number, unique: true, required: true },
        username:    String,
        first_name:  String,
        last_name:   String,
        photo_url:   String,
        paid_until:  Date,
    })
);

// ───────────────────────── Helpers ─────────────────────────
function validateTelegramAuth(data) {
    const { hash, ...fields } = data;
    const secret = crypto
        .createHash('sha256')
        .update(process.env.TELEGRAM_BOT_TOKEN)
        .digest();

    const checkString = Object.keys(fields)
        .sort()
        .map((k) => `${k}=${fields[k]}`)
        .join('');

    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
    return hmac === hash;
}

// ───────────────────────── Routes ─────────────────────────
app.post('/auth/telegram', async (req, res) => {
    const auth = req.body;
    if (!validateTelegramAuth(auth))
        return res.status(401).json({ error: 'invalid hash' });

    const { id: telegram_id, username, first_name, last_name, photo_url } = auth;

    await User.findOneAndUpdate(
        { telegram_id },
        { username, first_name, last_name, photo_url },
        { upsert: true }
    );

    const token = jwt.sign({ telegram_id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

// static landing with runtime substitution
const staticDir = path.join(__dirname, 'web');
app.use(express.static(staticDir, { extensions: ['html', 'js', 'css'] }));

// health
app.get('/api/ping', (_, res) => res.json({ ok: true }));

// ───────────────────────── Start ─────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
