<template>
  <div class="br-intro container py-4">
    <h2 class="mb-3">BR vs Pages</h2>

    <div id="accordionExample" aria-multiselectable="false">
      <!-- 仅保留：Pages vs Browser Rendering 对比卡 -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingCompare"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseCompare
              variant="link"
              block
              class="text-left"
            >
              Cloudflare Pages（静态/SSR） vs Browser Rendering（DO 动态 “Pages”）
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseCompare"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingCompare"
        >
          <b-card-body>
            <!-- 对比表：每一行表示一个关键维度 -->
            <div class="compare-table mt-3">
              <!-- 表头 -->
              <div class="table-row header-row">
                <div class="col col-feature">维度</div>
                <div class="col col-pages text-center">Cloudflare Pages（静态 / SSR）</div>
                <div class="col col-br text-center">Browser Rendering（DO 动态 "Pages"）</div>
              </div>

              <!-- 数据行 -->
              <div
                v-for="(row, idx) in comparisonRows"
                :key="idx"
                class="table-row"
                :class="{ 'last-row': idx === comparisonRows.length - 1 }"
              >
                <div class="col col-feature">
                  <div class="feature-text">{{ row.dimension }}</div>
                </div>
                <div class="col col-pages text-left">
                  <div class="cell-text" v-html="row.pages"></div>
                </div>
                <div class="col col-br text-left">
                  <div class="cell-text" v-html="row.browser"></div>
                </div>
              </div>
            </div>

            <div class="hint mt-3">
              建议: 先使用 fetch（Pages/SSR），当用户强制需要 JS 执行时才触发 Browser Rendering，这样可以节省成本。
            </div>
          </b-card-body>
        </b-collapse>
      </b-card>
    </div>
  </div>
</template>

<script>
export default {
  name: "BrIntroduction",
  data() {
    return {
      // Pages vs Browser Rendering 对比表的数据（可按需修改）
      comparisonRows: [
        {
          dimension: "目标场景",
          pages:
            "静态站点、或后端 SSR 已输出完整 HTML（例如博客、文档、营销页）",
          browser:
            "SPA 或依赖大量客户端 JS 的页面、需要运行 JS 才能得到最终 DOM 或截图（例如仪表盘、动态渲染的电商页）",
        },
        {
          dimension: "渲染模型",
          pages:
            "直接返回静态 HTML 或客户端渲染无需在服务器端执行页面 JS",
          browser:
            "在 headless 浏览器中执行页面 JS（Puppeteer / Playwright），获取渲染后的 DOM 与截图",
        },
        {
          dimension: "运行环境",
          pages:
            "Cloudflare Pages / Workers（边缘） — 无需维持长期进程",
          browser:
            "Durable Object (作为浏览器管理器) + PuppeteerWorkers（或 CF 的 puppeteer 集成）",
        },
        {
          dimension: "有无状态",
          pages:
            "无状态或短期 request-scoped（可用 Workers KV / R2 做持久化）",
          browser:
            "有状态（DO 可持久化 task queue、缓存、管理浏览器生命周期）",
        },
        {
          dimension: "延迟与启动时间",
          pages: "响应快，CDN 缓存命中时几乎无延迟",
          browser:
            "相对较高：包含浏览器启动、newPage、等待网络空闲等步骤（秒级）",
        },
        {
          dimension: "资源消耗",
          pages: "低：仅负责传输与少量边缘计算",
          browser: "高：浏览器占用内存/CPU，尤其是并发时",
        },
        {
          dimension: "可扩展性",
          pages:
            "自动水平扩展，适合高并发请求（由 Pages/Workers/CDN 处理）",
          browser:
            "需限流与队列（DO 可管理并发），水平扩展更复杂且需控制成本",
        },
        {
          dimension: "缓存策略",
          pages:
            "构建时或边缘可长期缓存（TTL），非常节省成本和带宽",
          browser:
            "把渲染结果缓存到 R2 或 Workers Cache，并设置合理 TTL，避免重复渲染",
        },
        {
          dimension: "安全性",
          pages: "常规边缘安全（WAF、CDN）即可",
          browser:
            "需限制内网访问、在 page 上拦截并阻止不必要的第三方资源",
        },
        {
          dimension: "推荐使用场景",
          pages:
            "博客、文档、静态产品页、SEO 友好的页面优先使用 Pages/SSR",
          browser:
            "需要执行页面 JS 才能获取内容、截图、PDF、复杂自动化流程时使用 Browser Rendering",
        },
      ],
    };
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

/* 仅保留用于对比表的样式，保持与页面其它部分一致的配色与排版 */

/* Root */
.br-intro,
.br-intro * {
  font-family: 'Signika', sans-serif;
  color: #00667A;
  text-align: left;
}

/* 标题 */
.br-intro h2 {
  font-size: 36px;
  margin: 0 0 0.75rem;
  color: #0b5960;
  font-weight: 700;
  text-shadow: 0 1px 10px rgba(96,232,238,0.12);
}

/* Card body */
.br-intro .b-card-body {
  background: #eafdfd;
  border-radius: 6px;
  padding: 0.8rem;
  color: #063a3b;
  box-shadow: 0 1px 8px rgba(6,75,82,0.06);
}

/* Compare table */
.compare-table {
  width: 100%;
  overflow-x: auto;
  margin-top: 0.6rem;
}
.table-row {
  display: flex;
  align-items: center;
  padding: 12px 12px;
  border-bottom: 1px solid rgba(6,75,82,0.06);
  background: linear-gradient(180deg,#ffffff,#fbffff);
}
.header-row {
  font-weight: 700;
  color: #063a3b;
}
.col {
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 15px;
  color: #063a3b;
}
.col-feature { flex: 1 1 30%; text-align: left; font-weight:700; }
.col-pages, .col-br { flex: 1 1 35%; text-align: left; }

/* 文本样式 */
.feature-text {
  line-height: 1.4;
  color: #063a3b;
}
.cell-text {
  color: #063a3b;
}

/* Hint */
.hint {
  color: #375b58;
  font-size: 14px;
  margin-top: 12px;
}

/* 响应式调整 */
@media (max-width: 767.98px) {
  .table-row { flex-direction: column; align-items: stretch; padding: 10px 6px; }
  .col-feature, .col-pages, .col-br { flex: none; width: 100%; padding: 8px 6px; }
  .col-feature, .col-pages { border-bottom: 1px solid rgba(6,75,82,0.06); }
}
</style>