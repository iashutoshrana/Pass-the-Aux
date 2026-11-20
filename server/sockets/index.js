// Wires every socket connection to its handlers.
const roomHandlers = require("./roomHandlers");
const queueHandlers = require("./queueHandlers");
const playbackHandlers = require("./playbackHandlers");

module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    roomHandlers(io, socket);
    queueHandlers(io, socket);
    playbackHandlers(io, socket);
  });
};
