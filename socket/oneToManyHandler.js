function oneToManyHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🟢 [One-to-Many] Connected: ${socket.id}`);

    // Handle join-class event
    socket.on("join-class", ({ classId, role }) => {
      socket.join(classId);
      socket.data.classId = classId;
      socket.data.role = role;

      console.log(`👤 ${role.toUpperCase()} joined class ${classId}: ${socket.id}`);

      if (role === "host") {
        // Notify viewers that host joined
        io.to(classId).emit("host-joined", socket.id);

        // Send notifications to host about existing viewers
        const socketsInRoom = io.sockets.adapter.rooms.get(classId) || new Set();
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data?.role === "viewer") {
            io.to(socket.id).emit("user-joined", s.id);
          }
        }
      } else {
        // Notify only the host about the new viewer
        const socketsInRoom = io.sockets.adapter.rooms.get(classId) || new Set();
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data?.role === "host") {
            io.to(s.id).emit("user-joined", socket.id);
          }
        }
      }
    });

    // Forward offer from host to specific viewer
    socket.on("offer", ({ classId, offer, targetId }) => {
      console.log(`📡 Offer from ${socket.id} to ${targetId} in class ${classId}`);
      io.to(targetId).emit("offer", { offer, senderId: socket.id });
    });

    // Forward answer from viewer to host
    socket.on("answer", ({ classId, answer, targetId }) => {
      console.log(`📡 Answer from ${socket.id} to ${targetId} in class ${classId}`);
      io.to(targetId).emit("answer", { answer, senderId: socket.id });
    });

    // ICE candidate forwarding between peers
    socket.on("ice-candidate", ({ classId, candidate, targetId }) => {
      console.log(`❄️ ICE candidate from ${socket.id} to ${targetId} in class ${classId}`);
      io.to(targetId).emit("ice-candidate", { candidate, senderId: socket.id });
    });

    // Leave class event
    socket.on("leave-class", ({ classId }) => {
      console.log(`🚪 ${socket.id} left class ${classId}`);
      socket.leave(classId);
      io.to(classId).emit("user-left", socket.id);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const classId = socket.data?.classId;
      if (classId) {
        console.log(`🔌 Disconnected from class ${classId}: ${socket.id}`);
        io.to(classId).emit("user-left", socket.id);
      } else {
        console.log(`🔌 Disconnected (no class): ${socket.id}`);
      }
    });
  });
}

module.exports = oneToManyHandler;
