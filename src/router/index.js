import Vue from 'vue'
import Router from 'vue-router'

// 页面组件（确保这些文件存在）
import BrGuides from '@/components/BrGuides.vue'
import MakeBrowserTalk from '@/components/MakeBrowserTalk.vue'
import ContentGen from '@/components/ContentGen.vue'
import BrWithAI from '@/components/BrWithAI.vue'
import BrIntroduction from '@/components/BrIntroduction.vue'

Vue.use(Router)

// 简单的 NotFound 组件（避免通配符直接 redirect 回根）
const NotFound = {
  name: 'NotFound',
  template: `
    <div style="padding:40px;text-align:center;">
      <h2>页面未找到 (404)</h2>
      <p>请检查链接或返回 <router-link to="/br-guides">首页</router-link></p>
    </div>`
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

  // fallback: 显示 404，而不是自动重定向到根（更利于调试）
  { path: '*', component: NotFound }
]

const router = new Router({
  mode: 'hash',
  routes
})

/*
  新增说明（中文）：
  - 本文件保留了原有注释与路由配置（未更改你已有的注释）。
  - 为了便于开发时定位“意外跳回根”的问题，在开发环境下添加了轻量的导航日志（router.beforeEach）。
    这些日志只会在 NODE_ENV !== 'production' 时输出，不会改变路由行为，也不会阻止导航。
  - 调试建议：
    1) 优先使用 <router-link> 做内部导航，避免使用 <a href="/"> 之类会触发页面完整刷新（那会绕过 Vue Router��。
    2) 若发现页面“自动”跳回根，打开 DevTools 的 Console，查看由下面的 beforeEach 打印的导航序列与堆栈（会有 console.trace）。
    3) 如果你在组件中发现对 router.push 或 window.location 的调用，请在调用处加上条件检查，避免无条件重定向。
  - 如果你希望我把日志改为发送到远端监控或在特定路由触发时收集更多上下文，我可以进一步改造。
*/

if (process.env.NODE_ENV !== 'production') {
  router.beforeEach((to, from, next) => {
    // 仅打印，不改变导航；帮助开发时观察导航序列
    console.log('[router.debug] from:', from.fullPath, '=> to:', to.fullPath, 'name:', to.name, 'matched:', to.matched.length)
    // 当发生从非首页到首页的导航时，打印堆栈，便于追踪触发点（仅在开发时）
    if (to.path === '/' && from.path && from.path !== '/' && from.path !== '/br-guides') {
      console.group('[router.debug.trace] unexpected navigation to root detected')
      console.trace()
      console.groupEnd()
    }
    next()
  })
}

export default router