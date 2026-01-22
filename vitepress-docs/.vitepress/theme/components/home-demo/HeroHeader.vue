<script setup>
import { computed, ref, watch, onUnmounted } from "vue";
const props = defineProps({
  deviceType: { type: String, default: "lg" },
});

const isVideoOpen = ref(false);
const VIDEO_PATH = "/web-sqlite-js-demo-v2.mp4";
const VIDEO_POSTER = "/web-sqlite-dev-tool-thubnail.png";

const openVideo = () => {
  isVideoOpen.value = true;
};

const closeVideo = () => {
  isVideoOpen.value = false;
};

const onKeydown = (event) => {
  if (event.key === "Escape") {
    closeVideo();
  }
};

watch(isVideoOpen, (open) => {
  if (open) {
    window.addEventListener("keydown", onKeydown);
  } else {
    window.removeEventListener("keydown", onKeydown);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});

// if the deviceType is lg, then set the padding: 80px 0px
// else set padding-bottom: 20px for the header-header
const layoutConfig = computed(() => {
  if (props.deviceType === "lg") {
    return {
      padding: "80px 0px",
    };
  } else {
    return {
      paddingBottom: "20px",
    };
  }
});
</script>

<template>
  <!-- make the style config here -->
  <div class="hero-header" :style="layoutConfig">
    <h1 class="title">web-sqlite-js</h1>
    <p class="description">
      A friendly, out-of-the-box SQLite database for the web.
      <br v-if="deviceType !== 'sm'" />
      Making persistent client-side storage simple for every developer.
    </p>

    <div class="cta-group" :class="deviceType">
      <a href="/getting-started.html" class="btn btn-primary">
        <svg class="btn-bg" viewBox="0 0 160 50" preserveAspectRatio="none">
          <path
            d="M3,5 Q10,2 80,3 Q150,4 157,8 Q159,25 156,42 Q150,48 80,47 Q10,46 4,42 Q1,25 3,5 Z"
            fill="#d9f2d0"
            stroke="#2d2d2d"
            stroke-width="2"
          />
        </svg>
        <span class="btn-text">Quickstart</span>
      </a>

      <button type="button" class="btn btn-primary" @click="openVideo">
        <svg class="btn-bg" viewBox="0 0 170 50" preserveAspectRatio="none">
          <path
            d="M3,6 Q12,2 85,3 Q158,4 167,10 Q169,25 166,41 Q160,48 85,47 Q10,46 4,41 Q1,25 3,6 Z"
            fill="#ffe6e6"
            stroke="#2d2d2d"
            stroke-width="2"
          />
        </svg>
        <span class="btn-icon" aria-hidden="true" style="top: -3px">
          <i class="fa-solid fa-play"></i>
        </span>
        <span class="btn-text">Play Demo</span>
      </button>

      <a
        href="https://chromewebstore.google.com/detail/web-sqlite-devtools/gacoipdgbohogohjdofcnbflcfldidfh"
        class="btn btn-secondary"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg class="btn-bg" viewBox="0 0 200 50" preserveAspectRatio="none">
          <path
            d="M5,8 Q15,4 100,5 Q185,6 195,10 Q198,25 194,40 Q185,46 100,45 Q15,44 6,40 Q2,25 5,8 Z"
            fill="#f8f6ee"
            stroke="#2d2d2d"
            stroke-width="2"
          />
        </svg>
        <span class="btn-icon" aria-hidden="true" style="top: -4px">
          <i class="fa-solid fa-puzzle-piece"></i>
        </span>
        <span class="btn-text">DevTools Extension</span>
      </a>
    </div>

    <teleport to="body">
      <transition name="video-modal-fade">
        <div
          v-if="isVideoOpen"
          class="video-modal-backdrop"
          @click.self="closeVideo"
        >
          <div
            class="video-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Web Sqlite demo video"
          >
            <button
              type="button"
              class="video-modal-close"
              @click="closeVideo"
              aria-label="Close demo video"
            >
              x
            </button>
            <div class="video-modal-frame">
              <video
                :src="VIDEO_PATH"
                :poster="VIDEO_POSTER"
                controls
                class="video-player"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.hero-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  /* padding-bottom: 20px; */
  width: 100%;
  max-width: 800px;
}

.title {
  font-family: "Kalam", cursive;
  font-size: 48px;
  font-weight: 700;
  margin: 0;
  color: #2d2d2d;
}

.description {
  font-family: "Kalam", cursive;
  font-size: 20px;
  color: #666;
  line-height: 1.4;
  margin: 0;
}

.cta-group {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.cta-group.sm {
  flex-direction: column;
  gap: 12px;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  gap: 8px;
  font-family: "Kalam", cursive;
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
  color: #2d2d2d;
  cursor: pointer;
  border: none;
  background: none;
  transition: transform 0.1s ease;
}

.btn:hover:not(.disabled) {
  transform: scale(1.05) rotate(-1deg);
}

.btn-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.btn span {
  position: relative;
  z-index: 1;
}

.btn-icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.btn-text {
  position: relative;
  z-index: 1;
}

.btn-secondary {
  color: #2d2d2d;
}

.btn-primary:active {
  transform: scale(0.98);
}

.video-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 24, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.video-modal-card {
  position: relative;
  width: min(920px, 92vw);
  border-radius: 20px;
  border: 3px solid #2d2d2d;
  background: #fff8e6;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
  padding: 18px;
}

.video-modal-frame {
  position: relative;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #0b0b0b;
  border: 2px solid #2d2d2d;
  aspect-ratio: 16 / 9;
}

.video-player {
  width: 100%;
  height: 100%;
  display: block;
}

.video-modal-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid #2d2d2d;
  background: #ffe6e6;
  color: #2d2d2d;
  font-size: 20px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s ease;
  z-index: 10;
}

.video-modal-close:hover {
  transform: scale(1.05);
}

.video-modal-fade-enter-active,
.video-modal-fade-leave-active {
  transition: opacity 0.16s ease;
}

.video-modal-fade-enter-from,
.video-modal-fade-leave-to {
  opacity: 0;
}
</style>
