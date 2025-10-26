try {
  require('./server'); // start API server (server.js calls app.listen)
} catch (err) {
  console.warn('index.js: failed to start server.js (API):', err && err.message);
}

try {
  require('./socketServer'); // start socket server
} catch (err) {
  console.warn('index.js: failed to start socketServer.js:', err && err.message);
}