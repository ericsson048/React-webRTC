const { Server } = require("socket.io");

const io = new Server(8000, {
  cors: true,
});

// Maps pour stocker les informations des utilisateurs et des rooms
const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();
const roomToUsersMap = new Map();
const userConnectionsMap = new Map(); // Nouvelle map pour gérer les connexions multiples

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);
  
  socket.on("room:join", (data) => {
    try {
      const { email, room } = data;
      
      // Vérifier les données
      if (!email || !room) {
        socket.emit("room:error", { message: "Email et room sont requis" });
        return;
      }

      // Enregistrer les mappings
      emailToSocketIdMap.set(email, socket.id);
      socketidToEmailMap.set(socket.id, email);
      
      // Gérer la room
      if (!roomToUsersMap.has(room)) {
        roomToUsersMap.set(room, new Set());
      }
      roomToUsersMap.get(room).add(socket.id);
      
      // Initialiser les connexions de l'utilisateur
      if (!userConnectionsMap.has(socket.id)) {
        userConnectionsMap.set(socket.id, new Set());
      }
      
      // Obtenir la liste des utilisateurs actuels
      const usersInRoom = Array.from(roomToUsersMap.get(room))
        .filter(id => id !== socket.id)
        .map(id => ({
          email: socketidToEmailMap.get(id),
          id: id
        }));
      
      // Rejoindre la room
      socket.join(room);
      
      // Informer le nouvel utilisateur
      socket.emit("room:join", { room, users: usersInRoom });
      
      // Informer les autres utilisateurs
      socket.to(room).emit("user:joined", { email, id: socket.id });
      
      console.log(`User ${email} joined room ${room}`);
    } catch (error) {
      console.error("Error in room:join:", error);
      socket.emit("room:error", { message: "Erreur lors de la connexion à la room" });
    }
  });

  socket.on("disconnect", () => {
    const email = socketidToEmailMap.get(socket.id);
    const rooms = Array.from(roomToUsersMap.keys());
    
    // Nettoyer les rooms
    rooms.forEach(room => {
      if (roomToUsersMap.has(room)) {
        const users = roomToUsersMap.get(room);
        if (users.has(socket.id)) {
          users.delete(socket.id);
          if (users.size === 0) {
            roomToUsersMap.delete(room);
          }
          io.to(room).emit("user:left", { email, id: socket.id });
        }
      }
    });
    
    // Nettoyer les connexions de l'utilisateur
    if (userConnectionsMap.has(socket.id)) {
      const connections = userConnectionsMap.get(socket.id);
      connections.forEach(connectedUserId => {
        if (userConnectionsMap.has(connectedUserId)) {
          userConnectionsMap.get(connectedUserId).delete(socket.id);
        }
      });
      userConnectionsMap.delete(socket.id);
    }
    
    // Nettoyer les mappings
    emailToSocketIdMap.delete(email);
    socketidToEmailMap.delete(socket.id);
    
    console.log(`User ${email} disconnected`);
  });

  // Gestion des appels vidéo
  socket.on("user:call", ({ to, offer }) => {
    // Vérifier si l'utilisateur n'est pas déjà connecté
    if (userConnectionsMap.has(socket.id) && !userConnectionsMap.get(socket.id).has(to)) {
      // Ajouter la connexion dans les deux sens
      userConnectionsMap.get(socket.id).add(to);
      if (!userConnectionsMap.has(to)) {
        userConnectionsMap.set(to, new Set());
      }
      userConnectionsMap.get(to).add(socket.id);
      
      // Envoyer l'offre
      io.to(to).emit("incomming:call", { from: socket.id, offer });
    }
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("peer:ice-candidate", { from: socket.id, candidate });
  });
});
