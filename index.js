/**
 * index.js - bootstrap API + Socket servers with global error handlers
 */
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err));
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason && (reason.stack || reason));
  setTimeout(() => process.exit(1), 1000);
});

let serverModule;
let ioModule;

async function start() {
  try {
    serverModule = require('./server'); // must export { app, server }
    console.log('index.js: server module loaded');
  } catch (err) {
    console.error('index.js: failed to require server.js (API):', err && err.message);
  }

  try {
    ioModule = require('./socketServer'); // should attach to exported server
    console.log('index.js: socketServer loaded');
  } catch (err) {
    console.error('index.js: failed to require socketServer.js (socket):', err && err.message);
  }
}

function gracefulShutdown() {
  console.log('[signal] SIGTERM/SIGINT received - shutting down');
  try {
    if (ioModule && typeof ioModule.close === 'function') {
      ioModule.close();
      console.log('[signal] socket.io closed');
    }
  } catch (err) {
    console.warn('[signal] error closing socket.io:', err && err.message);
  }
  try {
    if (serverModule && serverModule.server && typeof serverModule.server.close === 'function') {
      serverModule.server.close(() => {
        console.log('[signal] HTTP server closed');
        process.exit(0);
      });
      // force exit after 5s
      setTimeout(() => process.exit(0), 5000);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.warn('[signal] error closing http server:', err && err.message);
    process.exit(1);
  }
}

/* added diagnostic logging to help find SIGTERM cause */
process.on('beforeExit', (code) => {
  console.log('[diag] process beforeExit code=', code, 'mem=', process.memoryUsage());
});
process.on('exit', (code) => {
  console.log('[diag] process exit code=', code, 'mem=', process.memoryUsage());
});
process.on('warning', (warning) => {
  console.warn('[diag] process warning:', warning && (warning.stack || warning));
});

// periodic memory snapshot to spot OOM growth
const MEM_LOG_INTERVAL = 30 * 1000;
const memInterval = setInterval(() => {
  try {
    console.log('[diag] memUsage', process.memoryUsage());
  } catch (e) {
    console.warn('[diag] mem log error', e && e.message);
  }
}, MEM_LOG_INTERVAL);

process.on('SIGTERM', () => {
  console.log('[diag] SIGTERM received - mem snapshot', process.memoryUsage());
  clearInterval(memInterval);
  // allow graceful shutdown already implemented below
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();