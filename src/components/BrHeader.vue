<template>
  <header class="d-flex flex-wrap align-items-center justify-content-between py-3 mb-4 border-bottom">
    <!-- 使用 router-link 替代 <a href="/">，避免完整页面导航回根 -->
    <router-link to="/br-guides" class="d-flex align-items-center text-dark text-decoration-none">
      <!-- 如果原来有 logo/img，请把 img 标签放回这里 -->
      <svg width="40" height="32" class="me-2" viewBox="0 0 118 94" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="logo">
        <title>logo</title>
        <rect width="100%" height="100%" fill="#495057" rx="8"></rect>
      </svg>
      <span class="fs-5">browser-rendering</span>
    </router-link>

    <nav class="d-inline-flex mt-2 mt-md-0 ms-md-auto">
      <a class="me-3 py-2 text-dark text-decoration-none" href="https://developers.cloudflare.com/browser-rendering/" target="_blank" rel="noopener">View more on Developer Docs</a>
      <!-- 若有其它内部链接，务必用 router-link -->
      <!-- 例如： <router-link to="/br-introduction" class="me-3 py-2 text-dark text-decoration-none">Introduction</router-link> -->
    </nav>
  </header>
</template>

<script>
export default {
  name: 'BrHeader'
  // 若你有 props 或 methods 保留原实现，这里只是最小示例
}
</script>

<style scoped>
/* 保留或调整原有样式 */
</style>