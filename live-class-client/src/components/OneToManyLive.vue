<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideos = ref([]);
const isBroadcaster = ref(true); // Toggle manually for testing. In production, set via login/URL param.
const roomId = "live-class-room-123";

// Socket setup for one-to-many namespace
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
});

let localStream;
const peerConnections = {}; // key: socketId, value: RTCPeerConnection
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (isBroadcaster.value) {
      localVideo.value.srcObject = localStream;
    }
  } catch (error) {
    console.error("Media error:", error);
  }
}

function createPeerConnection(targetId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  if (isBroadcaster.value) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { targetId, candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    let existing = remoteVideos.value.find(v => v.id === targetId);
    if (!existing) {
      remoteVideos.value.push({ id: targetId, stream: event.streams[0] });
    }
  };

  peerConnections[targetId] = pc;
  return pc;
}

// BROWSER ROLE: BROADCASTER
async function handleViewerJoined({ viewerId }) {
  const pc = createPeerConnection(viewerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { viewerId, offer });
}

// BROWSER ROLE: VIEWER
socket.on("offer", async ({ offer, senderId }) => {
  const pc = createPeerConnection(senderId);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { broadcasterId: senderId, answer });
});

// Shared: Receive answer (only for broadcaster)
socket.on("answer", async ({ answer, senderId }) => {
  const pc = peerConnections[senderId];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// Shared: Receive ICE candidates
socket.on("ice-candidate", async ({ candidate, senderId }) => {
  const pc = peerConnections[senderId];
  if (pc && candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", { classId: roomId, role: isBroadcaster.value ? "broadcaster" : "viewer" });

  if (isBroadcaster.value) {
    socket.on("viewer-joined", handleViewerJoined);
  }
});

onUnmounted(() => {
  socket.emit("leave-class", { classId: roomId });
  socket.disconnect();

  Object.values(peerConnections).forEach((pc) => pc.close());
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
});
</script>
<template>
  <div class="p-4">
    <h2 class="text-xl font-bold">One-to-Many Video Call</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div v-if="isBroadcaster">
        <h3 class="text-lg font-semibold">Broadcaster</h3>
        <video ref="localVideo" autoplay playsinline muted class="w-full border rounded"></video>
      </div>

      <div v-else>
        <h3 class="text-lg font-semibold">Viewer</h3>
        <video
          v-for="viewer in remoteVideos"
          :key="viewer.id"
          :srcObject="viewer.stream"
          autoplay
          playsinline
          class="w-full border rounded mb-2"
        ></video>
      </div>
    </div>
  </div>
</template>
