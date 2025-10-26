/**
 * index.js - bootstrap API + Socket servers with global error handlers
 */
// Global bootstrap: start server & socket, add diagnostics and graceful shutdown
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err));
  // allow logs to flush
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason && (reason.stack || reason));
  setTimeout(() => process.exit(1), 1000);
});

// diagnostic memory snapshots
const MEM_LOG_INTERVAL = 30 * 1000;
const memInterval = setInterval(() => {
  try {
    console.log('[diag] memUsage', process.memoryUsage());
  } catch (e) {
    console.warn('[diag] mem log error', e && e.message);
  }
}, MEM_LOG_INTERVAL);

function gracefulShutdown() {
  console.log('[signal] SIGTERM/SIGINT received - shutting down');
  clearInterval(memInterval);
  try {
    const srv = require('./server');
    if (srv && srv.server && typeof srv.server.close === 'function') {
      srv.server.close(() => {
        console.log('[signal] HTTP server closed');
        process.exit(0);
      });
      // force exit if not closed in time
      setTimeout(() => process.exit(0), 5000);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[signal] shutdown err', err && err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/* diagnostic SIGTERM handler: prints active handles/requests and stack traces */
process.on('beforeExit', (code) => {
  console.log('[diag] beforeExit code=', code, 'mem=', process.memoryUsage());
});
process.on('exit', (code) => {
  console.log('[diag] exit code=', code, 'mem=', process.memoryUsage());
});
process.on('warning', (w) => console.warn('[diag] warning', w && (w.stack || w)));

function dumpHandles(tag) {
  try {
    // best-effort: list active handles/requests (node internals)
    const handles = (process._getActiveHandles && process._getActiveHandles()) || [];
    const requests = (process._getActiveRequests && process._getActiveRequests()) || [];
    console.log(`[diag] ${tag} activeHandles=${handles.length} activeRequests=${requests.length}`);
  } catch (e) {
    console.warn('[diag] dumpHandles failed', e && e.message);
  }
}

process.on('SIGTERM', () => {
  console.log('[diag] SIGTERM received - mem snapshot', process.memoryUsage());
  dumpHandles('SIGTERM');
  // print stack traces of active handles (best-effort)
  try {
    console.trace('[diag] stack at SIGTERM');
  } catch(e){}
  // allow gracefulShutdown already implemented (or force a longer delay)
  setTimeout(() => {
    console.log('[diag] waiting 5s then exit');
    process.exit(1);
  }, 5000);
});

// require server + socket modules (server starts listening)
try {
  require('./server');
  console.log('index.js: server module loaded');
} catch (e) {
  console.error('index.js: failed to load server module', e && e.message);
}

try {
  require('./socketServer');
  console.log('index.js: socketServer loaded');
} catch (e) {
  console.error('index.js: failed to load socketServer', e && e.message);
}