import React from 'react';

const VideoControls = ({
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  isRecording,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onStartRecording,
  onStopRecording
}) => {
  return (
    <div className="controls">
      <button 
        onClick={onToggleVideo}
        className={`control-btn ${isVideoEnabled ? 'active' : ''}`}
      >
        {isVideoEnabled ? '🎥' : '🚫'} Caméra
      </button>
      <button 
        onClick={onToggleAudio}
        className={`control-btn ${isAudioEnabled ? 'active' : ''}`}
      >
        {isAudioEnabled ? '🎤' : '🚫'} Micro
      </button>
      <button
        onClick={onToggleScreenShare}
        className={`control-btn ${isScreenSharing ? 'active' : ''}`}
      >
        {isScreenSharing ? '📺' : '🖥️'} Share Screen
      </button>
      {!isRecording ? (
        <button
          onClick={onStartRecording}
          className="control-btn"
        >
          ⏺️ Start Recording
        </button>
      ) : (
        <button
          onClick={onStopRecording}
          className="control-btn active"
        >
          ⏹️ Stop Recording
        </button>
      )}
    </div>
  );
};

export default VideoControls;