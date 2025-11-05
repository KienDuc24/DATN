require('dotenv').config();
const fs = require('fs');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');

const DIAG = '/tmp/diag-index.log';
function logd(...args) {
  const s = `[index ${new Date().toISOString()}] ` + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(s);
  try { fs.appendFileSync(DIAG, s + '\n'); } catch (e) {}
}

// register handlers as EARLY as possible
logd('registering signal handlers (early)');
process.on('SIGTERM', () => {
  logd('Received SIGTERM — writing diagnostics and attempting graceful shutdown');
  try { fs.appendFileSync(DIAG, 'SIGTERM at ' + new Date().toISOString() + '\n'); } catch (e) {}
  gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => { logd('Received SIGINT'); gracefulShutdown('SIGINT'); });
process.on('uncaughtException', (err) => {
  logd('[FATAL] uncaughtException', err && err.stack || err);
  try { fs.appendFileSync(DIAG, 'uncaughtException: ' + (err && err.stack || err) + '\n'); } catch (e) {}
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logd('[FATAL] unhandledRejection', reason && reason.stack || reason);
  try { fs.appendFileSync(DIAG, 'unhandledRejection: ' + (reason && reason.stack || reason) + '\n'); } catch (e) {}
});

logd('env preview', { PORT: process.env.PORT ? 'set' : 'unset', FRONTEND_URL: !!process.env.FRONTEND_URL, MONGODB_URI: !!process.env.MONGODB_URI });

const app = require('./server'); // server.js phải export express app
const socketServer = require('./socketServer'); // nếu file của bạn xuất hàm attach/socket init
const PORT = process.env.PORT || 8080;

let server;

function writeRuntimeDiag() {
  try {
    const info = {
      uptime: process.uptime(),
      mem: process.memoryUsage(),
      env: { PORT: process.env.PORT, NODE_ENV: process.env.NODE_ENV },
      time: new Date().toISOString()
    };
    fs.writeFileSync(DIAG, JSON.stringify(info, null, 2) + '\n', { flag: 'a' });
  } catch (e) {}
}

function gracefulShutdown(signal) {
  logd(`gracefulShutdown called by ${signal}`);
  writeRuntimeDiag();
  if (!server) { logd('no server instance - exiting'); return process.exit(0); }

  // stop accepting new connections
  server.close((err) => {
    if (err) {
      logd('error closing server', err && err.stack || err);
      try { fs.appendFileSync(DIAG, 'close-error:' + (err && err.stack || err) + '\n'); } catch (e) {}
      return process.exit(1);
    }
    logd('server closed gracefully');
    try { fs.appendFileSync(DIAG, 'closed-ok\n'); } catch (e) {}
    process.exit(0);
  });

  // Force exit after 10s (Railway may send SIGKILL)
  setTimeout(() => {
    logd('graceful shutdown timed out, forcing exit');
    try { fs.appendFileSync(DIAG, 'force-exit\n'); } catch (e) {}
    process.exit(1);
  }, 10000).unref();
}

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in environment');
    }

    // Disable mongoose buffering so operations fail fast if DB not connected
    mongoose.set('bufferCommands', false);
    // connect and wait
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] connected to MongoDB');

    server = http.createServer(app);

    // if your socketServer exports a function to attach:
    if (typeof socketServer === 'function') {
      socketServer(server);
    } else if (socketServer && typeof socketServer.attach === 'function') {
      socketServer.attach(server);
    }

    server.listen(PORT, () => {
      console.log(`[index] Server + Socket running on port ${PORT}`);
      try {
        const addr = server.address() || {};
        logd('server.address', addr);
        fs.writeFileSync(DIAG, `listening ${JSON.stringify(addr)}\n`, { flag: 'a' });
      } catch (e) {}
    });
  } catch (err) {
    console.error('[index] startup error', err && (err.stack || err.message));
    // exit so platform shows failure (or implement retry logic)
    process.exit(1);
  }
}

start();

// periodic heartbeat so logs show activity & memory trends
setInterval(() => {
  logd('heartbeat', { mem: process.memoryUsage().rss });
  try { fs.appendFileSync(DIAG, 'hb ' + Date.now() + '\n'); } catch (e) {}
}, 30_000).unref();