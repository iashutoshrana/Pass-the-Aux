import { useState, useEffect } from "react";
import { socket } from "./socket";
import { QRCodeCanvas } from "qrcode.react";
import SearchSongs from "./SearchSongs";

function App() {
  const [roomId, setRoomId] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);

  useEffect(() => {
    socket.on("room-created", (id) => {
      setCreatedRoom(id);
      setCurrentRoom(id);
    });

    socket.on("joined-room", (id) => {
      setCurrentRoom(id);
      alert("Joined Room: " + id);
    });

    socket.on("update-queue", (q) => {
      setQueue(q);

      if (!currentSong && q.length > 0) {
        setCurrentSong(q[0]);
      }
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("update-queue");
    };
  }, [currentSong]);

  const createRoom = () => {
    socket.emit("create-room");
  };

  const joinRoom = () => {
    socket.emit("join-room", roomId);
  };

  const voteSong = (videoId) => {
    socket.emit("vote-song", {
      roomId: currentRoom,
      videoId,
    });
  };

  const joinLink = `http://localhost:3000/?room=${createdRoom}`;

  return (
    <div style={{ textAlign: "center", marginTop: "30px" }}>
      <h1>Pass the Aux 🎵</h1>

      {!currentRoom && (
        <>
          <button onClick={createRoom}>Create Room</button>

          {createdRoom && (
            <>
              <h3>Room ID: {createdRoom}</h3>
              <p>Scan to join:</p>
              <QRCodeCanvas value={joinLink} />
              <p>{joinLink}</p>
            </>
          )}

          <br /><br />

          <input
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />

          <button onClick={joinRoom}>Join Room</button>
        </>
      )}

      {/* ROOM UI */}
      {currentRoom && (
        <>
          <h2>Room: {currentRoom}</h2>

          {/* 🎬 PLAYER */}
          {currentSong && (
            <iframe
              width="400"
              height="250"
              src={`https://www.youtube.com/embed/${currentSong.videoId}?autoplay=1`}
              title="player"
              allow="autoplay"
            ></iframe>
          )}

          {/* 🔍 SEARCH */}
          <SearchSongs roomId={currentRoom} />

          {/* 🎵 QUEUE */}
          <h3>Queue</h3>

          {queue.map((song, index) => (
            <div key={index} style={{ margin: "10px" }}>
              <img src={song.thumbnail} alt="" />
              <p>{song.title}</p>

              <p>Votes: {song.votes}</p>

              <button onClick={() => voteSong(song.videoId)}>
                👍 Vote
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;