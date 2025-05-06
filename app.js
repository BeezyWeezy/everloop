import express from 'express';
import helmet  from 'helmet';
import jwt     from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv  from 'dotenv';
import path    from 'node:path';
import crypto  from 'node:crypto';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
async function run() {
    try {
        // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
        await mongoose.connect(process.env.MONGO_URI, clientOptions);
        await mongoose.connection.db.admin().command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await mongoose.disconnect();
    }
}
run().catch(console.dir);

/* ───────────────────────── Mongo init ───────────────────────── */
mongoose.set('strictQuery', true);

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ Mongo connection failed:', err.message);
        process.exit(1);
    }
}
await connectDB();

/* ───────────────────────── Mongoose models ───────────────────────── */
const userSchema = new mongoose.Schema({
    telegram_id: { type: Number, unique: true, required: true },
    username:    String,
    first_name:  String,
    last_name:   String,
    photo_url:   String,
    paid_until:  Date,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

/* ───────────────────────── Helpers ───────────────────────── */
function isValidTG(reqBody) {
    const { hash, ...fields } = reqBody;
    const secret = crypto
        .createHash('sha256')
        .update(process.env.TELEGRAM_BOT_TOKEN)
        .digest();
    const check = Object.entries(fields)
        .sort(([a],[b])=>a.localeCompare(b))
        .map(([k,v])=>`${k}=${v}`)
        .join('\n');
    const hmac = crypto.createHmac('sha256', secret).update(check).digest('hex');
    return hmac === hash;
}

/* ───────────────────────── Express init ───────────────────────── */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
    contentSecurityPolicy:{
        directives:{
            defaultSrc:["'self'"],
            scriptSrc:["'self'","'unsafe-eval'",'https://telegram.org'],
            connectSrc:["'self'",'https://telegram.org','https://infragrid.v.network'],
            frameSrc:['https://t.me','https://oauth.telegram.org'],
            imgSrc:["'self'",'data:','https://telegram.org'],
        }
    }
}));

/* ───────────────────────── Routes ───────────────────────── */
app.post('/auth/telegram', async (req,res)=>{
    console.log('TG BODY >>>', req.body);
    if(!isValidTG(req.body)) return res.status(401).json({error:'invalid hash'});
    const { id:telegram_id, username, first_name, last_name, photo_url } = req.body;

    console.log(req.body);

    const user = await User.findOneAndUpdate(
        { telegram_id },
        { $set:{ username, first_name, last_name, photo_url } },
        { new:true, upsert:true }
    );
    console.log('➕ Authenticated TG user', user.telegram_id);
    const token = jwt.sign({ telegram_id }, process.env.JWT_SECRET, { expiresIn:'24h' });
    res.json({ token });
});

// static landing with runtime substitution
const staticDir = path.join(__dirname,'web');
app.use(express.static(staticDir,{ extensions:['html','js','css'] }));
// app.get('/',(_,res)=>{
//     const html = fs.readFileSync(path.join(staticDir,'index.html'),'utf8')
//         .replace('__BOTNAME__', process.env.TELEGRAM_BOT_USERNAME);
//     res.type('html').send(html);
// });

app.get('/api/ping',(_,res)=>res.json({ ok: true }));

/* ───────────────────────── Start server ───────────────────────── */
const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=>console.log(`🚀 Server on ${PORT}`));
