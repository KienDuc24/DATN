require('dotenv').config();
const fs = require('fs');
const http = require('http');
const path = require('path');

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

const app = require('./server');
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

// create server and attach socket
const PORT = process.env.PORT || 3000;
server = http.createServer(app);

try {
  const { socketServer } = require('./socketServer');
  socketServer(server);
  logd('socketServer attached');
} catch (e) {
  logd('failed to attach socketServer', e && e.stack || e);
}

server.listen(PORT, () => {
  logd(`Server + Socket running on port ${PORT}`);
  try {
    const addr = server.address() || {};
    logd('server.address', addr);
    fs.writeFileSync(DIAG, `listening ${JSON.stringify(addr)}\n`, { flag: 'a' });
  } catch (e) {}
});

// periodic heartbeat so logs show activity & memory trends
setInterval(() => {
  logd('heartbeat', { mem: process.memoryUsage().rss });
  try { fs.appendFileSync(DIAG, 'hb ' + Date.now() + '\n'); } catch (e) {}
}, 30_000).unref();