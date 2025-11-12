<template>
  <div class="puppetron container py-4 make-browser-talk">
    <h1>Make Your Browser Talk</h1>

    <!-- Friendly status / errors (aria-live) -->
    <div aria-live="polite" v-if="lastError" class="status-message error">
      {{ lastError }}
    </div>

    <form id="formtron" @submit.prevent="onSubmit" class="talk-form">
      <div class="mode-row">
        <label class="mode-label"><input type="radio" v-model="mode" value="text" /> Text</label>
        <label class="mode-label"><input type="radio" v-model="mode" value="selector" /> URL + Selector</label>
      </div>

      <!-- Text mode -->
      <div v-if="mode === 'text'" class="card card-body">
        <label class="label">Enter text for the browser to speak</label>
        <textarea
          v-model="text"
          placeholder="Type something for the browser to say..."
          rows="6"
          @input="onTextInput"
          class="text-input"
        ></textarea>
        <div class="hint muted">{{ text.length }} / {{ MAX_CHARS }} chars</div>
      </div>

      <!-- Selector mode -->
      <div v-else class="card card-body selector-mode">
        <label class="label">Target URL</label>
        <input type="url" v-model="url" placeholder="https://example.com" class="text-input" />
        <label class="label" style="margin-top:0.5rem">CSS selector to extract (single)</label>
        <input type="text" v-model="selector" placeholder="e.g. h1, .article .title" class="text-input" />
        <p class="hint">Worker will call BR scrape with this selector and turn the extracted text into speech.</p>

        <div v-if="extractedText || rawBrJson" class="extracted-preview card card-body preview-box">
          <strong>Extracted text (preview):</strong>
          <p v-if="extractedText" class="extracted-text">{{ extractedText }}</p>
          <p v-else class="muted">(no text extracted)</p>

          <div class="preview-actions">
            <button type="button" @click="useExtractedText" :disabled="!extractedText" class="btn small">Use as text</button>
            <button type="button" @click="showRawBrJson = !showRawBrJson" :disabled="!rawBrJson" class="btn small muted-btn">
              {{ showRawBrJson ? 'Hide raw BR JSON' : 'Show raw BR JSON' }}
            </button>
            <button type="button" @click="copyRawBrJson" :disabled="!rawBrJson" class="btn small">Copy raw JSON</button>
            <button type="button" @click="downloadRawBrJson" :disabled="!rawBrJson" class="btn small">Download JSON</button>
          </div>

          <div v-if="showRawBrJson" class="raw-json-wrapper">
            <div class="raw-json-toolbar">
              <span class="badge">Raw BR JSON</span>
              <small class="muted"> — debug view</small>
            </div>
            <pre class="raw-json-pre" v-text="rawBrJsonPreview"></pre>
          </div>
        </div>
      </div>

      <div class="controls-row">
        <div class="action-buttons">
          <button
            type="button"
            @click="requestTts"
            :disabled="!canRequest || isLoading"
            class="btn primary"
            aria-label="Generate and play audio"
          >
            {{ isLoading ? 'Generating...' : 'Generate & Play' }}
          </button>

          <button type="button" @click="pauseAudio" :disabled="!isPlaying || isPaused" class="btn">⏸ Pause</button>
          <button type="button" @click="resumeAudio" :disabled="!isPaused" class="btn">▶ Resume</button>
          <button type="button" @click="stopAudio" :disabled="!isPlaying && !isPaused" class="btn">■ Stop</button>

          <button type="button" @click="downloadAudio" :disabled="!audioUrl" class="btn">⬇ Download</button>
        </div>
      </div>

      <div class="visual-row">
        <div class="visualizer" :class="{ playing: isPlaying || isLoading }" aria-hidden="true">
          <div v-for="n in 12" :key="n" class="bar" :style="barStyle(n)"></div>
        </div>

        <div class="spoken-preview" v-if="mode === 'text' && words.length">
          <span v-for="(w, idx) in words" :key="idx" :class="{ highlight: idx === currentWordIndex }">
            {{ w }}
          </span>
        </div>
      </div>

      <!-- START: Collapsible card for logic diagram -->
      <div id="accordionExample" aria-multiselectable="false" style="width:90%; max-width:900px; margin-top:1rem;">
        <b-card no-body class="mb-2">
          <b-card-header
            header-tag="header"
            class="p-0"
            role="tab"
            id="headingDiagram"
          >
            <h2 class="mb-0">
              <b-button
                v-b-toggle.collapseDiagram
                variant="link"
                block
                class="text-left"
              >
                MakeBrowserTalk 实现逻辑图
              </b-button>
            </h2>
          </b-card-header>

          <b-collapse
            id="collapseDiagram"
            accordion="accordionExample"
            class="border-top"
            role="tabpanel"
            aria-labelledby="headingDiagram"
            v-model="collapseDiagramOpen"
          >
            <b-card-body>
              <!-- 简短说明 -->
              <p class="muted" style="margin-bottom:0.5rem">
                Pages/UI 输入 → Worker (BR/TTS) → R2 存储 → UI 播放
              </p>

              <!-- 在这里插入图片：图片使用 data 中的 diagramUrl（懒加载） -->
              <div class="diagram-wrapper mt-3" v-if="collapseDiagramOpen">
                <div v-if="diagramUrl">
                  <img
                    :src="diagramUrl"
                    :alt="imageAlt"
                    class="img-fluid diagram-img"
                  />
                </div>
                <div v-else class="muted" style="font-size:13px; color:#567;">Loading diagram...</div>
              </div>
            </b-card-body>
          </b-collapse>
        </b-card>
      </div>
      <!-- END: Collapsible card for logic diagram -->

    </form>

    <footer>
      <p>
        Make your browser talk via Models (TTS)
      </p>
    </footer>
  </div>
