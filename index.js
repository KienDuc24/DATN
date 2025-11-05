require('dotenv').config();

const http = require('http');
const app = require('./server'); // express app exported from server.js
const { socketServer } = require('./socketServer'); // ensure socketServer exports a function
const PORT = process.env.PORT || 3000;

// create HTTP server and attach socket server
const server = http.createServer(app);
socketServer(server);

// start listening
server.listen(PORT, () => {
  console.log(`Server + Socket running on port ${PORT}`);
});

// Optional: global error handlers (move here if removed from server.js)
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // process.exit(1); // uncomment if you want to crash on uncaught exceptions
});