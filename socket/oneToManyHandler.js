function oneToManyHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🔵 [One-to-Many] User connected: ${socket.id}`);

    socket.on("join-class", ({ classId, role }) => {
      socket.join(classId);
      socket.classId = classId;
      socket.role = role;

      if (role === "viewer") {
        // Notify the broadcaster that a new viewer has joined
        const clients = Array.from(io.sockets.adapter.rooms.get(classId) || []);
        const broadcaster = clients.find((id) => io.sockets.sockets.get(id)?.role === "broadcaster");
        if (broadcaster) {
          io.to(broadcaster).emit("viewer-joined", { viewerId: socket.id });
        }
      }

      console.log(`👤 ${role} joined class ${classId}: ${socket.id}`);
    });

    socket.on("leave-class", ({ classId }) => {
      socket.leave(classId);
      socket.to(classId).emit("user-left", socket.id);
    });

    // Broadcaster sends offer to a specific viewer
    socket.on("offer", ({ viewerId, offer }) => {
      io.to(viewerId).emit("offer", { offer, senderId: socket.id });
    });

    // Viewer sends answer back to broadcaster
    socket.on("answer", ({ broadcasterId, answer }) => {
      io.to(broadcasterId).emit("answer", { answer, senderId: socket.id });
    });

    // ICE candidate exchange
    socket.on("ice-candidate", ({ targetId, candidate }) => {
      io.to(targetId).emit("ice-candidate", {
        candidate,
        senderId: socket.id,
      });
    });

    socket.on("disconnect", () => {
      const { classId, role } = socket;
      console.log(`🔴 [One-to-Many] ${role} disconnected: ${socket.id}`);
      if (classId) {
        socket.to(classId).emit("user-left", socket.id);
      }
    });
  });
}

module.exports = oneToManyHandler;
