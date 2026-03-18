const audioConfig = {
  whiteNoise: {
    src: "./assets/audio/white-noise.mp3",
    loop: true,
    label: "白噪音",
  },
  lightMusic: {
    src: "./assets/audio/light-music.mp3",
    loop: true,
    label: "轻音乐",
  },
  sleep10Min: {
    src: "./assets/audio/sleep-10min.mp3",
    loop: false,
    label: "10分钟助眠",
  },
};

const audioMap = {};
let currentId = null;

function getCard(id) {
  return document.querySelector(`.audio-card[data-id="${id}"]`);
}

function getStatus(id) {
  return document.getElementById(`status-${id}`);
}

function getProgress(id) {
  return document.getElementById(`progress-${id}`);
}

function setStatus(id, text) {
  const el = getStatus(id);
  if (el) el.textContent = text;
}

function setProgress(id, value) {
  const el = getProgress(id);
  const percent = Math.max(0, Math.min(100, value));
  if (el) el.style.width = `${percent}%`;

  const container = el?.parentElement;
  if (container) {
    container.setAttribute("aria-valuenow", String(Math.round(percent)));
  }
}

function clearCardState(id) {
  const card = getCard(id);
  if (!card) return;
  card.classList.remove("active", "is-playing");
}

function setCardPlaying(id, isPlaying) {
  const card = getCard(id);
  if (!card) return;

  card.classList.add("active");
  if (isPlaying) {
    card.classList.add("is-playing");
  } else {
    card.classList.remove("is-playing");
  }
}

function stopAudio(id, resetProgress = false) {
  const audio = audioMap[id];
  if (!audio) return;

  audio.pause();

  if (resetProgress) {
    audio.currentTime = 0;
    setProgress(id, 0);
    setStatus(id, "未播放");
    clearCardState(id);
  } else {
    setStatus(id, "已暂停");
    const card = getCard(id);
    if (card) {
      card.classList.add("active");
      card.classList.remove("is-playing");
    }
  }

  if (currentId === id && resetProgress) {
    currentId = null;
  }
}

function stopAll(resetProgress = true) {
  Object.keys(audioMap).forEach((id) => {
    stopAudio(id, resetProgress);
  });
  if (resetProgress) {
    currentId = null;
  }
}

async function playAudio(id) {
  const audio = audioMap[id];
  if (!audio) return;

  if (currentId && currentId !== id) {
    stopAudio(currentId, true);
  }

  currentId = id;
  setCardPlaying(id, false);
  setStatus(id, "加载中");

  try {
    await audio.play();
    setCardPlaying(id, true);
    setStatus(id, "播放中");
  } catch (error) {
    clearCardState(id);
    setStatus(id, "播放失败");
    currentId = null;
    console.error(`播放失败: ${id}`, error);
  }
}

function toggleAudio(id) {
  const audio = audioMap[id];
  if (!audio) return;

  if (currentId === id) {
    if (audio.paused) {
      playAudio(id);
    } else {
      stopAudio(id, false);
    }
    return;
  }

  playAudio(id);
}

function bindAudioEvents(id, audio) {
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || Number.isNaN(audio.duration)) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    setProgress(id, percent);
  });

  audio.addEventListener("loadedmetadata", () => {
    setProgress(id, 0);
  });

  audio.addEventListener("ended", () => {
    if (audio.loop) return;
    setProgress(id, 0);
    setStatus(id, "播放完成");
    clearCardState(id);
    if (currentId === id) {
      currentId = null;
    }
  });

  audio.addEventListener("waiting", () => {
    if (currentId === id) {
      setStatus(id, "加载中");
    }
  });

  audio.addEventListener("playing", () => {
    if (currentId === id) {
      setStatus(id, "播放中");
      setCardPlaying(id, true);
    }
  });

  audio.addEventListener("pause", () => {
    if (audio.currentTime > 0 && !audio.ended && currentId === id) {
      setStatus(id, "已暂停");
      const card = getCard(id);
      if (card) {
        card.classList.add("active");
        card.classList.remove("is-playing");
      }
    }
  });

  audio.addEventListener("error", () => {
    setStatus(id, "音频异常");
    clearCardState(id);
    setProgress(id, 0);
    if (currentId === id) {
      currentId = null;
    }
  });
}

function initAudios() {
  Object.entries(audioConfig).forEach(([id, config]) => {
    const audio = new Audio(config.src);
    audio.preload = "metadata";
    audio.loop = config.loop;
    audioMap[id] = audio;

    setStatus(id, "未播放");
    setProgress(id, 0);

    bindAudioEvents(id, audio);
  });
}

function bindUIEvents() {
  const toggleButtons = document.querySelectorAll('[data-action="toggle"]');
  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!id) return;
      toggleAudio(id);
    });
  });

  const stopAllBtn = document.getElementById("stopAllBtn");
  if (stopAllBtn) {
    stopAllBtn.addEventListener("click", () => {
      stopAll(true);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAudios();
  bindUIEvents();
});