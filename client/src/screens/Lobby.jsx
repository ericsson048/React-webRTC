import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketProvider";

const LobbyScreen = () => {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const socket = useSocket();
  const navigate = useNavigate();

  const generateRandomRoom = () => {
    const randomRoom = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoom(randomRoom);
  };

  const handleSubmitForm = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      
      if (!email.trim() || !room.trim()) {
        setError("Email et numéro de room sont requis");
        return;
      }

      try {
        setIsJoining(true);
        socket.emit("room:join", { email, room });
      } catch (err) {
        setError("Erreur lors de la connexion à la room");
        setIsJoining(false);
      }
    },
    [email, room, socket]
  );

  const handleJoinRoom = useCallback(
    (data) => {
      console.log("Réponse du serveur:", data);
      if (data && data.room) {
        navigate(`/room/${data.room}`);
      } else {
        setError("Erreur lors de la connexion à la room");
        setIsJoining(false);
      }
    },
    [navigate]
  );

  const handleError = useCallback((error) => {
    setError(error.message || "Une erreur est survenue");
    setIsJoining(false);
  }, []);

  useEffect(() => {
    // Écouter les événements de room
    socket.on("room:join", handleJoinRoom);
    socket.on("room:error", handleError);

    return () => {
      socket.off("room:join", handleJoinRoom);
      socket.off("room:error", handleError);
    };
  }, [socket, handleJoinRoom, handleError]);

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h1>Rejoindre une Room</h1>
        <p className="subtitle">Entrez vos informations pour rejoindre une room de chat vidéo</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmitForm}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Entrez votre email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isJoining}
            />
          </div>

          <div className="form-group">
            <label htmlFor="room">Numéro de Room</label>
            <div className="room-input-group">
              <input
                type="text"
                id="room"
                placeholder="Ex: ABC123"
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
                disabled={isJoining}
              />
              <button 
                type="button" 
                className="generate-button"
                onClick={generateRandomRoom}
                disabled={isJoining}
              >
                Générer
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="join-button" 
            disabled={isJoining}
          >
            {isJoining ? "Connexion..." : "Rejoindre la Room"}
          </button>
        </form>

        <div className="info-text">
          <p>👥 Plusieurs utilisateurs peuvent rejoindre la même room</p>
          <p>🎥 Assurez-vous d'autoriser l'accès à votre caméra et microphone</p>
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen;
