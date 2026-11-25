// Per-visitor limits: how many parties one person can start, and how many
// wrong room codes they can try. A visitor is identified by their IP address.
const {
  ROOMS_PER_HOUR,
  JOIN_FAILS_PER_MIN,
  TRUST_PROXY_HOPS,
  LIMIT_LOOPBACK,
} = require("./config");

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const roomCreates = new Map(); // ip -> [timestamps of rooms they created]
const joinFails = new Map(); // ip -> [timestamps of wrong room codes]

// The visitor's address. Behind a proxy (Render) the real address is added to
// X-Forwarded-For by the proxy. We count from the END of that list, because
// anything a visitor writes themselves can only appear at the start.
function clientIp(socket) {
  const header = socket.handshake.headers["x-forwarded-for"];
  if (typeof header === "string" && header.trim()) {
    const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
    const index = Math.max(0, parts.length - TRUST_PROXY_HOPS);
    if (parts[index]) return parts[index];
  }
  return socket.handshake.address || "unknown";
}

const isLoopback = (ip) =>
  ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1";
const exempt = (ip) => isLoopback(ip) && !LIMIT_LOOPBACK;

// keep only the timestamps that are still inside the window
function recent(map, ip, windowMs) {
  const now = Date.now();
  const list = (map.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length) map.set(ip, list);
  else map.delete(ip);
  return list;
}

// true if this visitor may start another party (and counts it)
function allowRoomCreation(ip) {
  if (exempt(ip)) return true;
  const list = recent(roomCreates, ip, HOUR);
  if (list.length >= ROOMS_PER_HOUR) return false;
  list.push(Date.now());
  roomCreates.set(ip, list);
  return true;
}

// true if this visitor has tried too many wrong codes in the last minute
function joinBlocked(ip) {
  if (exempt(ip)) return false;
  return recent(joinFails, ip, MINUTE).length >= JOIN_FAILS_PER_MIN;
}

function noteFailedJoin(ip) {
  if (exempt(ip)) return;
  const list = recent(joinFails, ip, MINUTE);
  list.push(Date.now());
  joinFails.set(ip, list);
}

// tidy old entries now and then so the maps can't grow forever
setInterval(() => {
  for (const ip of [...roomCreates.keys()]) recent(roomCreates, ip, HOUR);
  for (const ip of [...joinFails.keys()]) recent(joinFails, ip, MINUTE);
}, 10 * MINUTE).unref();

module.exports = { clientIp, allowRoomCreation, joinBlocked, noteFailedJoin };
