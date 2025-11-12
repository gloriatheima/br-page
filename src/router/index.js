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

// 开发时轻量日志（不改变导航，仅便于观察）
if (process.env.NODE_ENV !== 'production') {
  router.beforeEach((to, from, next) => {
    // 仅记录，发生问题时方便定位，不要在这里做跳转/阻断
    console.log('[router] navigating from', from.fullPath, 'to', to.fullPath, 'name:', to.name, 'matched:', to.matched.length)
    next()
  })
}

export default router