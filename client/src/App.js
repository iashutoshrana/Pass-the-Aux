import "./App.css";
import useParty from "./hooks/useParty";
import useConnectionStatus from "./hooks/useConnectionStatus";
import ConnectionBanner from "./components/ConnectionBanner";
import HomeScreen from "./components/HomeScreen";
import RoomHeader from "./components/RoomHeader";
import PlayerArea from "./components/PlayerArea";
import NowPlaying from "./components/NowPlaying";
import QueueSidebar from "./components/QueueSidebar";
import SearchSongs from "./SearchSongs";

function App() {
  const party = useParty();
  const connection = useConnectionStatus();
  const { currentRoom } = party;

  return (
    <div className="app-container">
      <ConnectionBanner status={connection.status} attempt={connection.attempt} />

      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <h1 className="title">Pass the Aux 🎵</h1>

      {!currentRoom && (
        <HomeScreen
          roomId={party.roomId}
          setRoomId={party.setRoomId}
          onCreate={party.createRoom}
          onJoin={party.joinRoom}
          error={party.roomError}
        />
      )}

      {currentRoom && (
        <div className="room-layout">
          {/* LEFT COLUMN: search on top, then header + player */}
          <div className="main-stage">
            <SearchSongs roomId={currentRoom} queue={party.queue} />

            <RoomHeader
              roomCode={currentRoom}
              isHost={party.isHost}
              onSkip={party.nextSong}
              onLeave={party.leaveParty}
            />

            <PlayerArea
              roomCode={currentRoom}
              currentSong={party.currentSong}
              partyStarted={party.partyStarted}
              hasPlayed={party.hasPlayed}
              onStart={party.startParty}
              onExit={party.leaveParty}
            />

            <NowPlaying song={party.currentSong} />
          </div>

          {/* RIGHT COLUMN: QR on top, then the queue */}
          <QueueSidebar
            roomCode={currentRoom}
            queue={party.queue}
            currentSong={party.currentSong}
            votedSongs={party.votedSongs}
            onVote={party.voteSong}
          />
        </div>
      )}
    </div>
  );
}

export default App;
