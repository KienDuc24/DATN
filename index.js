// index.js (FULL VERSION: Google Login + Chatbot + Admin + Watcher)

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const attachSocket = require('./socketServer');
const cookieParser = require('cookie-parser');
const adminAuth = require('./middleware/adminAuth');
const User = require('./models/User'); 
const setupGameWatcher = require('./watchGames');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MongoStore = require('connect-mongo');

const app = express();
const server = http.createServer(app);

// --- 1. Cấu hình Middleware ---
// Cho phép Frontend (Vercel) gọi API
const frontendURL = process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app';
app.use(cors({
  origin: frontendURL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. Cấu hình Session & Passport (Quan trọng cho Login) ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'datn_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 ngày
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- 3. Cấu hình Google Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // 👇 Dẫn về Server Railway để xử lý logic đăng nhập
    callbackURL: "https://datn-socket.up.railway.app/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        const userEmail = profile.emails?.[0]?.value;
        if (!userEmail) return done(new Error("Không tìm thấy email."), null);

        // Tìm user theo Google ID
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Tìm user theo Email (trường hợp đã đăng ký trước đó)
        user = await User.findOne({ email: userEmail });
        if (user) {
            user.googleId = profile.id;
            if (!user.displayName) user.displayName = profile.displayName;
            await user.save();
            return done(null, user);
        }

        // Tạo user mới
        let newUser = new User({
            googleId: profile.id,
            email: userEmail,
            username: userEmail, // Dùng email làm username
            displayName: profile.displayName
        });
        
        try {
            await newUser.save();
            return done(null, newUser);
        } catch (err) {
            // Xử lý trùng username
            if (err.code === 11000) { 
                 const fallbackUsername = userEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
                 newUser = new User({
                    googleId: profile.id,
                    email: userEmail,
                    username: fallbackUsername,
                    displayName: profile.displayName
                });
                await newUser.save();
                return done(null, newUser);
            }
            return done(err, null);
        }
    } catch (err) { return done(err, null); }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) { done(err, null); }
});

// --- 4. Khởi tạo Socket & Routes ---
const io = attachSocket(server); 

try {
  // Đăng ký các Route API
  app.use('/api/room', require('./routes/roomRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/admin', adminAuth, require('./routes/adminRoutes')(io)); 
  app.use('/api', require('./routes/publicRoutes'));
  app.use('/api/ai', require('./routes/chatbotRoutes')); // Route Chatbot
  
  // Route Admin Web (Giao diện quản lý)
  app.use('/admin', require('./routes/adminAuthRoutes')); 
  
  console.log('[index] Routes mounted successfully.');
} catch (e) {
  console.error('[index] Error mounting routes:', e.message);
}

// --- 5. Phục vụ File Tĩnh cho Admin ---
app.get('/admin-login', (req, res) => { res.sendFile(path.join(__dirname, 'public/admin-login.html')); });
app.get('/admin', adminAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public/admin.html')); });
app.get('/admin.html', adminAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public/admin.html')); });
app.get('/admin.js', adminAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public/admin.js')); });
app.get('/css/admin.css', (req, res) => { res.sendFile(path.join(__dirname, 'public/css/admin.css')); });
app.get('/admin-login.css', (req, res) => { res.sendFile(path.join(__dirname, 'public/admin-login.css')); });
app.get('/admin-login.js', (req, res) => { res.sendFile(path.join(__dirname, 'public/admin-login.js')); });

// --- 6. Google Auth Endpoints ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }), 
  (req, res) => {
    // Đăng nhập thành công -> Chuyển hướng về Frontend Vercel
    const targetUrl = process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app';
    const userQuery = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${targetUrl}/?user=${userQuery}`);
  }
);

// --- 7. Khởi động Server ---
const PORT = process.env.PORT || 3000;
async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    
    // Kết nối Database
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('[index] Connected to MongoDB.');

    // Chạy Game Watcher (Quét game)
    const updateGamesFunction = setupGameWatcher();
    await updateGamesFunction();

    // Socket Events (Trạng thái Online)
    io.on('connection', (socket) => {
        socket.on('registerSocket', async (username) => {
          if (!username || username.startsWith('guest_')) return;
          try {
            await User.findOneAndUpdate({ username: username }, { status: 'online', socketId: socket.id });
            io.emit('admin-user-status-changed');
          } catch (e) { console.error('registerSocket error', e.message); }
        });
    });

    server.listen(PORT, () => {
      console.log(`[index] Server + Socket running on port ${PORT}`);
    });
    
  } catch (err) {
    console.error('[index] STARTUP ERROR:', err.message);
    process.exit(1);
  }
}
start();

// Error Handler
app.use((err, req, res, next) => {
  console.error('[server][ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});