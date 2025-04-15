<!-- components/BroadcasterView.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideos = ref([]);
const roomId = "live-class-room-123";
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
});
const peerConnections = {};
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let localStream = null;

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (err) {
    console.error("Failed to access media devices", err);
  }
}

function createPeerConnection(targetId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // Attach local stream tracks to the PC
  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Listen for ICE candidates and send them to the other peer
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        targetId,
        candidate: event.candidate,
      });
    }
  };

  // Listen for remote tracks from the viewer
  pc.ontrack = (event) => {
    // Add the remote stream if it is not already added.
    if (!remoteVideos.value.find((v) => v.id === targetId)) {
      remoteVideos.value.push({ id: targetId, stream: event.streams[0] });
    }
  };

  peerConnections[targetId] = pc;
  return pc;
}

async function handleViewerJoined({ viewerId }) {
  const pc = createPeerConnection(viewerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { viewerId, offer });
}

onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", {
    classId: roomId,
    role: "broadcaster",
  });
  socket.on("viewer-joined", handleViewerJoined);
  socket.on("answer", async ({ answer, senderId }) => {
    const pc = peerConnections[senderId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });
  socket.on("ice-candidate", async ({ candidate, senderId }) => {
    const pc = peerConnections[senderId];
    if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
  });
  socket.on("user-left", (id) => {
    const pc = peerConnections[id];
    if (pc) pc.close();
    delete peerConnections[id];
    remoteVideos.value = remoteVideos.value.filter((v) => v.id !== id);
  });
});

onUnmounted(() => {
  socket.emit("leave-class", { classId: roomId });
  socket.disconnect();
  Object.values(peerConnections).forEach((pc) => pc.close());
  localStream?.getTracks().forEach((track) => track.stop());
});
</script>

<template>
  <div>
    <h2 class="text-lg font-bold mb-2">🎥 Broadcaster Stream</h2>
    <video ref="localVideo" autoplay muted playsinline class="w-full rounded shadow" />
    <div class="mt-4">
      <h3 class="text-md font-semibold mb-2">Remote Viewer Streams:</h3>
      <div
        class="grid gap-4"
        :class="{
          'grid-cols-1': remoteVideos.length === 1,
          'grid-cols-2': remoteVideos.length === 2,
          'grid-cols-3': remoteVideos.length >= 3 && remoteVideos.length < 5,
          'grid-cols-4': remoteVideos.length >= 5,
        }"
      >
        <video
          v-for="video in remoteVideos"
          :key="video.id"
          autoplay
          playsinline
          class="w-full aspect-video rounded border shadow"
          :srcObject="video.stream"
        ></video>
      </div>
    </div>
  </div>
</template>
