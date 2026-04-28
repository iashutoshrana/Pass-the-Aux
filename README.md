# Pass the Aux 🎵

A real-time collaborative music queue app where a host creates a room, shares a QR code, and guests join to search, add, and vote on songs — no login required.

---

## Live Demo

> Start the server locally and scan the QR code to try it on your phone.

---

## Features

- 🚀 **Instant Room Creation** — host starts a party in one click
- 📱 **QR Code Joining** — guests scan and join instantly, no login needed
- 🔍 **Song Search** — powered by Spotify API + YouTube API
- 🎶 **Real-time Queue** — all changes sync instantly across all devices
- 🔥 **Voting System** — most voted song moves to top
- ⏭ **Host Controls** — only host can skip songs
- 👑 **Host Reassignment** — if host leaves, next person gets promoted
- 💾 **Persistent Sessions** — room and queue survive page refresh (MongoDB)
- 📺 **YouTube Playback** — songs play directly in the browser

---

## Tech Stack

### Frontend
- React.js
- Socket.io Client
- Axios
- qrcode.react

### Backend
- Node.js
- Express.js
- Socket.io
- Mongoose

### Database
- MongoDB Atlas

### External APIs
- Spotify Web API (song search + metadata)
- YouTube Data API v3 (video ID lookup)

### Tools
- ngrok (local tunnel for mobile testing)

---
## How It Works

1. Host opens the app and clicks **Start a New Party**
2. A unique room ID is created and saved to MongoDB
3. A QR code is generated pointing to the ngrok URL with `?room=ID`
4. Guests scan the QR code — app auto-joins the room via socket
5. Anyone can search songs — backend queries Spotify then YouTube
6. Songs are added to a shared queue, synced via Socket.io to all users
7. Users vote on songs — queue re-sorts by vote count in real time
8. Host can skip to next song
9. If host disconnects, next user gets promoted to host automatically

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `CLIENT_URL` | Allowed CORS origin (* for all) |
| `REACT_APP_SERVER_URL` | Backend server URL |

---

## Key Concepts Used

| Concept | Where |
|---------|-------|
| WebSockets / Socket.io | `server/index.js`, `App.js` |
| REST API | `/search` endpoint in `server/index.js` |
| React Hooks | `App.js`, `SearchSongs.js` |
| MongoDB + Mongoose | `server/index.js` |
| Real-time sync | Socket rooms + emit/on |
| QR Code generation | `QRSection.js` |
| External API integration | Spotify + YouTube in `server/index.js` |
| Dynamic environment config | `socket.js`, `setup.js` |

---

## Known Limitations

- Free ngrok URLs change on every restart (run `setup.js` to auto-update)
- YouTube autoplay may be blocked on some browsers (click "Start the Party")
- Free MongoDB Atlas has 512MB storage limit
- Rooms expire after 3 hours of inactivity

---

## Author

**Ashutosh Rana**
- GitHub: [@iashutoshrana](https://github.com/iashutoshrana)

---
