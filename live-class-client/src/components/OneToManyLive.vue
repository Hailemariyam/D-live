

<script setup>
import { ref } from "vue";
import BroadcasterView from "./broadcasterView.vue";
import ViewerView from "./viwerView.vue";

const isBroadcaster = ref(true); // Toggle this via a prop, button, or route
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">🎓 Live Class</h1>
    <button
      @click="isBroadcaster = !isBroadcaster"
      class="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
    >
      Switch to {{ isBroadcaster ? "Viewer" : "Broadcaster" }}
    </button>
    <component :is="isBroadcaster ? BroadcasterView : ViewerView" />
  </div>
</template>
