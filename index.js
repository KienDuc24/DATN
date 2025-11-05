const mongoose = require('mongoose');
const http = require('http');
const app = require('./server'); // server.js phải export express app
const socketServer = require('./socketServer');
const PORT = process.env.PORT || 8080;

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in environment');
    }

    // Fail fast if DB not ready
    mongoose.set('bufferCommands', false);
    // Recommended: remove deprecated options useNewUrlParser / useUnifiedTopology
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] connected to MongoDB');

    const server = http.createServer(app);

    // attach socket
    if (typeof socketServer === 'function') {
      socketServer(server);
    } else if (socketServer && typeof socketServer.attach === 'function') {
      socketServer.attach(server);
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