import { useCallback, useState } from 'react';
import peer from '../service/peer';

export const useWebRTCHandlers = (socket, myStreamRef, setStreams) => {
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [error, setError] = useState('');

  const handleCallUser = useCallback(async (userId) => {
    try {
      setIsCallInProgress(true);
      setError('');

      if (!myStreamRef.current) {
        throw new Error('No local stream available');
      }

      peer.closePeer();
      const peerConnection = peer.createPeer();
      
      await peer.addTracks(myStreamRef.current);
      const offer = await peer.getOffer();
      socket.emit('user:call', { to: userId, offer });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('peer:ice-candidate', {
            to: userId,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0]);
        setStreams(prev => new Map(prev).set(userId, event.streams[0]));
      };

    } catch (err) {
      console.error('Error during call:', err);
      setError('Failed to establish call. Check your camera and microphone.');
      setIsCallInProgress(false);
    }
  }, [socket, myStreamRef, setStreams]);

  const handleIncomingCall = useCallback(async ({ from, offer }) => {
    try {
      setIsCallInProgress(true);
      setError('');

      if (!myStreamRef.current) {
        throw new Error('No local stream available');
      }

      peer.closePeer();
      const peerConnection = peer.createPeer();
      await peer.addTracks(myStreamRef.current);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('peer:ice-candidate', {
            to: from,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0]);
        setStreams(prev => new Map(prev).set(from, event.streams[0]));
      };

      const ans = await peer.getAnswer(offer);
      socket.emit('call:accepted', { to: from, ans });

    } catch (err) {
      console.error('Error handling incoming call:', err);
      setError('Failed to accept call. Check your camera and microphone.');
      setIsCallInProgress(false);
    }
  }, [socket, myStreamRef, setStreams]);

  const handleCallAccepted = useCallback(async ({ ans }) => {
    try {
      await peer.setLocalDescription(ans);
      console.log('Call Accepted!');
    } catch (err) {
      console.error('Error accepting call:', err);
      setError('Connection error');
      setIsCallInProgress(false);
    }
  }, []);

  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      if (peer.peer) {
        await peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  const handleCallAllUsers = useCallback(async (users, streams) => {
    try {
      setIsCallInProgress(true);
      setError('');

      if (!myStreamRef.current) {
        throw new Error('No local stream available');
      }

      for (const [userId] of users.entries()) {
        if (!streams.has(userId)) {
          try {
            await handleCallUser(userId);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Error calling user ${userId}:`, err);
          }
        }
      }

      setIsCallInProgress(false);
    } catch (err) {
      console.error('Error in group call:', err);
      setError('Failed to establish group call. Check your camera and microphone.');
      setIsCallInProgress(false);
    }
  }, [handleCallUser]);

  return {
    isCallInProgress,
    error,
    handleCallUser,
    handleIncomingCall,
    handleCallAccepted,
    handleIceCandidate,
    handleCallAllUsers
  };
};