// Entry point: sets things up and starts the server.
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]); // helps with DNS problems on some ISPs

const { PORT, CLIENT_URL } = require("./config");

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { connectDB, loadRooms, startCleanup } = require("./roomStore");
const { initSpotify } = require("./services/spotify");
const searchRoutes = require("./routes/search");
const registerSockets = require("./sockets");

const app = express();
app.set("trust proxy", 1); // needed behind Render/Railway/Nginx
app.use(cors({ origin: CLIENT_URL }));
app.use("/search", searchRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

registerSockets(io);

// start-up work
connectDB().then(loadRooms);
startCleanup();
initSpotify();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
