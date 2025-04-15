<!-- components/ViewerView.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const remoteVideos = ref([]);
const roomId = "live-class-room-123";
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
});
const peerConnections = {};
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function createPeerConnection(senderId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        targetId: senderId,
        candidate: event.candidate,
      });
    }
  };
  pc.ontrack = (event) => {
    if (!remoteVideos.value.find((v) => v.id === senderId)) {
      remoteVideos.value.push({ id: senderId, stream: event.streams[0] });
    }
  };
  peerConnections[senderId] = pc;
  return pc;
}

onMounted(() => {
  socket.emit("join-class", {
    classId: roomId,
    role: "viewer",
  });

  socket.on("offer", async ({ offer, senderId }) => {
    const pc = createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { broadcasterId: senderId, answer });
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
  remoteVideos.value = [];
});
</script>

<template>
  <div>
    <h2 class="text-lg font-bold mb-2">👀 Viewer Stream</h2>
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
</template>
