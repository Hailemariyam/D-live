function oneToManyHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🟢 [One-to-Many] Connected: ${socket.id}`);

    socket.on("join-class", ({ classId, role }) => {
      socket.join(classId);
      socket.data.classId = classId;
      socket.data.role = role;
      console.log(`👤 ${role.toUpperCase()} joined class ${classId}: ${socket.id}`);

      if (role === "host") {
        io.to(classId).emit("host-joined", socket.id);
        const socketsInRoom = io.sockets.adapter.rooms.get(classId) || new Set();
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data?.role === "viewer") {
            io.to(socket.id).emit("user-joined", s.id);
          }
        }
      } else {
        const socketsInRoom = io.sockets.adapter.rooms.get(classId) || new Set();
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data?.role === "host") {
            io.to(s.id).emit("user-joined", socket.id);
          }
        }
      }
    });

    socket.on("offer", ({ classId, offer, targetId }) => {
      console.log(`📡 Offer from ${socket.id} to ${targetId} in class ${classId}`);
      io.to(targetId).emit("offer", { offer, senderId: socket.id });
    });

    socket.on("answer", ({ classId, answer, targetId }) => {
      console.log(`📡 Answer from ${socket.id} to ${targetId} in class ${classId}`);
      io.to(targetId).emit("answer", { answer, senderId: socket.id });
    });

    socket.on("ice-candidate", ({ classId, candidate, targetId }) => {
      console.log(`❄️ ICE candidate from ${socket.id} to ${targetId} in class ${classId}`);
      io.to(targetId).emit("ice-candidate", { candidate, senderId: socket.id });
    });

    socket.on("leave-class", ({ classId }) => {
      console.log(`🚪 ${socket.id} left class ${classId}`);
      socket.leave(classId);
      io.to(classId).emit("user-left", socket.id);
    });

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
