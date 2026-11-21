// create / join / leave / disconnect
const { rooms, saveRoom } = require("../roomStore");
const { withPosition, afterRoomChange } = require("../roomLogic");

module.exports = function roomHandlers(io, socket) {
  socket.on("create-room", async () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = {
      queue: [],
      currentSong: null,
      startedAt: 0,
      hostId: socket.id,
      lastActivity: Date.now(),
    };
    socket.join(roomId);
    socket.emit("room-created", roomId);
    await saveRoom(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("join-room", async (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("room-error", "Room not found");
      return;
    }
    socket.join(roomId);
    room.lastActivity = Date.now();
    socket.emit("joined-room", roomId);
    socket.emit("room-state", {
      queue: room.queue,
      currentSong: withPosition(room), // includes position
    });

    // if the host is gone (refresh, closed tab, server restart), this person becomes host
    if (!io.sockets.sockets.has(room.hostId)) {
      room.hostId = socket.id;
      socket.emit("promoted-to-host");
    }
    await afterRoomChange(io, roomId); // tell everyone first, save after
    await saveRoom(roomId);
  });

  // someone pressed "Leave"
  socket.on("leave-room", async (roomId) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    socket.leave(roomId);

    if (room.hostId === socket.id) {
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients && clients.size > 0) {
        const newHost = [...clients][0];
        room.hostId = newHost;
        io.to(newHost).emit("promoted-to-host");
      } else {
        room.hostId = ""; // empty room: next person to join becomes host
      }
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

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    for (const roomId in rooms) {
      if (rooms[roomId].hostId === socket.id) {
        const clients = io.sockets.adapter.rooms.get(roomId);
        if (clients && clients.size > 0) {
          const newHost = [...clients][0];
          rooms[roomId].hostId = newHost;
          await saveRoom(roomId);
          io.to(newHost).emit("promoted-to-host");
          console.log(`Host reassigned to ${newHost} in room ${roomId}`);
        }
      }
    }
  });
};
