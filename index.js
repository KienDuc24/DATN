require('dotenv').config();
const http = require('http');
const app = require('./server');
const { socketServer } = require('./socketServer');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
socketServer(server);

server.listen(PORT, () => console.log(`Server + Socket running on port ${PORT}`));

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});