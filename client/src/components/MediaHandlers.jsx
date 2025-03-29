import { useCallback, useState } from 'react';

export const useMediaHandlers = (myStreamRef, isInitializedRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isCameraInitializing, setIsCameraInitializing] = useState(true);
  const [error, setError] = useState('');

  const initializeMediaStream = useCallback(async () => {
    try {
      if (isInitializedRef.current) return myStreamRef.current;
      
      setIsCameraInitializing(true);
      console.log("Initialisation de la caméra...");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      if (videoTrack) videoTrack.enabled = isVideoEnabled;
      if (audioTrack) audioTrack.enabled = isAudioEnabled;
      
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

  const startRecording = useCallback(async () => {
    try {
      if (!myStreamRef.current) return;
      
      const mediaStream = myStreamRef.current;
      const recorder = new MediaRecorder(mediaStream);
      const chunks = [];
  
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${new Date().toISOString()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
  
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to start recording");
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }, [mediaRecorder]);
  
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        myStreamRef.current = cameraStream;
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        myStreamRef.current = screenStream;
        setIsScreenSharing(true);
  
        screenStream.getVideoTracks()[0].onended = async () => {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          myStreamRef.current = cameraStream;
          setIsScreenSharing(false);
        };
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      setError("Failed to toggle screen sharing");
    }
  }, [isScreenSharing]);

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

  const retryCamera = async () => {
    try {
      setError("");
      isInitializedRef.current = false;
      await initializeMediaStream();
    } catch (err) {
      console.error("Erreur lors de la nouvelle tentative d'accès à la caméra:", err);
    }
  };

  return {
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
  };
};