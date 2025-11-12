<template>
  <div class="screenshot-viewer">
    <!-- 输入目标 URL 并触发截图请求 -->
    <div class="controls">
      <label>目标 URL：</label>
      <input v-model="targetUrl" placeholder="http://example.com/page" class="url-input" />
      <button @click="onFetch" :disabled="loading">获取截图</button>
      <button v-if="screenshotSrc" @click="download" :disabled="loading">下载图片</button>
    </div>

    <!-- 状态与错误 -->
    <div v-if="loading" class="status">正在加载…</div>
    <div v-if="error" class="error">错误：{{ error }}</div>

    <!-- 显示截图 -->
    <div v-if="screenshotSrc" class="preview">
      <img :src="screenshotSrc" alt="screenshot" />
    </div>
  </div>
</template>

<script>
export default {
  name: "ScreenshotViewer",
  data() {
    return {
      // 默认可以填你常用的测试地址
      targetUrl: "http://www.gogotrials.site/image/1.jpg",
      loading: false,
      error: null,
      screenshotSrc: null, // object URL
      lastBlob: null
    };
  },
  methods: {
    // 构造完整 API URL（优先使用 VUE_APP_API_BASE）
    buildApiUrl(path) {
      const base = (process.env.VUE_APP_API_BASE || "").replace(/\/+$/, "");
      if (base) {
        // path 应以 / 开头，例如 '/api/screenshot?...'
        return `${base}${path}`;
      }
      // 回退到相对路径（在同域并已由 Worker route 绑定时可用）
      return path;
    },

    // 主流程：fetch -> blob -> createObjectURL -> 展示
    async onFetch() {
      this.error = null;
      this.loading = true;

      // 清理旧的 object URL（如果有）
      if (this.screenshotSrc) {
        URL.revokeObjectURL(this.screenshotSrc);
        this.screenshotSrc = null;
      }
      this.lastBlob = null;

      try {
        if (!this.targetUrl) {
          throw new Error("请先填写目标 URL");
        }

        // 构造请求路径（注意 encodeURIComponent）
        const apiPath = `/api/screenshot?url=${encodeURIComponent(this.targetUrl)}`;
        const url = this.buildApiUrl(apiPath);

        // 发起请求（若需要带 cookie，请添加 credentials:'include'）
        const res = await fetch(url, {
          method: "GET",
          // credentials: 'include' // 若需携带 cookie，取消注释
        });

        if (!res.ok) {
          // 如果返回 HTML（错误页 / challenge），把前几百字符作为调试信息
          const text = await res.text().catch(() => "");
          const preview = text ? text.slice(0, 1000) : "<no body>";
          throw new Error(`HTTP ${res.status} — ${preview}`);
        }

        // 确认 Content-Type 是图片（可选）
        const ct = res.headers.get("Content-Type") || "";
        if (!ct.startsWith("image/")) {
          // 仍然尝试把 body 解析为 text 以便调试
          const txt = await res.text().catch(() => "<binary body>");
          throw new Error(`响应不是图片 (Content-Type=${ct})，前几百字符：${txt.slice(0,400)}`);
        }

        // 得到二进制并创建 Object URL 显示
        const blob = await res.blob();
        this.lastBlob = blob;
        this.screenshotSrc = URL.createObjectURL(blob);
      } catch (e) {
        // 捕获各种异常并展示友好信息
        this.error = (e && e.message) ? e.message : String(e);
        console.error("screenshot fetch error:", e);
      } finally {
        this.loading = false;
      }
    },

    // 下载已获取的图片（利用同一个 blob）
    download() {
      if (!this.lastBlob) return;
      const a = document.createElement("a");
      const url = this.screenshotSrc;
      a.href = url;
      // 生成一个默认文件名，可按需改造
      a.download = "screenshot.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  },
  beforeDestroy() {
    // 组件销毁前释放 object URL，避免内存泄漏
    if (this.screenshotSrc) {
      URL.revokeObjectURL(this.screenshotSrc);
      this.screenshotSrc = null;
    }
    this.lastBlob = null;
  }
};
</script>

<style scoped>
.screenshot-viewer {
  max-width: 900px;
  margin: 18px auto;
  text-align: center;
}
.controls {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
}
.url-input {
  width: 56%;
  padding: 8px;
  border: 1px solid #cfcfcf;
  border-radius: 4px;
}
button {
  padding: 8px 12px;
  border-radius: 4px;
  background: #0d7a7a;
  color: white;
  border: none;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.status {
  margin-bottom: 8px;
  color: #555;
}
.error {
  color: #b00020;
  margin-bottom: 8px;
  white-space: pre-wrap;
  text-align: left;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}
.preview img {
  max-width: 100%;
  height: auto;
  border: 1px solid #eee;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
</style>