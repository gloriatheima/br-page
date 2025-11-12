<template>
  <div class="puppetron container py-4 make-browser-talk">
    <h1>Make Your Browser Talk</h1>

    <!-- Friendly status / errors (aria-live) -->
    <div aria-live="polite" v-if="lastError" class="status" style="color:#b00020; margin-bottom:0.6rem;">
      {{ lastError }}
    </div>

    <form id="formtron" @submit.prevent="onSubmit" class="talk-form">
      <div class="mode-row">
        <label><input type="radio" v-model="mode" value="text" /> Text</label>
        <label><input type="radio" v-model="mode" value="selector" /> URL + Selector</label>
      </div>

      <!-- Text mode -->
      <div v-if="mode === 'text'">
        <label class="label">Enter text for the browser to speak</label>
        <textarea
          v-model="text"
          placeholder="Type something for the browser to say..."
          rows="6"
          @input="onTextInput"
        ></textarea>
        <!-- display current length / max -->
        <div style="width:90%; max-width:900px; text-align:left; font-size:12px; color:#666;">
          {{ text.length }} / {{ MAX_CHARS }} chars
        </div>
      </div>

      <!-- Selector mode -->
      <div v-else class="selector-mode">
        <label class="label">Target URL</label>
        <input type="url" v-model="url" placeholder="https://example.com" />
        <label class="label" style="margin-top:0.5rem">CSS selector to extract (single)</label>
        <input type="text" v-model="selector" placeholder="e.g. h1, .article .title" />
        <p class="hint">Worker will call BR scrape with this selector and turn the extracted text into speech.</p>

        <!-- Show extracted text preview (if backend returned it) -->
        <div v-if="extractedText || rawBrJson" class="extracted-preview card card-body" style="margin-top:0.6rem; text-align:left;">
          <strong>Extracted text (preview):</strong>
          <p v-if="extractedText">{{ extractedText }}</p>
          <p v-else style="color:#666;font-style:italic;">(no text extracted)</p>

          <div style="margin-top:0.4rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" @click="useExtractedText" :disabled="!extractedText">Use as text</button>
            <button type="button" @click="showRawBrJson = !showRawBrJson" :disabled="!rawBrJson">
              {{ showRawBrJson ? 'Hide raw BR JSON' : 'Show raw BR JSON' }}
            </button>
            <button type="button" @click="copyRawBrJson" :disabled="!rawBrJson">Copy raw JSON</button>
            <button type="button" @click="downloadRawBrJson" :disabled="!rawBrJson">Download JSON</button>
          </div>

          <div v-if="showRawBrJson" class="raw-json-wrapper" aria-hidden="false">
            <div class="raw-json-toolbar">
              <span class="badge">Raw BR JSON</span>
              <small class="muted"> — debug view (collapsed by default)</small>
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
            aria-label="Generate and play audio"
          >
            {{ isLoading ? 'Generating...' : 'Generate & Play' }}
          </button>

          <button type="button" @click="pauseAudio" :disabled="!isPlaying || isPaused" aria-label="Pause">⏸ Pause</button>
          <button type="button" @click="resumeAudio" :disabled="!isPaused" aria-label="Resume">▶ Resume</button>
          <button type="button" @click="stopAudio" :disabled="!isPlaying && !isPaused" aria-label="Stop">■ Stop</button>

          <button type="button" @click="downloadAudio" :disabled="!audioUrl" aria-label="Download audio">⬇ Download</button>
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

      <!-- Accordion card omitted for brevity - unchanged -->
    </form>

    <footer>
      <p>
        Make your browser talk via server TTS (BR → Workers AI → R2). Theme matches ContentGen.
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
      imageUrl: null,
      imageAlt: 'Browser Rendering integration diagram',
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
/* 省略样式：保持与你现有样式一致（你已有完整样式，可保留） */
</style>