</template>

<script>
export default {
  name: "MakeBrowserTalk",

  data() {
    return {
      mode: "text",
      text: "",
      url: "",
      selector: "",
      isLoading: false,
      isPlaying: false,
      isPaused: false,
      audioKey: null,
      audioUrl: null,
      audioEl: null,
      words: [],
      currentWordIndex: -1,
      highlightTimer: null,
      seed: Math.random(),
      extractedText: null,
      lastError: null,
      ttsAbortController: null,
      rawBrJson: null,
      showRawBrJson: false,
      // image/diagram related
      diagramUrl: null,
      imageAlt: 'MakeBrowserTalk 流程图',
      collapseDiagramOpen: false,
      // existing collapse toggle kept for other UI (if needed)
      collapseThreeOpen: false,
    };
  },

  computed: {
    canRequest() {
      if (this.mode === "text") {
        return this.text.trim().length > 0;
      }
      return this.mode === "selector" && this.url.trim().length > 0 && this.selector.trim().length > 0;
    },

    rawBrJsonPreview() {
      if (!this.rawBrJson) return "";
      if (typeof this.rawBrJson === "string") {
        try {
          const parsed = JSON.parse(this.rawBrJson);
          return JSON.stringify(parsed, null, 2);
        } catch (e) {
          return this.rawBrJson;
        }
      } else {
        try {
          return JSON.stringify(this.rawBrJson, null, 2);
        } catch (e) {
          return String(this.rawBrJson);
        }
      }
    }
  },

  // keep parity with backend
  MAX_CHARS: 8000,

  mounted() {
    this.audioEl = document.createElement("audio");
    this.audioEl.preload = "auto";
    try { this.audioEl.crossOrigin = "anonymous"; } catch (e) { console.debug('crossOrigin not supported:', e); }
    this.audioEl.onended = this.onAudioEnded;
    this.audioEl.onpause = () => { this.isPaused = true; };
    this.audioEl.onplay = () => { this.isPaused = false; };
    this.audioEl.onloadedmetadata = this.onAudioMetadata;
    this.audioEl.style.display = "none";
    try { document.body.appendChild(this.audioEl); } catch (e) { console.debug('append audioEl failed:', e); }
    this.onTextInput();
  },

  beforeUnmount() {
    this.cleanupAudio();
  },

  watch: {
    // lazy-load diagram image only when user opens the collapse
    collapseDiagramOpen(newVal) {
      if (newVal && !this.diagramUrl) {
        try {
          // require the diagram asset lazily to avoid bundling cost on initial load.
          // replace the path with your actual asset path; fallback to null on failure.
          this.diagramUrl = require('@/assets/talk-worker.drawio.png');
        } catch (e) {
          console.debug('lazy load diagram failed', e);
          this.diagramUrl = null;
        }
      }
    },

    // keep existing watcher in case you use other collapses
    collapseThreeOpen(newVal) {
      if (newVal && !this.imageUrl) {
        try {
          this.imageUrl = require('@/assets/brTalkFlow.drawio.png');
        } catch (e) {
          console.debug('lazy load image failed', e);
          this.imageUrl = null;
        }
      }
    }
  },

  methods: {
    onTextInput() {
      this.words = this.text.trim().length ? this.text.split(/\s+/) : [];
      this.currentWordIndex = -1;
    },

    // Robust URL builder: use VUE_APP_API_BASE (no trailing /api) and avoid duplicate /api prefix
    buildApiUrl(path) {
      const baseEnv = (process.env.VUE_APP_API_BASE || '').trim();
      const base = baseEnv.replace(/\/+$/, '');
      let p = path || '';
      if (!p.startsWith('/')) p = '/' + p;
      if (!base) return p;
      if (base.toLowerCase().endsWith('/api') && p.toLowerCase().startsWith('/api')) {
        p = p.replace(/^\/api/i, '');
      }
      return base + p;
    },

    // main entry: request TTS (POST to /api/talk)
    async requestTts() {
      if (!this.canRequest || this.isLoading) return;
      this.isLoading = true;
      this.lastError = null;
      this.stopAudio();

      try { if (this.ttsAbortController) this.ttsAbortController.abort(); } catch (e) { /* noop */ }
      this.ttsAbortController = new AbortController();

      const payload = {};
      if (this.mode === "text") payload.text = this.text;
      else { payload.url = this.url; payload.selector = this.selector; }
      payload.format = "mp3";

      // IMPORTANT: call the worker's /api/talk endpoint (worker expects /api/* in this deploy)
      const endpoint = this.buildApiUrl('/api/talk');
      console.log('[MakeBrowserTalk] POST endpoint:', endpoint);

      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: this.ttsAbortController.signal,
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`Server ${resp.status}: ${txt}`);
        }

        const j = await resp.json();
        if (!j.key) throw new Error("No key returned from server");
        this.audioKey = j.key;

        if (j.extractedText) {
          this.rawBrJson = j.extractedText;
          const cleaned = this.tryParseAndExtract(j.extractedText);
          this.extractedText = cleaned || (typeof j.extractedText === 'string' ? j.extractedText : JSON.stringify(j.extractedText));
        } else {
          this.extractedText = null;
          this.rawBrJson = null;
        }

        await this.playKey(j.key);
      } catch (err) {
        console.error("TTS request failed", err);
        this.lastError = "TTS request failed: " + (err.message || err);
        alert(this.lastError);
      } finally {
        this.isLoading = false;
        this.ttsAbortController = null;
      }
    },

    tryParseAndExtract(raw) {
      try {
        if (!raw) return "";
        let parsed = raw;
        if (typeof raw === "string") {
          try { parsed = JSON.parse(raw); } catch (e) {
            const s = raw.trim();
            if (s.startsWith("{") || s.startsWith("[")) return raw;
            return this.stripHtml(s);
          }
        }
        if (!parsed) return "";
        if (Array.isArray(parsed.result) && parsed.result.length) {
          for (const item of parsed.result) {
            if (Array.isArray(item.results) && item.results.length) {
              const first = item.results[0];
              if (first) {
                if (first.text && String(first.text).trim()) return String(first.text).trim();
                if (first.html && String(first.html).trim()) return this.stripHtml(String(first.html));
              }
            }
            if (item.text && String(item.text).trim()) return String(item.text).trim();
            if (item.html && String(item.html).trim()) return this.stripHtml(String(item.html));
          }
        }
        if (typeof parsed.result === "object" && parsed.result !== null) {
          if (parsed.result.text && String(parsed.result.text).trim()) return String(parsed.result.text).trim();
          if (parsed.result.html && String(parsed.result.html).trim()) return this.stripHtml(String(parsed.result.html));
          if (Array.isArray(parsed.result.results) && parsed.result.results.length) {
            const r0 = parsed.result.results[0];
            if (r0) {
              if (r0.text && String(r0.text).trim()) return String(r0.text).trim();
              if (r0.html && String(r0.html).trim()) return this.stripHtml(String(r0.html));
            }
          }
        }
        if (typeof parsed.result === "string") {
          const s = parsed.result.trim();
          return this.stripHtml(s);
        }
        if (parsed.text && String(parsed.text).trim()) return String(parsed.text).trim();
        if (parsed.html && String(parsed.html).trim()) return this.stripHtml(String(parsed.html));
        if (parsed.content && String(parsed.content).trim()) return this.stripHtml(String(parsed.content));
        try { return JSON.stringify(parsed); } catch (e) { return String(parsed); }
      } catch (e) {
        console.debug("tryParseAndExtract failed:", e);
        return "";
      }
    },

    stripHtml(html) {
      if (!html) return "";
      return String(html)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<\/?[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    },

    // play audio by R2 key - fetch blob -> createObjectURL
    async playKey(key) {
      // IMPORTANT: audio endpoint uses /api/audio/:key
      const audioEndpoint = this.buildApiUrl(`/api/audio/${encodeURIComponent(key)}`);
      console.log('[MakeBrowserTalk] GET audio endpoint:', audioEndpoint);

      try {
        if (this.audioUrl && this.audioUrl.startsWith("blob:")) {
          try { URL.revokeObjectURL(this.audioUrl); } catch (e) { /* noop */ }
        }

        const resp = await fetch(audioEndpoint);
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`Audio fetch failed ${resp.status}: ${txt}`);
        }
        const blob = await resp.blob();
        this.audioUrl = URL.createObjectURL(blob);
        this.audioEl.src = this.audioUrl;
        await this.audioEl.play();
        this.isPlaying = true;
        this.isPaused = false;
        if (this.mode === "text") {
          this.words = this.text.trim().length ? this.text.split(/\s+/) : [];
          this.currentWordIndex = -1;
        } else {
          this.words = [];
          this.currentWordIndex = -1;
        }
      } catch (err) {
        console.error("play failed", err);
        this.lastError = "Audio play failed: " + (err.message || err);
        alert("Audio play failed: " + (err.message || err));
        this.isPlaying = false;
        this.isPaused = false;
      }
    },

    onAudioMetadata() {
      if (!this.audioEl || !this.audioEl.duration || this.mode !== "text" || this.words.length === 0) return;
      this.clearHighlightTimer();
      const totalMs = Math.max(1000, Math.floor(this.audioEl.duration * 1000));
      const stepMs = Math.max(120, Math.floor(totalMs / this.words.length));
      this.highlightTimer = setInterval(() => {
        if (!this.isPlaying || this.isPaused) return;
        if (this.currentWordIndex < this.words.length - 1) {
          this.currentWordIndex++;
        }
      }, stepMs);
    },

    pauseAudio() { try { this.audioEl.pause(); this.isPaused = true; } catch (e) { console.debug(e); } },
    resumeAudio() { try { this.audioEl.play(); this.isPaused = false; } catch (e) { console.debug(e); } },
    stopAudio() { try { this.audioEl.pause(); this.audioEl.currentTime = 0; } catch (e) { console.debug(e); } this.isPlaying = false; this.isPaused = false; this.clearHighlightTimer(); this.currentWordIndex = -1; },
    onAudioEnded() { this.isPlaying = false; this.isPaused = false; this.clearHighlightTimer(); this.currentWordIndex = -1; },
    clearHighlightTimer() { if (this.highlightTimer) { clearInterval(this.highlightTimer); this.highlightTimer = null; } },

    cleanupAudio() {
      if (this.audioEl) {
        this.audioEl.onended = null;
        this.audioEl.onpause = null;
        this.audioEl.onplay = null;
        this.audioEl.onloadedmetadata = null;
        try { this.audioEl.pause(); } catch (err) { console.debug(err); }
        try { if (this.audioEl.parentNode) this.audioEl.parentNode.removeChild(this.audioEl); } catch (e) { /* noop */ }
        this.audioEl = null;
      }
      if (this.audioUrl && this.audioUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(this.audioUrl); } catch (e) { /* noop */ }
      }
      this.audioUrl = null;
      this.clearHighlightTimer();
    },

    downloadAudio() {
      if (!this.audioUrl) return;
      try {
        const a = document.createElement('a');
        a.href = this.audioUrl;
        a.download = `${this.audioKey || 'audio'}.mp3`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error("download failed", e);
        alert("Download failed: " + (e.message || e));
      }
    },

    useExtractedText() {
      if (!this.extractedText) return;
      const playNow = confirm("Insert extracted text into the textarea and play the generated audio now?");
      this.mode = "text";
      this.text = this.extractedText;
      this.onTextInput();
      if (playNow) {
        if (this.audioKey) { this.playKey(this.audioKey).catch(e => console.debug(e)); }
        else { this.requestTts(); }
      }
    },

    async copyRawBrJson() {
      if (!this.rawBrJson) return;
      try {
        const textToCopy = (typeof this.rawBrJson === 'string') ? this.rawBrJson : JSON.stringify(this.rawBrJson);
        await navigator.clipboard.writeText(textToCopy);
        alert('Raw BR JSON copied to clipboard');
      } catch (e) {
        console.error('copyRawBrJson failed', e);
        alert('Copy failed: ' + (e.message || e));
      }
    },

    downloadRawBrJson() {
      if (!this.rawBrJson) return;
      try {
        const textToSave = (typeof this.rawBrJson === 'string') ? this.rawBrJson : JSON.stringify(this.rawBrJson, null, 2);
        const blob = new Blob([textToSave], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raw-br-${this.audioKey || 'extracted'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 5000);
      } catch (e) { console.error('downloadRawBrJson failed', e); alert('Download failed: ' + (e.message || e)); }
    },

    barStyle(n) {
      const base = 6 + ((n + Math.floor(this.seed * 10)) % 8) * 2;
      return { height: base + "px" };
    },

    onSubmit() { this.requestTts(); }
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

.puppetron {
  margin: auto;
  width: 100%;
  padding: 0 0.5em;
  text-align: center;
}
.puppetron,
.puppetron * {
  font-family: 'Signika', sans-serif;
  font-weight: 400;
  color: #00667A;
  text-align: center;
}
h1 {
  font-weight: 700;
  font-size: 48px;
  text-shadow: 0 1px 12px #60E8EE;
  margin: 0 0 0.5rem;
}

/* card */
.card {
  background: #fbffff;
  border: 1px solid #e6f7f7;
  padding: 12px;
  margin: 0.8rem auto;
  max-width: 900px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
  text-align: left;
  border-radius: 6px;
}

/* inputs */
.text-input, textarea {
  width: 100%;
  padding: 0.6rem;
  border: 0;
  background: #D7FCFD;
  font-size: 16px;
  color: #063a3b;
  box-shadow: 0 1px 10px rgba(96,232,238,0.06);
  border-radius: 4px;
  box-sizing: border-box;
}

/* mode row */
.mode-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 0.6rem;
}
.mode-label {
  font-weight: 600;
  color: #064b52;
}

