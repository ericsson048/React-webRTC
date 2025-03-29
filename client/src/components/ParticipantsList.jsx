import React from 'react';
import ReactPlayer from 'react-player';

const ParticipantsList = ({
  users,
  streams,
  myStreamRef,
  isCameraInitializing
}) => {
  return (
    <div className="participants-bar">
      {/* My video stream */}
      <div className="participant-thumbnail">
        <div className="video-wrapper">
          {isCameraInitializing ? (
            <div className="camera-initializing">
              <span className="loading-dots">Initializing camera...</span>
            </div>
          ) : myStreamRef.current ? (
            <ReactPlayer
              playing
              muted
              width="100%"
              height="100%"
              url={myStreamRef.current}
              className="react-player"
            />
          ) : (
            <div className="camera-error">
              <div className="avatar">You</div>
            </div>
          )}
        </div>
        <div className="participant-name">You</div>
      </div>

      {/* Other participants */}
      {Array.from(users.entries()).map(([userId, user]) => (
        <div key={userId} className="participant-thumbnail">
          <div className="video-wrapper">
            {streams.has(userId) ? (
              <ReactPlayer
                playing
                width="100%"
                height="100%"
                url={streams.get(userId)}
                className="react-player"
              />
            ) : (
              <div className="no-video">
                <div className="avatar">{user.email.charAt(0).toUpperCase()}</div>
              </div>
            )}
          </div>
          <div className="participant-name">{user.email}</div>
        </div>
      ))}
    </div>
  );
};

export default ParticipantsList;