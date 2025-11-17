// index.js (ĐÃ SỬA ĐỔI)

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
const setupGameWatcher = require('./watchGames'); // <-- THÊM MỚI: Import watcher
const chatbotRoutes = require('./routes/chatbotRoutes'); // <-- giữ duy nhất 1 khai báo
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MongoStore = require('connect-mongo');

const app = express();
const server = http.createServer(app);

// --- 1. Cấu hình Middleware ---
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

// --- 2.A. Cấu hình Express Session ---
// (Cần thiết để Passport lưu thông tin đăng nhập)
app.use(session({
  secret: process.env.SESSION_SECRET || 'datn_secret_key', // Lấy từ .env
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI, // Lấy từ .env
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 ngày
  }
}));

// --- 2.B. Khởi tạo Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- 2.C. Cấu hình Google Strategy cho Passport ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, // Lấy từ .env
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Lấy từ .env
    callbackURL: process.env.GOOGLE_CALLBACK_URL // Lấy từ .env
  },
  async (accessToken, refreshToken, profile, done) => {
    // Hàm này sẽ được gọi khi Google xác thực thành công
    try {
        const userEmail = profile.emails?.[0]?.value;
        if (!userEmail) {
            return done(new Error("Không thể lấy email từ Google."), null);
        }

        // 1. Tìm user bằng Google ID
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // 2. Nếu không thấy, thử tìm bằng email
        user = await User.findOne({ email: userEmail });
        if (user) {
            // User đã tồn tại (đăng ký thường), cập nhật googleId
            user.googleId = profile.id;
            // Cập nhật displayName nếu nó rỗng
            if (!user.displayName) user.displayName = profile.displayName;
            await user.save();
            return done(null, user);
        }

        // 3. Nếu không có, tạo user mới
        const newUsername = userEmail; // Dùng email làm username
        const newDisplayName = profile.displayName; // Lấy displayName từ Google

        let newUser = new User({
            googleId: profile.id,
            email: userEmail,
            username: newUsername,
            displayName: newDisplayName // <-- ĐÃ KHÔI PHỤC
            // (không có avatar)
        });
        
        try {
            await newUser.save();
            return done(null, newUser);
        } catch (err) {
            // Xử lý lỗi nếu email đã được dùng làm username
            if (err.code === 11000) { 
                 const fallbackUsername = userEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
                 newUser = new User({
                    googleId: profile.id,
                    email: userEmail,
                    username: fallbackUsername, // Dùng username ngẫu nhiên
                    displayName: newDisplayName
                });
                await newUser.save();
                return done(null, newUser);
            }
            // Lỗi khác
            return done(err, null);
        }
        
    } catch (err) {
      return done(err, null);
    }
  }
));

// --- 2.D. Lưu user vào session và lấy user từ session ---
passport.serializeUser((user, done) => {
  done(null, user.id); // Lưu ID của user vào session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user); // Lấy user từ DB dựa trên ID
  } catch (err) {
    done(err, null);
  }
});
// --- 2. Khởi tạo Socket.IO và truyền 'io' vào routes ---
const io = attachSocket(server); 

try {
  app.use('/api/room', require('./routes/roomRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/admin', require('./routes/adminAuthRoutes')); 
  app.use('/api/admin', adminAuth, require('./routes/adminRoutes')(io)); 
  app.use('/api', require('./routes/publicRoutes'));
  // REMOVE duplicate: app.use('/api/chatbot', chatbotRoutes);
  
  console.log('[index] All routes mounted successfully.');
} catch (e) {
  console.error('[index] Error mounting routes:', e.message);
}

// --- 3. Các Route Trang Admin (Giữ nguyên) ---
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin-login.html'));
});
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
app.get('/admin.html', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
app.get('/admin.js', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.js'));
});
app.get('/css/admin.css', (req, res) => { 
  res.sendFile(path.join(__dirname, 'public/css/admin.css'));
});
app.get('/admin-login.css', (req, res) => { 
  res.sendFile(path.join(__dirname, 'public/admin-login.css'));
});
app.get('/admin-login.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin-login.js'));
});
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }) // Yêu cầu Google trả về profile và email
);

// Route này được Google gọi lại sau khi user đăng nhập (từ .env)
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/admin-login.html' }), // Nếu thất bại, về trang login
  (req, res) => {
    // Đăng nhập thành công!
    // Gửi thông tin user về frontend qua URL query
    const userQuery = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.FRONTEND_URL}?user=${userQuery}`); //
  }
);

// --- 4. Khởi động Server ---
const PORT = process.env.PORT || 3000;
async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] Connected to MongoDB.');

    // --- THÊM MỚI: Chạy watcher và cập nhật CSDL ---
    const updateGamesFunction = setupGameWatcher();
    await updateGamesFunction(); // Chạy lần đầu để đảm bảo CSDL được điền dữ liệu
    // ----------------------------------------------------

    // --- Logic trạng thái người chơi 'Online' (Giữ nguyên) ---
    io.on('connection', (socket) => {
        socket.on('registerSocket', async (username) => {
          if (!username || username.startsWith('guest_')) return;
          try {
            await User.findOneAndUpdate({ username: username }, { status: 'online', socketId: socket.id });
            console.log(`[Presence] User ${username} is 'online' with socket ${socket.id}`);
            io.emit('admin-user-status-changed');
          } catch (e) { console.error('registerSocket error', e.message); }
        });
    });
    // ------------------------------------------------

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