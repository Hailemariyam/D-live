<!-- components/ViewerView.vue -->
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
    // Optionally display your local stream as self-preview:
    localVideo.value.srcObject = localStream;
  } catch (err) {
    console.error("Failed to access media devices", err);
  }
}

function createPeerConnection(senderId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // Add local stream tracks so that the viewer sends its media to broadcaster
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        targetId: senderId, // the broadcaster's id in this context
        candidate: event.candidate,
      });
    }
  };

  // Handle incoming remote tracks (e.g. broadcaster’s video)
  pc.ontrack = (event) => {
    if (!remoteVideos.value.find((v) => v.id === senderId)) {
      remoteVideos.value.push({ id: senderId, stream: event.streams[0] });
    }
  };

  peerConnections[senderId] = pc;
  return pc;
}

onMounted(async () => {
  await startLocalStream();
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
  localStream?.getTracks().forEach((track) => track.stop());
});
</script>

<template>
  <div>
    <h2 class="text-lg font-bold mb-2">👀 Viewer Stream</h2>
    <!-- Optional self-preview for viewer -->
    <div class="mb-4">
      <h3 class="text-md font-semibold">My Video (Self Preview):</h3>
      <video ref="localVideo" autoplay muted playsinline class="w-full rounded shadow" />
    </div>
    <!-- Remote stream(s) from broadcaster -->
    <div>
      <h3 class="text-md font-semibold mb-2">Broadcaster Stream:</h3>
      <div v-for="video in remoteVideos" :key="video.id">
        <video
          autoplay
          playsinline
          class="w-full aspect-video rounded border shadow"
          :srcObject="video.stream"
        ></video>
      </div>
    </div>
  </div>
</template>
