function oneToManyHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🔵 [One-to-Many] User connected: ${socket.id}`);

    socket.on("join-class", ({ classId, role }) => {
      socket.join(classId);
      socket.classId = classId;
      socket.role = role;

      if (role === "viewer") {
        // Notify the broadcaster that a viewer has joined.
        const clients = Array.from(socket.nsp.adapter.rooms.get(classId) || []);
        const broadcaster = clients.find(
          (id) => socket.nsp.sockets.get(id)?.role === "broadcaster"
        );
        if (broadcaster) {
          socket.to(broadcaster).emit("viewer-joined", { viewerId: socket.id });
        }
        // Notify all other clients (including other viewers) about the new viewer.
        socket.to(classId).emit("new-viewer", { viewerId: socket.id });
      }

      console.log(`👤 ${role} joined class ${classId}: ${socket.id}`);
    });

    socket.on("leave-class", ({ classId }) => {
      socket.leave(classId);
      socket.to(classId).emit("user-left", socket.id);
    });

    // Broadcaster sends offer to a specific viewer.
    socket.on("offer", ({ viewerId, offer }) => {
      socket.nsp.to(viewerId).emit("offer", { offer, senderId: socket.id });
    });

    // Viewer sends answer back to the broadcaster.
    socket.on("answer", ({ broadcasterId, answer }) => {
      socket.nsp.to(broadcasterId).emit("answer", { answer, senderId: socket.id });
    });

    // ICE candidate exchange (common for all connections).
    socket.on("ice-candidate", ({ targetId, candidate }) => {
      socket.nsp.to(targetId).emit("ice-candidate", {
        candidate,
        senderId: socket.id,
      });
    });

    // New event: When an existing viewer sends an offer to a new viewer.
    socket.on("viewer-offer", ({ targetId, offer }) => {
      console.log(`Viewer ${socket.id} sending viewer-offer to ${targetId}`);
      socket.nsp.to(targetId).emit("viewer-offer", { offer, senderId: socket.id });
    });

    // New event: When a viewer sends an answer to a viewer-offer.
    socket.on("viewer-answer", ({ targetId, answer }) => {
      console.log(`Viewer ${socket.id} sending viewer-answer to ${targetId}`);
      socket.nsp.to(targetId).emit("viewer-answer", { answer, senderId: socket.id });
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
