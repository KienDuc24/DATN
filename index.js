require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const app = express();
const attachSocket = require('./socketServer');

const server = http.createServer(app);

// Middleware và định tuyến
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/room', require('./routes/roomRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/debug', require('./routes/debugRoutes'));

// Khởi động server
const PORT = process.env.PORT || 3000; // Sử dụng PORT từ môi trường hoặc giá trị mặc định

async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');

    // Fail fast if DB down
    mongoose.set('bufferCommands', false);

    // connect (remove deprecated options)
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] connected to MongoDB');

    // attach socket server (socketServer exports a function)
    if (typeof attachSocket === 'function') {
      attachSocket(server);
    }

    server.listen(PORT, () => {
      console.log(`[index] Server + Socket running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[index] startup error', err && (err.stack || err.message));
    process.exit(1);
  }
}

start();
