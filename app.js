import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(express.json());

// --- Database init ---
// (async () => {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log("MongoDB connected");
// })();

// --- User schema ---
const userSchema = new mongoose.Schema({
    telegram_id: { type: Number, required: true, unique: true },
    username: String,
    first_name: String,
    last_name: String,
    photo_url: String,
    paid_until: Date,
});
const User = mongoose.model("User", userSchema);

// --- Telegram login validation helper ---
function validateTelegramAuth(data) {
    const { hash, ...fields } = data;
    const secret = crypto
        .createHash("sha256")
        .update(process.env.TELEGRAM_BOT_TOKEN)
        .digest();
    const checkString = Object.keys(fields)
        .sort()
        .map((k) => `${k}=${fields[k]}`)
        .join("\n");
    const hmac = crypto
        .createHmac("sha256", secret)
        .update(checkString)
        .digest("hex");
    return hmac === hash;
}

// --- POST /auth/telegram ---
app.post("/auth/telegram", async (req, res) => {
    const authData = req.body;
    if (!validateTelegramAuth(authData)) return res.status(401).json({ error: "invalid hash" });

    const {
        id: telegram_id,
        username,
        first_name,
        last_name,
        photo_url,
    } = authData;

    await User.findOneAndUpdate(
        { telegram_id },
        { username, first_name, last_name, photo_url },
        { upsert: true, new: true }
    );

    const token = jwt.sign({ telegram_id }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ token });
});

// --- Serve static landing ---
app.use(express.static(path.join(__dirname, "../web")));

// --- Protected example route ---
app.get("/api/ping", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on ${port}`));