/* controls */
.controls-row {
  display: flex;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  margin-top: 0.6rem;
}
.action-buttons {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
}
.btn {
  background: #0e6069;
  color: #fff;
  border: none;
  padding: 0.6rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  min-width: 120px;
  box-shadow: 0 1px 10px #60E8EE;
}
.btn.small { min-width: 110px; padding: 0.45rem 0.7rem; font-size: 14px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.primary { background: #0b5960; }

/* muted button style (secondary) */
.muted-btn {
  background: #e6fbfb;
  color: #064b52;
  box-shadow: none;
}

/* visualizer */
.visual-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
  width: 90%;
  max-width: 900px;
}
.visualizer {
  display: flex;
  gap: 4px;
  align-items: end;
  height: 48px;
  margin-bottom: 0.6rem;
  transition: opacity 0.2s ease;
  opacity: 0.25;
}
.visualizer.playing { opacity: 1; }
.visualizer .bar {
  width: 6px;
  background: linear-gradient(180deg, #60E8EE, #0b5960);
  border-radius: 2px;
  transform-origin: bottom center;
  animation-name: pulse;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  animation-duration: 700ms;
}
@keyframes pulse {
  0% { transform: scaleY(0.2); opacity: 0.6; }
  50% { transform: scaleY(1.4); opacity: 1; }
  100% { transform: scaleY(0.2); opacity: 0.6; }
}

/* spoken preview */
.spoken-preview {
  width: 100%;
  max-width: 900px;
  padding: 0.6rem;
  background: rgba(6, 75, 82, 0.04);
  color: #063a3b;
  border-radius: 6px;
  text-align: left;
  font-size: 16px;
  line-height: 1.5;
  margin-top: 0.6rem;
  overflow-wrap: break-word;
}
.spoken-preview span.highlight {
  background: linear-gradient(90deg, rgba(96,232,238,0.25), rgba(6,75,82,0.08));
  box-shadow: 0 1px 6px rgba(96,232,238,0.08);
  border-radius: 3px;
  padding: 0.05rem 0.18rem;
}

/* preview box for selector mode */
.preview-box { margin-top: 0.6rem; }
.preview-actions { margin-top: 0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap; }

/* raw JSON viewer */
.raw-json-wrapper {
  margin-top: 0.6rem;
  border-radius: 6px;
  background: linear-gradient(180deg, #fafefd, #f0fcfc);
  padding: 0.4rem;
  box-shadow: 0 1px 6px rgba(6,75,82,0.04);
}
.raw-json-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
  font-size: 13px;
  color: #013033;
  background: #f6f9f9;
  border: 1px solid rgba(6,75,82,0.06);
  border-radius: 6px;
  padding: 0.6rem;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.badge {
  background: #e6fbfb;
  color: #0b5960;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 12px;
}

/* diagram styles (new) */
.diagram-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 0.6rem;
}
.diagram-img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(6,75,82,0.06);
  border: 1px solid rgba(6,75,82,0.04);
}

/* status / errors */
.status-message { margin: 12px auto; max-width: 900px; text-align: center; }
.status-message.error { color: #b00020; }

/* card text and hints */
.label { font-weight: 600; margin-bottom: 0.4rem; color:#064b52; display:block; }
.hint { font-size: 12px; color: #666; margin-top: 0.3rem; }

/* responsive */
@media (max-width: 720px) {
  .action-buttons { flex-direction: column; align-items: stretch; }
  .btn { min-width: auto; width: 100%; }
  .raw-json-pre { font-size: 12px; }
  .diagram-img { max-width: 100%; height: auto; }
}
</style>