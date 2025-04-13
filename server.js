const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://dlive.degantechnologies.com"],
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true,
  },
});

// Serve a simple homepage for testing
app.get("/", (req, res) => {
  res.send("WebSocket Server is running");
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-class", ({ classId }) => {
    socket.join(classId);
    io.to(classId).emit("user-joined", socket.id);
    console.log(`User ${socket.id} joined class ${classId}`);
  });

  socket.on("offer", ({ classId, offer, senderId }) => {
    socket.to(classId).emit("offer", { offer, senderId });
  });

  socket.on("answer", ({ classId, answer, senderId }) => {
    socket.to(classId).emit("answer", { answer, senderId });
  });

  socket.on("ice-candidate", ({ classId, candidate, senderId }) => {
    socket.to(classId).emit("ice-candidate", { candidate, senderId });
  });

  socket.on("leave-class", ({ classId }) => {
    socket.leave(classId);
    io.to(classId).emit("user-left", socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    io.emit("user-disconnected", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket Server running on port ${PORT}`);
});



// const express = require("express");
// const http = require("http");
// const path = require("path");
// const { Server } = require("socket.io");

// const oneToOneHandler = require("./socket/oneToOneHandler");
// const oneToManyHandler = require("./socket/oneToManyHandler");


// const app = express();
// const server = http.createServer(app);

// // Setup CORS for production domain
// const io = new Server(server, {
//   cors: {
//     origin: ["https://dlive.degantechnologies.com"],
//     methods: ["GET", "POST"],
//     transports: ["websocket", "polling"],
//     credentials: true,
//   },
// });

// // Serve frontend (Vue app build)
// const frontendPath = path.join(__dirname, "live-class-client/dist");
// app.use(express.static(frontendPath));

// // Frontend fallback (for Vue Router)
// app.get("*", (req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });

// // Set up Socket.IO namespaces
// const oneToOneNamespace = io.of("/one-to-one");
// oneToOneHandler(oneToOneNamespace);

// const oneToManyNamespace = io.of("/one-to-many");
// oneToManyHandler(oneToManyNamespace);

// // API endpoints for frontend to fetch WebSocket URLs
// app.get("/api/v1/live/one-to-one", (req, res) => {
//   res.json({ socketUrl: "https://dlive.degantechnologies.com/one-to-one" });
// });

// // app.get("/api/v1/live/one-to-many", (req, res) => {
// //   res.json({ socketUrl: "https://dlive.degantechnologies.com/one-to-many" });
// // });

// // Start the server
// const PORT = process.env.PORT || 8080;
// server.listen(PORT, () => {
//   console.log(`✅ Server listening on port ${PORT}`);
// });
