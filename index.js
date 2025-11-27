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
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const server = http.createServer(app);

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

app.use(session({
  secret: process.env.SESSION_SECRET || 'datn_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://datn-socket.up.railway.app/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        const userEmail = profile.emails?.[0]?.value;
        if (!userEmail) return done(new Error("Không thể lấy email từ Google."), null);

        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        user = await User.findOne({ email: userEmail });
        if (user) {
            user.googleId = profile.id;
            if (!user.displayName) user.displayName = profile.displayName;
            await user.save();
            return done(null, user);
        }

        const newUsername = userEmail;
        const newDisplayName = profile.displayName;

        let newUser = new User({
            googleId: profile.id,
            email: userEmail,
            username: newUsername,
            displayName: newDisplayName,
            isVerified: true
        });
        
        try {
            await newUser.save();
            return done(null, newUser);
        } catch (err) {
            if (err.code === 11000) { 
                 const fallbackUsername = userEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
                 newUser = new User({
                    googleId: profile.id,
                    email: userEmail,
                    username: fallbackUsername,
                    displayName: newDisplayName,
                    isVerified: true
                });
                await newUser.save();
                return done(null, newUser);
            }
            return done(err, null);
        }
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user._id); 
});

passport.deserializeUser(async (id, done) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log(`[Auth] Phát hiện ID phiên cũ không hợp lệ: ${id}. Tự động đăng xuất.`);
        return done(null, null); 
    }

    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error('[Auth] Lỗi deserialize:', err);
    done(err, null);
  }
});

const io = attachSocket(server); 

try {
  app.use('/api/room', require('./routes/roomRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/admin', require('./routes/adminAuthRoutes')); 
  app.use('/api/admin', adminAuth, require('./routes/adminRoutes')(io)); 
  app.use('/api', require('./routes/publicRoutes'));
  app.use('/api/ai', require('./routes/chatbotRoutes'));
  app.use('/api/report', require('./routes/reportRoutes'));
  
  console.log('[index] All routes mounted successfully.');
} catch (e) {
  console.error('[index] Error mounting routes:', e.message);
}

app.get('/admin-login', (req, res) => { res.sendFile(path.join(__dirname, 'public/admin-login.html')); });
app.get('/admin', adminAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public/admin.html')); });
app.get('/admin.html', adminAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public/admin.html')); });
app.get('/admin.js', adminAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public/admin.js')); });
app.get('/css/admin.css', (req, res) => { res.sendFile(path.join(__dirname, 'public/css/admin.css')); });
app.get('/admin-login.css', (req, res) => { res.sendFile(path.join(__dirname, 'public/admin-login.css')); });
app.get('/admin-login.js', (req, res) => { res.sendFile(path.join(__dirname, 'public/admin-login.js')); });

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }), 
  (req, res) => {
    const targetUrl = 'https://datn-smoky.vercel.app';
    const userQuery = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${targetUrl}/?user=${userQuery}`);
  }
);

const PORT = process.env.PORT || 3000;
async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] Connected to MongoDB.');

    const updateGamesFunction = setupGameWatcher();
    await updateGamesFunction();

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
    console.error('[index] FATAL STARTUP ERROR:', err.message);
    process.exit(1);
  }
}
start();

app.use((err, req, res, next) => {
  console.error('[server][ERROR]', err && (err.stack || err.message));
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});