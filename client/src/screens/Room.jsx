import React, { useEffect, useCallback, useState, useRef } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import { useParams, useNavigate } from "react-router-dom";
import "./Room.css";

// Import our new components
import VideoControls from "../components/VideoControls";
import ParticipantsList from "../components/ParticipantsList";
import { useMediaHandlers } from "../components/MediaHandlers";
import { useWebRTCHandlers } from "../components/WebRTCHandlers";

const RoomPage = () => {
  const socket = useSocket();
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const myStreamRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  const [users, setUsers] = useState(new Map());
  const [streams, setStreams] = useState(new Map());

  // Use our custom hooks
  const {
    isRecording,
    isScreenSharing,
    isVideoEnabled,
    isAudioEnabled,
    isCameraInitializing,
    error,
    initializeMediaStream,
    startRecording,
    stopRecording,
    toggleScreenShare,
    toggleVideo,
    toggleAudio,
    retryCamera
  } = useMediaHandlers(myStreamRef, isInitializedRef);

  const {
    isCallInProgress,
    handleCallUser,
    handleIncomingCall,
    handleCallAccepted,
    handleIceCandidate,
    handleCallAllUsers
  } = useWebRTCHandlers(socket, myStreamRef, setStreams);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (myStreamRef.current) {
      myStreamRef.current.getTracks().forEach(track => track.stop());
      myStreamRef.current = null;
    }
    isInitializedRef.current = false;
    setStreams(new Map());
  }, []);

  // Room initialization effect
  useEffect(() => {
    if (!roomId) {
      navigate("/");
      return;
    }

    const initRoom = async () => {
      try {
        if (!isInitializedRef.current) {
          await initializeMediaStream();
        }
      } catch (err) {
        console.error("Room initialization error:", err);
      }
    };

    initRoom();
    return cleanup;
  }, [roomId, navigate, initializeMediaStream, cleanup]);

  // User management handlers
  const handleUserJoined = useCallback(({ email, id }) => {
    setUsers(prev => new Map(prev).set(id, { email, stream: null }));
  }, []);

  const handleUserLeft = useCallback(({ email, id }) => {
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
    const usersMap = new Map();
    roomUsers.forEach(user => {
      usersMap.set(user.id, { email: user.email, stream: null });
    });
    setUsers(usersMap);
  }, []);

  // Socket event listeners
  useEffect(() => {
    socket.on("room:users", handleExistingUsers);
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("incomming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("room:users", handleExistingUsers);
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("incomming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:ice-candidate", handleIceCandidate);
    };
  }, [
    socket,
    handleExistingUsers,
    handleUserJoined,
    handleUserLeft,
    handleIncomingCall,
    handleCallAccepted,
    handleIceCandidate,
  ]);

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

      <VideoControls
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        onToggleVideo={toggleVideo}
        onToggleAudio={toggleAudio}
        onToggleScreenShare={toggleScreenShare}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      <ParticipantsList
        users={users}
        streams={streams}
        myStreamRef={myStreamRef}
        isCameraInitializing={isCameraInitializing}
      />

      <div className="main-content">
        {users.size > 0 && !isCallInProgress && (
          <div className="call-to-action">
            <button 
              className="call-all-button"
              onClick={() => handleCallAllUsers(users, streams)}
              disabled={!myStreamRef.current || isCallInProgress || isCameraInitializing}
            >
              {isCameraInitializing ? "Initializing camera..." :
               !myStreamRef.current ? "Camera not available" :
               isCallInProgress ? "Call in progress..." : 
               "Start video call"}
            </button>
          </div>
        )}

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

      <div className="participants-sidebar">
        <div className="sidebar-header">
          <h3>Participants ({users.size + 1})</h3>
        </div>
        <div className="participants-list">
          <div className="participant-item">
            <div className="participant-info">
              <div className="avatar small">You</div>
              <span>You</span>
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