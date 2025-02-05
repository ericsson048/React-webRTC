class PeerService {
  constructor() {
    this.peer = null;
  }

  // Créer une nouvelle connexion peer
  createPeer() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ],
        },
      ],
    });
    return this.peer;
  }

  // Obtenir la connexion peer existante ou en créer une nouvelle
  getPeer() {
    if (!this.peer) {
      this.createPeer();
    }
    return this.peer;
  }

  // Fermer la connexion peer
  closePeer() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
  }

  async getAnswer(offer) {
    try {
      const peer = this.getPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(new RTCSessionDescription(answer));
      return answer;
    } catch (error) {
      console.error("Error getting answer:", error);
      throw error;
    }
  }

  async setLocalDescription(ans) {
    try {
      const peer = this.getPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(ans));
    } catch (error) {
      console.error("Error setting remote description:", error);
      throw error;
    }
  }

  async getOffer() {
    try {
      const peer = this.getPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(new RTCSessionDescription(offer));
      return offer;
    } catch (error) {
      console.error("Error getting offer:", error);
      throw error;
    }
  }

  // Ajouter un flux média à la connexion peer
  async addTracks(stream) {
    try {
      const peer = this.getPeer();
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
    } catch (error) {
      console.error("Error adding tracks:", error);
      throw error;
    }
  }
}

export default new PeerService();
