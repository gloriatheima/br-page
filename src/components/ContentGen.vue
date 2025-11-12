<template>
  <div class="puppetron container py-4">
    <h1>BR REST API</h1>

    <form ref="formtron" id="formtron" @submit.prevent="onSubmit">
      <input
        type="url"
        name="url"
        v-model="url"
        required
        placeholder="Enter a URL"
        @paste="onPaste"
        @focus="onFocus"
        @blur="onBlur"
      />
      <br />

      <!-- Buttons for all supported backend actions -->
      <div class="actions-grid">
        <button
          v-for="act in actions"
          :key="act"
          type="submit"
          :name="act"
          @click="setAction(act)"
          :class="{ active: action === act }"
        >
          {{ labelFor(act) }}
        </button>
      </div>

      <!-- Scrape selectors textarea (only visible when scrape is selected) -->
      <div v-if="action === 'scrape'" class="scrape-controls">
        <label for="selectors"><strong>Scrape 标签选择器 (每行一个)</strong></label>
        <textarea
          id="selectors"
          v-model="selectors"
          placeholder="输入 CSS 选择器, 每行一个. 如:h1 ｜ a ｜ div | .article | .title 等"
          rows="6"
        ></textarea>
        <p class="hint">如果留空，则只会使用 URL 调用抓取程序.</p>
      </div>
    </form>

    <!-- ===== 新增预览面板：根据 action 智能显示结果 ===== -->
    <div class="preview-panel" v-if="previewVisible">
      <div class="preview-toolbar">
        <strong>Preview:</strong>
        <span class="preview-kind"> {{ previewKindLabel }} </span>
        <button v-if="previewUrl" @click="openPreviewNewTab">Open in new tab</button>
        <button v-if="previewBlob" @click="downloadPreview">Download</button>
        <button @click="clearPreview">Clear</button>
      </div>

      <!-- image preview -->
      <div v-if="previewKind === 'image'" class="preview-content">
        <img :src="previewUrl" alt="preview image" />
      </div>

      <!-- pdf preview -->
      <div v-if="previewKind === 'pdf'" class="preview-content">
        <iframe :src="previewUrl" frameborder="0" style="width:100%;height:80vh;"></iframe>
      </div>

      <!-- html preview: render as-is -->
      <div v-if="previewKind === 'html'" class="preview-content html-preview" v-html="previewHtml"></div>

      <!-- json preview: pretty print -->
      <div v-if="previewKind === 'json'" class="preview-content">
        <pre>{{ prettyJson }}</pre>
      </div>

      <!-- links preview: list of anchors -->
      <div v-if="previewKind === 'links'" class="preview-content">
        <ul>
          <li v-for="(lnk, idx) in previewLinks" :key="idx">
            <a :href="lnk" target="_blank" rel="noopener noreferrer">{{ lnk }}</a>
          </li>
        </ul>
      </div>

      <!-- markdown preview: simple render -->
      <div v-if="previewKind === 'markdown'" class="preview-content markdown-preview" v-html="renderedMarkdown"></div>

      <!-- fallback binary message -->
      <div v-if="previewKind === 'binary'" class="preview-content">
        <p>Binary content ready. 请点击 Download 保存或 Open in new tab 预览（浏览器支持时）。</p>
      </div>
    </div>

    <footer>
      <p>
        REST API 为常见的浏览器操作提供端点，例如屏幕截图、提取 HTML 内容、生成 PDF 等。以下是可用选项：<br>
        <ul>
          <li>/content - Fetch HTML</li>
          <li>/screenshot - Capture screenshot</li>
          <li>/pdf - Render PDF</li>
          <li>/snapshot - Take a webpage snapshot</li>
          <li>/scrape - Scrape HTML elements</li>
          <li>/json - Capture structured data using AI</li>
          <li>/links - Retrieve links from a webpage</li>
          <li>/markdown - Extract Markdown from a webpage</li>
        </ul>
      </p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'ContentGenPuppetron',

  data() {
    return {
      url: '',
      action: 'content',
      protocol: 'http://',
      currentObjectUrl: null,

      // list of supported backend routes to display as buttons
      actions: [
        'content',
        'snapshot',
        'screenshot',
        'pdf',
        'scrape',
        'json',
        'links',
        'markdown'
      ],

      // selectors textarea model for scrape
      selectors: '',

      // ===== preview state =====
      previewKind: null, // 'image' | 'pdf' | 'html' | 'json' | 'links' | 'markdown' | 'binary'
      previewUrl: null, // object URL for blob-based previews
      previewBlob: null, // actual Blob (for download)
      previewHtml: '', // HTML string for html preview
      previewJson: null, // object for json preview
      previewLinks: null, // array of link strings
      previewMarkdown: '', // raw markdown text
    };
  },
  computed: {
    previewVisible() {
      return !!this.previewKind;
    },
    previewKindLabel() {
      return this.previewKind ? this.previewKind.toUpperCase() : '';
    },
    prettyJson() {
      try {
        return JSON.stringify(this.previewJson, null, 2);
      } catch {
        return String(this.previewJson);
      }
    },
    renderedMarkdown() {
      // 超轻量级 Markdown -> HTML 转换（仅做常见语法处理：标题、粗体、斜体、链接和换行）
      // 注意：这是个简单实现，不具备安全过滤。若要在生产环境中渲染 Markdown，请引入经过审计的库（如 marked + DOMPurify）。
      const md = this.previewMarkdown || '';
      let out = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // headings: ### -> h3, ## -> h2, # -> h1
      out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      out = out.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      out = out.replace(/^# (.*$)/gim, '<h1>$1</h1>');

      // bold **text**
      out = out.replace(/\*\*(.+?)\*\*/gim, '<strong>$1</strong>');
      // italic *text*
      out = out.replace(/\*(.+?)\*/gim, '<em>$1</em>');
      // links [text](url)
      out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      // line breaks -> paragraphs
      out = out.split(/\n\s*\n/).map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('\n');
      return out;
    }
  },
  methods: {
    encode(u) {
      return encodeURIComponent(u);
    },

    setAction(act) {
      // ensure we only set allowed actions used by backend
      if (this.actions.includes(act)) {
        this.action = act;
      } else {
        this.action = 'content';
      }
    },

    labelFor(act) {
      // Human-friendly labels (you can customize)
      const map = {
        content: 'Content',
        snapshot: 'Snapshot',
        screenshot: 'Screenshot',
        pdf: 'PDF',
        scrape: 'Scrape',
        json: 'JSON',
        links: 'Links',
        markdown: 'Markdown'
      };
      return map[act] || act;
    },

    /*
      新增方法：buildApiUrl
      - 优先使用 process.env.VUE_APP_API_BASE（由 Cloudflare Pages 控制台或 .env 注入）
      - 如果没有配置 VUE_APP_API_BASE，则回退到相对路径（/api/…），用于在同域并由 Worker 绑定到 /api/* 的场景
      - 该改动不会影响你现有的注释与逻辑，仅在构建请求 URL 时使用
    */
    buildApiUrl(path) {
      const base = (process.env.VUE_APP_API_BASE || '').replace(/\/+$/, '');
      if (base) {
        return `${base}${path}`;
      }
      // 回退到相对 /api 路径（如果 Worker 绑定到 same-domain 上）
      return path;
    },

    async onSubmit() {
      if (!this.url || !(this.url.startsWith('http://') || this.url.startsWith('https://'))) {
        alert('Please enter a valid URL including http:// or https://');
        return;
      }

      const params = new URLSearchParams({ url: this.url });

      // include viewport params only for endpoints that normally use them
      if (this.action === 'screenshot' || this.action === 'snapshot') {
        params.set('width', String(window.innerWidth));
        params.set('height', String(window.innerHeight));
      }

      // scrape: if selectors provided, encode as elements JSON array per Cloudflare example
      if (this.action === 'scrape') {
        const lines = (this.selectors || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (lines.length) {
          const elements = lines.map(s => ({ selector: s }));
          // JSON.stringify will be percent-encoded by URLSearchParams when setting as value
          params.set('elements', JSON.stringify(elements));
        }
        // If selectors empty, we still include url param (server-side will accept url-only fallback)
      }

      // 构造请求路径并优先使用 buildApiUrl（支持跨域 worker 域或回退到相对 /api 路径）
      const endpointPath = `/${this.action}?${params.toString()}`;
      const endpoint = this.buildApiUrl(endpointPath);

      // 每次请求前清理旧的 preview（避免混淆）
      this.clearPreview();

      try {
        // 若需要携带 cookie/session，请把下面的 credentials:'include' 取消注释
        const resp = await fetch(endpoint, { method: 'GET' /* , credentials: 'include' */ });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Server returned ${resp.status}: ${txt}`);
        }

        const ct = (resp.headers.get('content-type') || '').toLowerCase();

        // 支持多种 action 返回类型：图片/PDF/HTML/JSON/二进制
        if (ct.includes('image/')) {
          const blob = await resp.blob();
          this.setBlobPreview(blob, 'image');
        } else if (ct.includes('application/pdf')) {
          const blob = await resp.blob();
          this.setBlobPreview(blob, 'pdf');
        } else if (ct.includes('application/json')) {
          const text = await resp.text();
          let parsed = null;
          try { parsed = JSON.parse(text); } catch (e) { parsed = text; }

          // 特殊处理：若 action 是 links，期望返回数组或 { links: [...] }
          if (this.action === 'links') {
            if (Array.isArray(parsed)) {
              this.previewKind = 'links';
              this.previewLinks = parsed;
              return;
            }
            if (parsed && Array.isArray(parsed.links)) {
              this.previewKind = 'links';
              this.previewLinks = parsed.links;
              return;
            }
          }

          // 如果 action 是 json，或者默认展示 JSON
          this.previewKind = 'json';
          this.previewJson = parsed;
        } else if (ct.includes('text/html')) {
          const text = await resp.text();
          // content / snapshot 通常返回 HTML，直接展示
          this.previewKind = 'html';
          this.previewHtml = text;
        } else if (ct.includes('text/markdown') || this.action === 'markdown') {
          // markdown: treat as plain text if server returns markdown or if action is markdown
          const text = await resp.text();
          this.previewKind = 'markdown';
          this.previewMarkdown = text;
        } else if (ct.includes('text/plain')) {
          const text = await resp.text();
          // for some actions (json endpoint that returns plain text) show as pre
          this.previewKind = 'html';
          this.previewHtml = `<pre>${this.escapeHtml(text)}</pre>`;
        } else {
          // 其他未知类型：当作二进制处理并提供下载预览
          const blob = await resp.blob();
          this.setBlobPreview(blob, 'binary');
        }
      } catch (err) {
        console.error(err);
        alert('Request failed: ' + (err.message || err));
      }
    },

    // 将二进制 blob 设置为 preview（并创建 objectURL）
    setBlobPreview(blob, kind) {
      // 释放旧的 object URL
      if (this.previewUrl) {
        try { URL.revokeObjectURL(this.previewUrl); } catch (e) { /* noop */ }
      }
      const objectUrl = URL.createObjectURL(blob);
      this.previewKind = kind;
      this.previewUrl = objectUrl;
      this.previewBlob = blob;
    },

    // 清空 preview 状态
    clearPreview() {
      if (this.previewUrl) {
        try { URL.revokeObjectURL(this.previewUrl); } catch (e) { /* noop */ }
      }
      this.previewKind = null;
      this.previewUrl = null;
      this.previewBlob = null;
      this.previewHtml = '';
      this.previewJson = null;
      this.previewLinks = null;
      this.previewMarkdown = '';
    },

    openPreviewNewTab() {
      if (!this.previewUrl) return;
      window.open(this.previewUrl, '_blank');
    },

    downloadPreview() {
      if (!this.previewBlob) return;
      const a = document.createElement('a');
      a.href = this.previewUrl;
      // 根据类型建议扩展名
      const ext = this.previewKind === 'pdf' ? 'pdf' : (this.previewKind === 'image' ? 'png' : 'bin');
      a.download = this.suggestFilename(ext);
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    applyPreviewFromBlob(blob, kind) {
      // backward compatibility: keep but route to setBlobPreview
      this.setBlobPreview(blob, kind);
      // By default open in new tab for quick UX if desired:
      // window.open(this.previewUrl, '_blank');
    },

    showHtmlPreview(html) {
      this.previewKind = 'html';
      this.previewHtml = html;
    },

    onPaste(e) {
      const text = e.clipboardData.getData('text') || '';
      if (text.startsWith('http://') || text.startsWith('https://')) {
        e.preventDefault();
        this.url = text;
      }
    },

    onFocus() {
      if (this.url.trim() === '') {
        this.url = this.protocol;
      }
    },

    onBlur() {
      if (this.url.trim() === this.protocol) {
        this.url = '';
      }
    },

    suggestFilename(ext) {
      try {
        const u = new URL(this.url);
        const re = new RegExp('[\\\\/\\?=&:\\s]+', 'g');
        const sanitize = (s) => s.replace(re, '_').replace(/^_+|_+$/g, '');
        const hostPart = sanitize(u.hostname || 'site');
        const pathPart = sanitize(u.pathname || '');
        const name = pathPart ? `${hostPart}_${pathPart}` : hostPart;
        return `capture_${name}.${ext}`;
      } catch {
        return `capture.${ext}`;
      }
    },

    escapeHtml(s) {
      return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  },

  beforeDestroy() {
    if (this.previewUrl) {
      try { URL.revokeObjectURL(this.previewUrl); } catch (e) { /* noop */ }
    }
  },
  beforeUnmount() {
    if (this.previewUrl) {
      try { URL.revokeObjectURL(this.previewUrl); } catch (e) { /* noop */ }
    }
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
  font-size: 60px;
  text-shadow: 0 1px 20px #60E8EE;
  margin: 0 0 0.25em;
}

/* URL input */
input[type='url'] {
  display: inline-block;
  width: 90%;
  max-width: 600px;
  padding: 0.45em;
  margin: 0.5em;
  border: 0;
  background-color: #D7FCFD;
}
input[type='url']:focus {
  outline: 3px solid #00667A;
}

/* Actions grid */
.actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}
.actions-grid button {
  border-radius: 0;
  border: 0;
  padding: 0.8em 1.5em;
  min-width: 160px;
  color: rgba(255, 255, 255, 0.95);
  background-color: #0e6069;
  box-shadow: 0 1px 10px #60E8EE;
  cursor: pointer;
  font-size: 18px;
}
.actions-grid button.active {
  outline: 3px solid #60E8EE;
  box-shadow: 0 1px 25px #60E8EE;
}
.actions-grid button:hover {
  transform: translateY(-2px);
}

/* Scrape controls */
.scrape-controls {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scrape-controls textarea {
  width: 90%;
  max-width: 800px;
  min-height: 96px;
  padding: 0.6rem;
  font-size: 14px;
}
.scrape-controls .hint {
  font-size: 12px;
  color: #666;
  margin-top: 0.5rem;
}

/* Preview panel 样式 */
.preview-panel {
  margin: 1.25rem auto;
  max-width: 1100px;
  text-align: left;
  border: 1px solid #e6f7f7;
  padding: 12px;
  background: #fbffff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
}
.preview-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.preview-toolbar button {
  padding: 6px 8px;
  border-radius: 4px;
  border: none;
  background: #0e6069;
  color: #fff;
  cursor: pointer;
}
.preview-content {
  padding: 8px 0;
}
.preview-content img {
  max-width: 100%;
  display: block;
  margin: 0 auto;
}
.html-preview {
  max-height: 70vh;
  overflow: auto;
  border-top: 1px dashed #e0f5f5;
  padding-top: 8px;
}
.markdown-preview p { margin: 0.6rem 0; }

/* ====== 新增：让页面内的列表左对齐，同时保留列表块居中（首选） ====== */
/* 使 .puppetron 下的 ul/ol 项目内部左对齐，但把整个列表块居中显示 */
.puppetron ul,
.puppetron ol {
  text-align: left;           /* 列表项内部左对齐 */
  display: inline-block;      /* 让整个列表块可以被居中（由于容器是 centered） */
  margin: 0.5rem auto;        /* 列表块垂直间距并水平居中 */
  padding-left: 1.35rem;      /* 为 bullets/markers 留出左侧间距 */
  list-style-position: outside;
  max-width: 900px;           /* 可选：限制列表宽度，视页面布局调整 */
}

/* 确保每个 li 内容左对齐 */
.puppetron ul li,
.puppetron ol li {
  text-align: left;
}

/* 如果列表在 <p> 内，给出合理的间距 */
.puppetron p ul,
.puppetron p ol {
  margin-top: 0.5rem;
}

/* Footer */
footer {
  font-size: 16px;
  margin-top: 1.5rem;
}
</style>