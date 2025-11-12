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

// 简单的 NotFound 组件（内联定义，免去另建文件）
const NotFound = {
  name: 'NotFound',
  template: '<div style="padding:40px;text-align:center;"><h2>页面未找到</h2><p>请检查链接或返回 <router-link to="/br-guides">首页</router-link></p></div>'
}

const routes = [
  { path: '/', redirect: '/br-guides' },
  { path: '/br-introduction', name: 'BrIntroduction', component: BrIntroduction },
  { path: '/br-guides', name: 'BrGuides', component: BrGuides },
  { path: '/make-browser-talk', name: 'MakeBrowserTalk', component: MakeBrowserTalk },
  { path: '/content-generation', name: 'ContentGen', component: ContentGen },
  { path: '/br-withai', name: 'BrWithAI', component: BrWithAI },
  // { path: '/rest-apiexample', name: 'RestAPIExample', component: RestAPIExample },
  // { path: '/seo-analytic', name: 'SeoAnalytic', component: SeoAnalytic },

  // fallback: 显示一个友好的 404 页面，而不是自动重定向到根
  { path: '*', component: NotFound }
]

const router = new Router({
  mode: 'hash', // 开发用 hash 模式最方便；若想用 history 请改为 'history' 并配置后端回退
  routes
})

// ==================================================
// 额外保护与调试机制 —— 防止“外部/普通链接导致完整导航回根”的情况
// 目标：
//  - 拦截页面内普通 <a href="/..."> 点击并用 router.push 处理（hash 模式下转为内部导航）
//  - 拦截 <form action="/..."> 提交，阻止默认并改用 AJAX 或 router 导航（若为 GET）
//  - 在运行时尝试拦截 window.location.assign/replace（若同源且为内部 path，改为 router 导航）
//  - 记录用户交互（userInteracted）并阻止短时间内的“自动跳回 root”以便定位问题
// 注意：这些都是尽量无侵入的措施，帮助在不改大量组件代码的情况下阻止页面被外部导航覆盖。
// 请在问题定位后逐项回退这些调试/保护代码（尤其是在生产环境）。
// ==================================================

// 简易用户交互标识（若在短时间内有用户点击，则视为用户主动导航）
let userInteracted = false;
function markUserInteracted() {
  userInteracted = true;
  // 1s 内认为是用户触发
  setTimeout(() => { userInteracted = false; }, 1000);
}

// 全局捕获点击，拦截普通 a[href="/..."] 链接（仅在 SPA 域内同源链接）
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a') : null;
  if (!a) return;
  const hrefAttr = a.getAttribute('href');
  const target = a.getAttribute('target');
  // 忽略带 target 或 download 的链接或空 href
  if (!hrefAttr || hrefAttr.startsWith('#') || target === '_blank' || a.hasAttribute('download')) return;
  // 绝对 URL：如果是同源并以 / 开头，内部导航；否则放行（外部链接照常）
  try {
    const url = new URL(hrefAttr, window.location.href);
    if (url.origin === window.location.origin) {
      // 拦截以根路径开始的内部导航并使用 router（避免完整页面刷新）
      if (url.pathname.startsWith('/')) {
        e.preventDefault();
        markUserInteracted();
        // 因为 router 使用 hash 模式，router.push('/content-generation') 会生成 #/content-generation
        router.push(url.pathname + url.search).catch(() => { });
      }
    }
  } catch (err) {
    // 无法解析 URL，放行
  }
}, true);

// 拦截表单提交（简单处理：若 action 为内部路径，阻止默认并使用 fetch）
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!form || !form.action) return;
  try {
    const url = new URL(form.action, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
      // 防止默认的页面刷新导航
      e.preventDefault();
      markUserInteracted();
      // 简单处理：若 method=GET，使用 router 导航到带查询字符串的 hash 路径
      const method = (form.method || 'GET').toUpperCase();
      if (method === 'GET') {
        router.push(url.pathname + url.search).catch(() => { });
      } else {
        // 若为 POST/PUT 等，建议组件内使用 AJAX 提交；这里做保底：尝试用 fetch 发送表单数据
        const formData = new FormData(form);
        fetch(url.toString(), { method, body: formData })
          .then(resp => {
            // 简单处理：若返回 JSON 并含有 redirect 字段，则跳转；否则不自动导航
            return resp.json().catch(() => null);
          })
          .then(json => {
            if (json && json.redirect) {
              router.push(json.redirect).catch(() => { });
            }
          })
          .catch(() => { });
      }
    }
  } catch (err) {
    // ignore
  }
}, true);

// 尝试包裹 window.location.assign / replace（若可覆盖且为同源内部 path，则用 router 导航）
try {
  const origAssign = window.location.assign.bind(window.location);
  window.location.assign = function (url) {
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/')) {
        // 内部导航，使用 router（避免完整 reload）
        markUserInteracted();
        return router.push(parsed.pathname + parsed.search).catch(() => { });
      }
    } catch (e) {
      // ignore and fallback
    }
    return origAssign(url);
  };
  const origReplaceLoc = window.location.replace.bind(window.location);
  window.location.replace = function (url) {
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/')) {
        markUserInteracted();
        return router.replace(parsed.pathname + parsed.search).catch(() => { });
      }
    } catch (e) {
      // ignore and fallback
    }
    return origReplaceLoc(url);
  };
} catch (e) {
  // 某些浏览器/环境不允许覆盖 location 方法，非致命
  // console.warn('Could not override location.assign/replace', e);
}

// 路由时间与防止短时间“自动回根”策略（仅作调试保护）
// 如果在短时间内（500ms）从一个内部 route 跳到另一个，然后出现没有用户交互的跳回到 /br-guides（root），拦截它。
let lastNavigationTs = 0;
router.beforeEach((to, from, next) => {
  const now = Date.now();
  // 输出路由变更用于调试
  console.log('[router] navigating from', from.fullPath, 'to', to.fullPath, 'name:', to.name, 'matched:', to.matched.length);

  // If the app just navigated and now there is a navigation back to `/br-guides` without user interaction,
  // block it temporarily (debugging aid).
  if (to.path === '/br-guides' && from.path !== '/br-guides') {
    const delta = now - lastNavigationTs;
    if (delta < 800 && !userInteracted) {
      console.warn('[router.debug] Blocked automatic redirect to /br-guides (delta:', delta, 'ms). Investigate sources (forms, anchors, window.location).');
      // Cancel this navigation (keep current route)
      return next(false);
    }
  }

  lastNavigationTs = now;
  next();
});

export default router