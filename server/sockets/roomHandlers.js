// create / join / leave / disconnect
const { rooms, saveRoom } = require("../roomStore");
const {
  withPosition,
  afterRoomChange,
  cleanClientId,
  handOverHost,
  startHostGrace,
} = require("../roomLogic");

module.exports = function roomHandlers(io, socket) {
  socket.on("create-room", async (payload) => {
    const clientId = cleanClientId(payload && payload.clientId);
    socket.data.clientId = clientId; // who this connection belongs to
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = {
      queue: [],
      currentSong: null,
      startedAt: 0,
      hostId: socket.id,
      hostClientId: clientId,
      lastActivity: Date.now(),
    };
    socket.join(roomId);
    socket.emit("room-created", roomId);
    await saveRoom(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  // payload: { roomId, clientId } (a plain room code string also works)
  socket.on("join-room", async (payload) => {
    const { roomId, clientId: rawId } =
      typeof payload === "string" ? { roomId: payload } : payload || {};
    const clientId = cleanClientId(rawId);
    const room = typeof roomId === "string" ? rooms[roomId] : undefined;
    if (!room) {
      socket.emit("room-error", "Room not found");
      return;
    }
    socket.data.clientId = clientId; // who this connection belongs to
    socket.join(roomId);
    room.lastActivity = Date.now();
    socket.emit("joined-room", roomId);
    socket.emit("room-state", {
      queue: room.queue,
      currentSong: withPosition(room), // includes position
    });

    const hostConnected = io.sockets.sockets.has(room.hostId);
    const isOriginalHost = clientId && room.hostClientId === clientId;

    if (isOriginalHost) {
      // the host is back (refresh, reconnect, or a second tab): give control back
      clearTimeout(room.graceTimer);
      room.graceTimer = null;
      if (hostConnected && room.hostId !== socket.id) {
        io.to(room.hostId).emit("demoted-from-host");
      }
      room.hostId = socket.id;
      socket.emit("promoted-to-host");
    } else if (!hostConnected && !room.graceTimer) {
      // nobody is host and nobody is expected back soon: this person takes over
      room.hostId = socket.id;
      room.hostClientId = clientId;
      socket.emit("promoted-to-host");
    }
    await afterRoomChange(io, roomId); // tell everyone first, save after
    await saveRoom(roomId);
  });

  // someone pressed "Leave"
  socket.on("leave-room", async (roomId) => {
    const room = typeof roomId === "string" ? rooms[roomId] : undefined;
    if (!room || !socket.rooms.has(roomId)) return;
    socket.leave(roomId);

    // leaving on purpose hands the party over straight away (no waiting)
    if (room.hostId === socket.id) {
      const handedOver = await handOverHost(io, roomId);
      if (!handedOver) room.hostId = ""; // empty room: next person to join becomes host
    }
    await afterRoomChange(io, roomId); // tell everyone first, save after
    await saveRoom(roomId);
  });

  // someone closed the tab or lost connection: update the head-count and
  // skip votes for every room they were in (they are gone by the next tick)
  socket.on("disconnecting", () => {
    const joined = [...socket.rooms].filter((id) => id !== socket.id);
    setTimeout(() => {
      joined.forEach((id) =>
        afterRoomChange(io, id).catch((err) =>
          console.error("Skip state error ❌", err.message)
        )
      );
    }, 0);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // if the host dropped, give them a short grace period before replacing them
    for (const roomId in rooms) {
      if (rooms[roomId].hostId === socket.id) startHostGrace(io, roomId, socket.id);
    }
  });
};
