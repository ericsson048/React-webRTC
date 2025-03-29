import React, { useEffect, useCallback, useState, useRef } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import { useParams, useNavigate } from "react-router-dom";
import "./Room.css";

const RoomPage = () => {
  const socket = useSocket();
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  // Utiliser useRef pour éviter les re-renders inutiles
  const myStreamRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  const [users, setUsers] = useState(new Map());
  const [streams, setStreams] = useState(new Map());
  const [error, setError] = useState("");
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [isCameraInitializing, setIsCameraInitializing] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // Initialiser le flux vidéo local
  const initializeMediaStream = useCallback(async () => {
    try {
      // Éviter la double initialisation
      if (isInitializedRef.current) return myStreamRef.current;
      
      setIsCameraInitializing(true);
      console.log("Initialisation de la caméra...");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      
      // S'assurer que les tracks suivent l'état actuel
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      if (videoTrack) videoTrack.enabled = isVideoEnabled;
      if (audioTrack) audioTrack.enabled = isAudioEnabled;
      
      console.log("Flux vidéo obtenu:", stream);
      myStreamRef.current = stream;
      isInitializedRef.current = true;
      setIsCameraInitializing(false);
      return stream;
    } catch (err) {
      console.error("Erreur d'accès à la caméra:", err);
      setError("Impossible d'accéder à votre caméra ou microphone. Vérifiez que vous avez autorisé l'accès.");
      setIsCameraInitializing(false);
      throw err;
    }
  }, [isVideoEnabled, isAudioEnabled]);

  // Nettoyer les ressources à la fermeture
  const cleanup = useCallback(() => {
    if (myStreamRef.current) {
      console.log("Nettoyage des ressources...");
      myStreamRef.current.getTracks().forEach(track => {
        console.log("Arrêt de la track:", track.kind);
        track.stop();
      });
      myStreamRef.current = null;
    }
    isInitializedRef.current = false;
    peer.closePeer();
    setStreams(new Map());
    setIsCallInProgress(false);
    setIsCameraInitializing(true);
  }, []);

  // Vérifier si l'utilisateur est dans une room valide
  useEffect(() => {
    if (!roomId) {
      console.log("Pas de roomId, redirection vers le lobby");
      navigate("/");
      return;
    }

    const initRoom = async () => {
      try {
        if (!isInitializedRef.current) {
          await initializeMediaStream();
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation de la room:", err);
      }
    };

    initRoom();

    return () => {
      console.log("Nettoyage de la room");
      cleanup();
    };
  }, [roomId, navigate, initializeMediaStream, cleanup]);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setUsers(prev => new Map(prev).set(id, { email, stream: null }));
  }, []);

  const handleUserLeft = useCallback(({ email, id }) => {
    console.log(`Email ${email} left room`);
    setUsers(prev => {
      const newUsers = new Map(prev);
      newUsers.delete(id);
      return newUsers;
    });
    setStreams(prev => {
      const newStreams = new Map(prev);
      newStreams.delete(id);
      return newStreams;
    });
  }, []);

  const handleExistingUsers = useCallback(({ users: roomUsers }) => {
    console.log("Existing users:", roomUsers);
    const usersMap = new Map();
    roomUsers.forEach(user => {
      usersMap.set(user.id, { email: user.email, stream: null });
    });
    setUsers(usersMap);
  }, []);

  const handleCallUser = useCallback(async (userId) => {
    try {
      setIsCallInProgress(true);
      setError("");

      const stream = myStreamRef.current;
      if (!stream) {
        console.log("Pas de flux local, tentative d'initialisation...");
        await initializeMediaStream();
      }

      // Créer une nouvelle connexion peer
      peer.closePeer();
      const peerConnection = peer.createPeer();
      
      // Ajouter les tracks
      await peer.addTracks(myStreamRef.current);

      // Créer et envoyer l'offre
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: userId, offer });

      // Configurer les gestionnaires d'événements ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("peer:ice-candidate", {
            to: userId,
            candidate: event.candidate,
          });
        }
      };

      // Configurer le gestionnaire de tracks
      peerConnection.ontrack = (event) => {
        console.log("Received remote track:", event.streams[0]);
        setStreams(prev => new Map(prev).set(userId, event.streams[0]));
      };

    } catch (err) {
      console.error("Erreur lors de l'appel:", err);
      setError("Impossible d'établir l'appel. Vérifiez votre caméra et microphone.");
      setIsCallInProgress(false);
    }
  }, [socket, initializeMediaStream]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      try {
        setIsCallInProgress(true);
        setError("");

        const stream = myStreamRef.current;
        if (!stream) {
          console.log("Pas de flux local pour l'appel entrant, tentative d'initialisation...");
          await initializeMediaStream();
        }

        // Créer une nouvelle connexion peer
        peer.closePeer();
        const peerConnection = peer.createPeer();

        // Ajouter les tracks
        await peer.addTracks(myStreamRef.current);

        // Configurer les gestionnaires d'événements ICE
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("peer:ice-candidate", {
              to: from,
              candidate: event.candidate,
            });
          }
        };

        // Configurer le gestionnaire de tracks
        peerConnection.ontrack = (event) => {
          console.log("Received remote track:", event.streams[0]);
          setStreams(prev => new Map(prev).set(from, event.streams[0]));
        };

        // Créer et envoyer la réponse
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans });

      } catch (err) {
        console.error("Erreur lors de la réception de l'appel:", err);
        setError("Impossible de répondre à l'appel. Vérifiez votre caméra et microphone.");
        setIsCallInProgress(false);
      }
    },
    [socket, initializeMediaStream]
  );

  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      try {
        await peer.setLocalDescription(ans);
        console.log("Call Accepted!");
      } catch (err) {
        console.error("Erreur lors de l'acceptation de l'appel:", err);
        setError("Erreur lors de la connexion");
        setIsCallInProgress(false);
      }
    },
    []
  );

  const handleIceCandidate = useCallback(async ({ from, candidate }) => {
    try {
      if (peer.peer) {
        await peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error("Erreur lors de l'ajout du candidat ICE:", err);
    }
  }, []);

  const handleCallAllUsers = useCallback(async () => {
    try {
      setIsCallInProgress(true);
      setError("");

      const stream = myStreamRef.current;
      if (!stream) {
        console.log("Pas de flux local, tentative d'initialisation...");
        await initializeMediaStream();
      }

      // Appeler chaque utilisateur dans la room
      for (const [userId] of users.entries()) {
        if (!streams.has(userId)) {
          try {
            // Créer une nouvelle connexion peer pour chaque utilisateur
            peer.closePeer();
            const peerConnection = peer.createPeer();
            
            // Ajouter les tracks
            await peer.addTracks(myStreamRef.current);

            // Créer et envoyer l'offre
            const offer = await peer.getOffer();
            socket.emit("user:call", { to: userId, offer });

            // Configurer les gestionnaires d'événements ICE
            peerConnection.onicecandidate = (event) => {
              if (event.candidate) {
                socket.emit("peer:ice-candidate", {
                  to: userId,
                  candidate: event.candidate,
                });
              }
            };

            // Configurer le gestionnaire de tracks
            peerConnection.ontrack = (event) => {
              console.log("Received remote track:", event.streams[0]);
              setStreams(prev => new Map(prev).set(userId, event.streams[0]));
            };

            // Attendre un peu entre chaque appel pour éviter la surcharge
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Erreur lors de l'appel à ${userId}:`, err);
          }
        }
      }

      setIsCallInProgress(false);
    } catch (err) {
      console.error("Erreur lors de l'appel groupé:", err);
      setError("Impossible d'établir l'appel groupé. Vérifiez votre caméra et microphone.");
      setIsCallInProgress(false);
    }
  }, [socket, users, streams, initializeMediaStream]);

  useEffect(() => {
    socket.on("room:users", handleExistingUsers);
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("room:users", handleExistingUsers);
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:ice-candidate", handleIceCandidate);
    };
  }, [
    socket,
    handleExistingUsers,
    handleUserJoined,
    handleUserLeft,
    handleIncommingCall,
    handleCallAccepted,
    handleIceCandidate,
  ]);

  const retryCamera = async () => {
    try {
      setError("");
      isInitializedRef.current = false;
      await initializeMediaStream();
    } catch (err) {
      console.error("Erreur lors de la nouvelle tentative d'accès à la caméra:", err);
    }
  };

  // Fonction pour activer/désactiver la vidéo
  const toggleVideo = useCallback(() => {
    if (myStreamRef.current) {
      const videoTrack = myStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        console.log('Video track enabled:', !isVideoEnabled);
      }
    }
  }, [isVideoEnabled]);

  // Fonction pour activer/désactiver l'audio
  const toggleAudio = useCallback(() => {
    if (myStreamRef.current) {
      const audioTrack = myStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
        console.log('Audio track enabled:', !isAudioEnabled);
      }
    }
  }, [isAudioEnabled]);

  return (
    <div className="room-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={retryCamera} className="retry-button">
            Réessayer
          </button>
        </div>
      )}

      <div className="controls">
        <button 
          onClick={toggleVideo}
          className={`control-btn ${isVideoEnabled ? 'active' : ''}`}
        >
          {isVideoEnabled ? '🎥' : '🚫'} Caméra
        </button>
        <button 
          onClick={toggleAudio}
          className={`control-btn ${isAudioEnabled ? 'active' : ''}`}
        >
          {isAudioEnabled ? '🎤' : '🚫'} Micro
        </button>
      </div>

      {/* Barre de participants en haut */}
      <div className="participants-bar">
        {/* Mon flux vidéo */}
        <div className="participant-thumbnail">
          <div className="video-wrapper">
            {isCameraInitializing ? (
              <div className="camera-initializing">...</div>
            ) : myStreamRef.current ? (
              <ReactPlayer
                playing
                muted
                width="100%"
                height="100%"
                url={myStreamRef.current}
              />
            ) : (
              <div className="camera-error">
                <div className="avatar">Vous</div>
              </div>
            )}
          </div>
          <div className="participant-name">Vous</div>
        </div>

        {/* Miniatures des autres participants */}
        {Array.from(users.entries()).map(([userId, user]) => (
          <div key={userId} className="participant-thumbnail">
            <div className="video-wrapper">
              {streams.has(userId) ? (
                <ReactPlayer
                  playing
                  width="100%"
                  height="100%"
                  url={streams.get(userId)}
                />
              ) : (
                <div className="no-video">
                  <div className="avatar">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
            </div>
            <div className="participant-name">{user.email}</div>
          </div>
        ))}
      </div>

      {/* Zone principale avec le bouton d'appel */}
      <div className="main-content">
        {users.size > 0 && !isCallInProgress && (
          <div className="call-to-action">
            <button 
              className="call-all-button"
              onClick={handleCallAllUsers}
              disabled={!myStreamRef.current || isCallInProgress || isCameraInitializing}
            >
              {isCameraInitializing ? "Activation de la caméra..." :
               !myStreamRef.current ? "Caméra non disponible" :
               isCallInProgress ? "Appels en cours..." : 
               "Démarrer l'appel vidéo"}
            </button>
          </div>
        )}

        {/* Affichage du participant actif */}
        <div className="active-speaker">
          {myStreamRef.current && (
            <ReactPlayer
              playing
              muted
              width="100%"
              height="100%"
              url={myStreamRef.current}
            />
          )}
        </div>
      </div>

      {/* Barre latérale des participants */}
      <div className="participants-sidebar">
        <div className="sidebar-header">
          <h3>Participants ({users.size + 1})</h3>
        </div>
        <div className="participants-list">
          <div className="participant-item">
            <div className="participant-info">
              <div className="avatar small">Vous</div>
              <span>Vous</span>
            </div>
          </div>
          {Array.from(users.entries()).map(([userId, user]) => (
            <div key={userId} className="participant-item">
              <div className="participant-info">
                <div className="avatar small">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span>{user.email}</span>
              </div>
              <div className="participant-status">
                {streams.has(userId) ? (
                  <span className="connected">Connecté</span>
                ) : (
                  <span className="waiting">En attente</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoomPage;