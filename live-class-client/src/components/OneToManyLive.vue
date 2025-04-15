<template>
  <div class="p-4">
    <h2 class="text-2xl font-bold mb-4">DLive – One-to-Many Demo</h2>

    <!-- Role Selector -->
    <div class="mb-4">
      <label class="font-semibold mr-2">Select Role:</label>
      <select v-model="role" class="border p-1 rounded">
        <option value="host">Host</option>
        <option value="viewer">Viewer</option>
      </select>
    </div>

    <!-- Host UI -->
    <div v-if="role === 'host'" class="mb-6">
      <h3 class="text-xl font-semibold mb-2">🎥 Host Camera</h3>
      <video ref="localVideo" autoplay playsinline muted class="w-full border rounded mb-2" />
      <div>
        <h4 class="font-semibold">Connected Viewers:</h4>
        <ul class="list-disc list-inside">
          <li v-for="id in connectedViewers" :key="id">{{ id }}</li>
        </ul>
      </div>
    </div>

    <!-- Viewer UI -->
    <div v-if="role === 'viewer'" class="mb-6">
      <h3 class="text-xl font-semibold mb-2">📺 Host Stream</h3>
      <video ref="remoteVideo" autoplay playsinline controls class="w-full border rounded" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

// Choose your role: "host" or "viewer"
const role = ref("host");

// References for video elements
const localVideo = ref(null);
const remoteVideo = ref(null);

// For host: list of connected viewer IDs.
const connectedViewers = reactive([]);

// Establish the socket connection with reconnection options
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
  reconnectionAttempts: 5,    // Try 5 reconnection attempts
  reconnectionDelay: 1000     // 1 second delay between attempts
});

// Log connection events for debugging
socket.on("connect", () => {
  console.log("WebSocket connected:", socket.id);
});
socket.on("connect_error", (err) => {
  console.error("Connection error:", err);
});
socket.on("disconnect", (reason) => {
  console.warn("WebSocket disconnected:", reason);
});

const classId = "class-room-123";
let localStream;
const peerConnections = {}; // For host: key is viewerId → RTCPeerConnection
let hostId = null;          // For viewer: store host socket ID
let peerConnection = null;  // For viewer: single peer connection

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/* ========= HOST LOGIC ========= */
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.value.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing local media", error);
  }
}

function createPeerConnection(viewerId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // Add all local tracks to the connection.
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        classId,
        candidate: event.candidate,
        targetId: viewerId,
      });
    }
  };

  // No ontrack on host since viewers do not send media.
  peerConnections[viewerId] = pc;
  return pc;
}

async function handleNewViewer(viewerId) {
  connectedViewers.push(viewerId);
  const pc = createPeerConnection(viewerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", {
    classId,
    offer,
    targetId: viewerId,
  });
}

/* ========= VIEWER LOGIC ========= */
function createViewerPC() {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // When receiving a track from the host, render it in the video element.
  pc.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        classId,
        candidate: event.candidate,
        targetId: hostId,
      });
    }
  };

  return pc;
}

/* ========= SOCKET EVENTS ========= */
socket.on("host-joined", (hostSocketId) => {
  if (role.value === "viewer") {
    hostId = hostSocketId;
    console.log("Viewer: Host joined. hostId:", hostId);
  }
});

socket.on("user-joined", async (viewerId) => {
  if (role.value === "host") {
    console.log("Host: New viewer joined:", viewerId);
    await handleNewViewer(viewerId);
  }
});

socket.on("offer", async ({ offer, senderId }) => {
  if (role.value === "viewer") {
    hostId = senderId;
    peerConnection = createViewerPC();
    console.log("Viewer: Received offer from host:", hostId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", {
      classId,
      answer,
      targetId: senderId,
    });
  }
});

socket.on("answer", async ({ senderId, answer }) => {
  if (role.value === "host") {
    console.log("Host: Received answer from viewer:", senderId);
    const pc = peerConnections[senderId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }
});

socket.on("ice-candidate", async ({ senderId, candidate }) => {
  if (role.value === "host") {
    const pc = peerConnections[senderId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Host ICE error:", err);
      }
    }
  } else if (role.value === "viewer" && senderId === hostId && peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Viewer ICE error:", err);
    }
  }
});

socket.on("user-left", (viewerId) => {
  if (role.value === "host") {
    const pc = peerConnections[viewerId];
    if (pc) {
      pc.close();
      delete peerConnections[viewerId];
    }
    const index = connectedViewers.indexOf(viewerId);
    if (index !== -1) connectedViewers.splice(index, 1);
  }
});

/* ========= LIFECYCLE ========= */
onMounted(async () => {
  if (role.value === "host") {
    await startLocalStream();
  }
  socket.emit("join-class", { classId, role: role.value });
});

onUnmounted(() => {
  socket.emit("leave-class", { classId });
  socket.disconnect();
  Object.values(peerConnections).forEach((pc) => pc.close());
  if (peerConnection) peerConnection.close();
});
</script>

<style scoped>
select {
  min-width: 120px;
}
</style>
