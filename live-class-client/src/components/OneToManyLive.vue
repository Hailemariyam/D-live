<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideos = ref([]);
const isBroadcaster = ref(true); // 🔁 Toggle manually or pass as a prop for real use
const roomId = "live-class-room-123";

// Socket.IO setup for one-to-many namespace
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
});

const peerConnections = {}; // key: socketId, value: RTCPeerConnection
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let localStream = null;

// 🌐 Start camera/mic
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (isBroadcaster.value && localVideo.value) {
      localVideo.value.srcObject = localStream;
    }
  } catch (err) {
    console.error("Failed to access media devices", err);
  }
}

// 📡 Broadcaster: Handle viewer joining
async function handleViewerJoined({ viewerId }) {
  const pc = createPeerConnection(viewerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { viewerId, offer });
}

// 📦 Create WebRTC peer connection
function createPeerConnection(targetId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  if (isBroadcaster.value) {
    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        targetId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    if (!isBroadcaster.value) {
      const existing = remoteVideos.value.find((v) => v.id === targetId);
      if (!existing) {
        remoteVideos.value.push({ id: targetId, stream: event.streams[0] });
      }
    }
  };

  peerConnections[targetId] = pc;
  return pc;
}

// 🎬 Viewer: Handle offer from broadcaster
socket.on("offer", async ({ offer, senderId }) => {
  const pc = createPeerConnection(senderId);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { broadcasterId: senderId, answer });
});

// 📥 Broadcaster: Receive answer
socket.on("answer", async ({ answer, senderId }) => {
  const pc = peerConnections[senderId];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// ❄️ ICE Candidate exchange
socket.on("ice-candidate", async ({ candidate, senderId }) => {
  const pc = peerConnections[senderId];
  if (pc && candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("ICE candidate error:", err);
    }
  }
});

// 🚦 Init on mount
onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", {
    classId: roomId,
    role: isBroadcaster.value ? "broadcaster" : "viewer",
  });

  if (isBroadcaster.value) {
    socket.on("viewer-joined", handleViewerJoined);
  }
});

// 🧹 Clean up
onUnmounted(() => {
  socket.emit("leave-class", { classId: roomId });
  socket.disconnect();

  Object.values(peerConnections).forEach((pc) => pc.close());
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  remoteVideos.value = [];
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl font-bold mb-2">📺 One-to-Many Video Call</h2>

    <!-- Broadcaster -->
    <div v-if="isBroadcaster">
      <h3 class="text-lg font-semibold mb-1">🎥 Broadcaster Stream</h3>
      <video
        ref="localVideo"
        autoplay
        muted
        playsinline
        class="w-full border rounded shadow"
      ></video>
    </div>

    <!-- Viewer -->
   <!-- Viewer -->
<div v-else>
  <h3 class="text-lg font-semibold mb-2">👥 Viewer Stream</h3>
  <div
    class="grid gap-4"
    :class="{
      'grid-cols-1': remoteVideos.length === 1,
      'grid-cols-2': remoteVideos.length === 2,
      'grid-cols-3': remoteVideos.length >= 3,
      'grid-cols-4': remoteVideos.length >= 5,
    }"
  >
    <video
      v-for="video in remoteVideos"
      :key="video.id"
      :srcObject="video.stream"
      autoplay
      playsinline
      class="w-full aspect-video border rounded shadow"
    ></video>
  </div>
</div>

  </div>
</template>
