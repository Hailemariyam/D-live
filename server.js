// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");

// const app = express();
// const PORT = process.env.PORT || 8080;

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: ["https://degan-livestream.vercel.app/"],
//     methods: ["GET", "POST"],
//     transports: ["websocket", "polling"],
//     credentials: true,
//   },
// });

// // Serve a simple homepage for testing
// app.get("/", (req, res) => {
//   res.send("WebSocket Server is running");
// });

// io.on("connection", (socket) => {
//   console.log(`User connected: ${socket.id}`);

//   socket.on("join-class", ({ classId }) => {
//     socket.join(classId);
//     io.to(classId).emit("user-joined", socket.id);
//     console.log(`User ${socket.id} joined class ${classId}`);
//   });

//   socket.on("offer", ({ classId, offer, senderId }) => {
//     socket.to(classId).emit("offer", { offer, senderId });
//   });

//   socket.on("answer", ({ classId, answer, senderId }) => {
//     socket.to(classId).emit("answer", { answer, senderId });
//   });

//   socket.on("ice-candidate", ({ classId, candidate, senderId }) => {
//     socket.to(classId).emit("ice-candidate", { candidate, senderId });
//   });

//   socket.on("leave-class", ({ classId }) => {
//     socket.leave(classId);
//     io.to(classId).emit("user-left", socket.id);
//   });

//   socket.on("disconnect", () => {
//     console.log(`User disconnected: ${socket.id}`);
//     io.emit("user-disconnected", socket.id);
//   });
// });

// server.listen(PORT, () => {
//   console.log(`✅ WebSocket Server running on port ${PORT}`);
// });



const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const oneToOneHandler = require("./socket/oneToOneHandler").default;
const oneToManyHandler = require("./socket/oneToManyHandler").default;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Modify the origin value as needed.
    origin: ["https://live-class-client.vercel.app/"],
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true,
  },
});

// Set up Socket.IO namespaces:
// One-to-One namespace
const oneToOneNamespace = io.of("/one-to-one");
oneToOneHandler(oneToOneNamespace);

// One-to-Many namespace
const oneToManyNamespace = io.of("/one-to-many");
oneToManyHandler(oneToManyNamespace);

// Serve a simple homepage for testing
app.get("/", (req, res) => {
  res.send("Degan Live WebSocket Server is running");
});

app.get("/api/v1/live/one-to-one", (req, res) => {
  res.json({ socketUrl: "https://d-live-production.up.railway.app/one-to-one" });
});
app.get("/api/v1/live/one-to-many", (req, res) => {
  res.json({ socketUrl: "https://d-live-production.up.railway.app/one-to-many" });
});



// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
