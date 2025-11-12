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

    <!-- 简单的错误 / 状态显示（保持原有 UX） -->
    <div v-if="statusMessage" class="status-message">{{ statusMessage }}</div>

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
/*
  修改要点（已在代码中实现）：
  - 使用智能 buildApiUrl 拼接 VUE_APP_API_BASE 与请求路径（自动去重 /api，支持 env 带或不带 /api）
  - 强制前端请求使用 /api/<action>?... （worker 通常期待 /api 前缀）
  - 在发起请求前打印 endpoint（便于 debug）
  - 对不同 Content-Type 做更智能的处理：image/pdf -> blob -> open/download；json -> 智能解析（links/json/data URI）；html/text -> 新窗口展示
  - 保留并尽量不修改你原有的注释与逻辑
*/

export default {
  name: 'ContentGenPuppetron',

  data() {
    return {
      url: '',
      action: 'content',
      protocol: 'http://',
      currentObjectUrl: null,
      statusMessage: '',

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
      selectors: ''
    };
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
      更健壮的 buildApiUrl：
      - 处理 baseEnv 带或不带 /api 的情况，避免出现 /api/api/...
      - 确保最终以 base + path 的形式返回（path 以 / 开头）
      - 若 baseEnv 为空，返回相对 path（用于同域且由 Worker Route 绑定的情况）
    */
    buildApiUrl(path) {
      const baseEnv = (process.env.VUE_APP_API_BASE || '').trim();
      const base = baseEnv.replace(/\/+$/, '');
      let p = path || '';
      if (!p.startsWith('/')) p = '/' + p;

      if (!base) return p;

      // 如果 base 以 '/api' 结尾并且 path 也以 '/api' 开头，移除 path 的 '/api' 前缀
      if (base.toLowerCase().endsWith('/api') && p.toLowerCase().startsWith('/api')) {
        p = p.replace(/^\/api/i, '');
      }
      return base + p;
    },

    // 把 data URI (data:...;base64,...) 转成 Blob
    dataUriToBlob(dataUri) {
      const m = dataUri.match(/^data:([^;]+);base64,(.*)$/s);
      if (!m) return null;
      const mime = m[1];
      const b64 = m[2];
      const bin = atob(b64);
      const len = bin.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: mime });
    },

    // 将 blob 处理为 objectURL 并预览 / 下载
    applyPreviewFromBlob(blob, kind) {
      // Revoke previous object URL if present
      if (this.currentObjectUrl) {
        try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
        this.currentObjectUrl = null;
      }

      const objectUrl = URL.createObjectURL(blob);
      this.currentObjectUrl = objectUrl;

      // Use 'kind' to decide how to present the blob
      if (kind === 'image' || kind === 'pdf') {
        // For images and PDFs, open in a new tab for quick preview
        window.open(objectUrl, '_blank');
        return;
      }

      // For binary or unknown types, trigger download with suggested filename
      const ext = kind === 'pdf' ? 'pdf' : (kind === 'image' ? 'png' : 'bin');
      const filename = this.suggestFilename(ext);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    // 在新窗口展示 HTML 内容（安全性：仅用于调试/preview，不做消毒）
    showHtmlPreview(html) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      } else {
        alert('Preview blocked by browser. You can configure to allow popups for preview.');
      }
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
    },

    /*
      Main submit handler
      - 构造 /api/<action>?... 路径（Worker 通常期望 /api 前缀）
      - 使用 buildApiUrl 智能拼接（支持 VUE_APP_API_BASE 带或不带 /api）
      - 对不同返回类型进行智能处理
    */
    async onSubmit() {
      this.statusMessage = '';
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
      }

      // Important: include /api prefix in path (worker expects /api/*)
      const endpointPath = `/api/${this.action}?${params.toString()}`;
      const endpoint = this.buildApiUrl(endpointPath);

      // debug: print actual endpoint that will be fetched
      // 这行在调试时很有帮助：确认前端到底请求哪个域名/路径
      console.log('[ContentGen] FETCH endpoint:', endpoint);

      // clear previous object URL if any
      if (this.currentObjectUrl) {
        try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
        this.currentObjectUrl = null;
      }

      try {
        this.statusMessage = '请求中…';
        // 若需要携带 cookie/session，请把下面的 credentials:'include' 取消注释
        const resp = await fetch(endpoint, { method: 'GET' /* , credentials: 'include' */ });

        if (!resp.ok) {
          // 尝试读取文本用于调试
          const txt = await resp.text().catch(() => '');
          // 如果是 404 且返回 JSON {"error":"not_found"}, 很可能是 worker 路由或 action 名称不匹配
          console.error('[ContentGen] fetch error response:', resp.status, txt);
          throw new Error(`Server returned ${resp.status}: ${txt}`);
        }

        const ct = (resp.headers.get('content-type') || '').toLowerCase();

        // 支持多种 action 返回类型：图片/PDF/HTML/JSON/二进制
        if (ct.includes('image/')) {
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'image');
          this.statusMessage = '';
        } else if (ct.includes('application/pdf')) {
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'pdf');
          this.statusMessage = '';
        } else if (ct.includes('application/json')) {
          // JSON 可能是结构化结果（例如 json/action 或 ai result）
          const text = await resp.text();
          try {
            const parsed = JSON.parse(text);

            // 如果是 links action，优先处理为可点击链接列表
            if (this.action === 'links') {
              // 支持直接返回数组或 { links: [...] }
              let links = null;
              if (Array.isArray(parsed)) links = parsed;
              else if (parsed && Array.isArray(parsed.links)) links = parsed.links;

              if (links) {
                // 生成简单 HTML 列表在新窗口展示
                const html = `<h3>Links (${links.length})</h3><ul>${links.map(l => `<li><a href="${this.escapeAttr(l)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(l)}</a></li>`).join('')}</ul>`;
                this.showHtmlPreview(html);
                this.statusMessage = '';
                return;
              }
            }

            // 如果 JSON 中包含 data: URI（如图片），解析并展示
            if (parsed && typeof parsed.result === 'string' && parsed.result.startsWith('data:')) {
              const blob = this.dataUriToBlob(parsed.result);
              if (blob) {
                const kind = (blob.type || '').startsWith('image/') ? 'image' : 'binary';
                this.applyPreviewFromBlob(blob, kind);
                this.statusMessage = '';
                return;
              }
            }

            // 默认：把 JSON 格式化后在新窗口显示
            this.showHtmlPreview(`<pre>${this.escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`);
            this.statusMessage = '';
          } catch (e) {
            // 非标准 JSON，直接展示文本
            this.showHtmlPreview(`<pre>${this.escapeHtml(text)}</pre>`);
            this.statusMessage = '';
          }
        } else if (ct.includes('text/html')) {
          const text = await resp.text();
          // content / snapshot 通常返回 HTML，直接展示
          this.showHtmlPreview(text);
          this.statusMessage = '';
        } else if (ct.includes('text/markdown') || this.action === 'markdown') {
          // markdown: treat as plain text if server returns markdown or if action is markdown
          const text = await resp.text();
          // 简易渲染：显示原始 markdown（你可替换成 marked + DOMPurify 更安全）
          this.showHtmlPreview(`<pre>${this.escapeHtml(text)}</pre>`);
          this.statusMessage = '';
        } else if (ct.includes('text/plain')) {
          const text = await resp.text();
          this.showHtmlPreview(`<pre>${this.escapeHtml(text)}</pre>`);
          this.statusMessage = '';
        } else {
          // fallback: treat as binary
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'binary');
          this.statusMessage = '';
        }
      } catch (err) {
        console.error('[ContentGen] Request failed:', err);
        this.statusMessage = '';
        // 为了兼容你之前的 UX，仍保留 alert 提示
        alert('Request failed: ' + (err.message || err));
      }
    },

    // 简单的 attribute escape（用于插入 href）
    escapeAttr(s) {
      return String(s).replace(/"/g, '&quot;');
    }
  },

  beforeDestroy() {
    if (this.currentObjectUrl) {
      try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
    }
  },
  beforeUnmount() {
    if (this.currentObjectUrl) {
      try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
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

/* status message */
.status-message {
  margin: 12px auto;
  color: #333;
  max-width: 900px;
  text-align: center;
}

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

/* Footer */
footer {
  font-size: 16px;
  margin-top: 1.5rem;
}
</style>