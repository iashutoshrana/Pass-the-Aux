import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import { clientId } from "../utils/clientId";

// Keep the room code in the address, so a refresh puts you straight back in.
const setRoomInUrl = (id) =>
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}?room=${encodeURIComponent(id)}`,
  );
const clearRoomFromUrl = () =>
  window.history.replaceState({}, "", window.location.pathname);

// stamp the moment we received the song so the player knows how old `position` is
const receive = (song) => (song ? { ...song, receivedAt: Date.now() } : null);

// All room state and every socket event/action lives here.
export default function useParty() {
  const [roomId, setRoomId] = useState(""); // text typed in the join box
  const [currentRoom, setCurrentRoom] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [votedSongs, setVotedSongs] = useState(new Set());
  const [partyStarted, setPartyStarted] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false); // a song has played in this room
  const [roomError, setRoomError] = useState("");
  const [skipState, setSkipState] = useState({
    votes: 0,
    needed: 1,
    participants: 1,
    voters: [],
  });

  const roomRef = useRef("");
  useEffect(() => {
    roomRef.current = currentRoom;
  }, [currentRoom]);

  // once any song has played, an empty player means "the party ended"
  useEffect(() => {
    if (currentSong) setHasPlayed(true);
  }, [currentSong]);

  // Auto-join from QR link
  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get("room");
    if (!roomFromUrl) return;

    const join = () =>
      socket.emit("join-room", { roomId: roomFromUrl, clientId });
    if (socket.connected) join();
    else socket.once("connect", join);

    return () => socket.off("connect", join);
  }, []);

  // After a reconnect the socket has a new id and left its rooms: rejoin
  useEffect(() => {
    const rejoin = () => {
      if (roomRef.current)
        socket.emit("join-room", { roomId: roomRef.current, clientId });
    };
    socket.on("connect", rejoin);
    return () => socket.off("connect", rejoin);
  }, []);

  // Events coming from the server
  useEffect(() => {
    socket.on("room-created", (id) => {
      setCurrentRoom(id);
      setIsHost(true);
      setRoomInUrl(id);
    });

    socket.on("joined-room", (id) => {
      setCurrentRoom(id);
      setIsHost(false);
      setRoomError("");
      setRoomInUrl(id);
    });

    socket.on("room-error", (msg) => {
      setRoomError(msg);
      clearRoomFromUrl(); // a dead room code shouldn't be retried on every refresh
    });

    socket.on("update-queue", (q) => {
      setQueue(q);
    });

    socket.on("play-song", (song) => {
      setCurrentSong(receive(song));
    });

    // Late joiner gets current state (with position)
    socket.on("room-state", ({ queue: q, currentSong: cs, votedVideoIds }) => {
      setQueue(q);
      setCurrentSong(receive(cs));
      // songs you already voted for (the server remembers, even after a refresh)
      setVotedSongs(new Set(votedVideoIds || []));
    });

    socket.on("promoted-to-host", () => {
      setIsHost(true);
    });

    // the host opened the party in another tab: control moved there
    socket.on("demoted-from-host", () => {
      setIsHost(false);
    });

    // skip votes so far, and how many are needed
    socket.on("skip-state", (state) => setSkipState(state));

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("room-error");
      socket.off("update-queue");
      socket.off("play-song");
      socket.off("room-state");
      socket.off("promoted-to-host");
      socket.off("demoted-from-host");
      socket.off("skip-state");
    };
  }, []);

  // Things the user can do
  const createRoom = () => socket.emit("create-room", { clientId });

  const joinRoom = () => {
    if (roomId.trim())
      socket.emit("join-room", { roomId: roomId.trim(), clientId });
  };

  const voteSong = (videoId) => {
    if (votedSongs.has(videoId)) return;
    socket.emit("vote-song", { roomId: currentRoom, videoId, clientId });
    setVotedSongs((prev) => new Set(prev).add(videoId));
  };

  const nextSong = () => {
    if (!isHost) return;
    socket.emit("next-song", currentRoom);
  };

  // guests vote to skip: send the id of the song we are looking at
  const voteSkip = () => {
    if (!currentSong) return;
    socket.emit("vote-skip", {
      roomId: currentRoom,
      videoId: currentSong.videoId,
    });
  };
  const hasVotedSkip = skipState.voters.includes(socket.id);

  const startParty = () => setPartyStarted(true);

  const leaveParty = () => {
    socket.emit("leave-room", currentRoom);
    // drop ?room=... from the address so a refresh doesn't rejoin
    clearRoomFromUrl();
    setCurrentRoom("");
    setRoomId("");
    setQueue([]);
    setCurrentSong(null);
    setIsHost(false);
    setPartyStarted(false);
    setHasPlayed(false);
    setVotedSongs(new Set());
    setRoomError("");
    setSkipState({ votes: 0, needed: 1, participants: 1, voters: [] });
  };

  return {
    // state
    roomId,
    setRoomId,
    currentRoom,
    queue,
    currentSong,
    isHost,
    votedSongs,
    partyStarted,
    hasPlayed,
    roomError,
    skipState,
    hasVotedSkip,
    // actions
    createRoom,
    joinRoom,
    voteSong,
    nextSong,
    voteSkip,
    startParty,
    leaveParty,
  };
}
