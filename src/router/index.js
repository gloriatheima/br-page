import Vue from 'vue'
import Router from 'vue-router'

// 页面组件（确保这些文件存在）
import BrGuides from '@/components/BrGuides.vue'
import MakeBrowserTalk from '@/components/MakeBrowserTalk.vue'
import ContentGen from '@/components/ContentGen.vue'
import BrWithAI from '@/components/BrWithAI.vue'
// import RestAPIExample from '@/components/RestAPIExample.vue'
// import SeoAnalytic from '@/components/SeoAnalytic.vue'
import BrIntroduction from '@/components/BrIntroduction.vue'

Vue.use(Router)

/*
  以下为新增部分（放在 router 文件中是为了尽量不改动其它文件）
  作用：
  - 提供前端统一的 API 调用封装，自动在路径前加 /api 前缀
  - 暴露给组件使用的三个便利方法：
      this.$apiFetch(path, init)       -> 原生 fetch，返回 Response
      this.$apiGetJson(path, headers)  -> GET 并返回解析后的 JSON（失败时抛出 Response）
      this.$apiPostJson(path, body)    -> POST JSON 并返回解析后的 JSON（失败时抛出 Response）
  使用说明（在组件内）：
    // GET 并解析 JSON
    try {
      const data = await this.$apiGetJson('/scrape?url=...');
    } catch (res) {
      // 处理非 2xx 返回，res 是 Response（可读取 status/text/json）
    }

    // POST JSON
    try {
      const data = await this.$apiPostJson('/some-endpoint', { foo: 'bar' });
    } catch (res) {
      // 错误处理
    }

  设计原则：
  - 不改动现有 router 的路由定义（你的 hash 路由保持不变）
  - 只提供调用封装，便于在整站迁移到 /api 前缀时统一处理
  - 若你想要把现有 fetch(...) 直接替换成 this.$apiFetch(...)，可以在各组件中逐步替换
*/
function buildApiPath(path) {
  if (!path) return '/api/';
  // 保证以斜杠开始
  const p = path.startsWith('/') ? path : `/${path}`;
  // 如果已经包含 /api 前缀则直接返回
  if (p.startsWith('/api/')) return p;
  if (p === '/api') return '/api/';
  return `/api${p}`;
}

// attach helpers to Vue prototype so all组件可用（不删除注释，增加注释说明）
Vue.prototype.$apiFetch = function (path, init = {}) {
  const p = buildApiPath(path);
  // 默认不携带 credentials；如果需要 cookie，请在 init 中设置 credentials:'include'
  return fetch(p, init);
};

Vue.prototype.$apiGet = function (path, headers = {}) {
  return this.$apiFetch(path, { method: 'GET', headers });
};

Vue.prototype.$apiGetJson = async function (path, headers = {}) {
  const res = await this.$apiGet(path, headers);
  if (!res.ok) {
    // 抛出 Response，调用方可读取状态与 body
    throw res;
  }
  return res.json();
};

Vue.prototype.$apiPostJson = async function (path, body, headers = {}) {
  const merged = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
  const res = await this.$apiFetch(path, {
    method: 'POST',
    headers: merged,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw res;
  }
  return res.json();
};

// 你也可以按需添加 PUT/DELETE helper

const routes = [
  { path: '/', redirect: '/br-guides' },
  { path: '/br-introduction', name: 'BrIntroduction', component: BrIntroduction },
  { path: '/br-guides', name: 'BrGuides', component: BrGuides },
  { path: '/make-browser-talk', name: 'MakeBrowserTalk', component: MakeBrowserTalk },
  { path: '/content-generation', name: 'ContentGen', component: ContentGen },
  { path: '/br-withai', name: 'BrWithAI', component: BrWithAI },
  // { path: '/rest-apiexample', name: 'RestAPIExample', component: RestAPIExample },
  // { path: '/seo-analytic', name: 'SeoAnalytic', component: SeoAnalytic },

  // fallback
  { path: '*', redirect: '/' }
]

export default new Router({
  mode: 'hash', // 开发用 hash 模式最方便；若想用 history 请改为 'history' 并配置后端回退
  routes
})