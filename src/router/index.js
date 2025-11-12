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
  说明：
  - 保留原有路由定义（hash 模式），不要改成 history 除非你把服务器端回退配置好。
  - 为了排查“总是跳回根”的问题，添加了全局 beforeEach 日志（开发期间可保留，生产可移除）。
  - 把 fallback 从自动 redirect 改为显示一个简单的 NotFound 组件，避免出现“未命中 -> 立刻重定向到 /”的循环/突兀跳转体验。
*/

// 简单的 NotFound 组件（内联定义，免去另建文件）
const NotFound = {
  name: 'NotFound',
  template: '<div style="padding:40px;text-align:center;"><h2>页面未找到</h2><p>请检查链接或返回 <router-link to=\"/br-guides\">首页</router-link></p></div>'
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

// 全局导航守卫：开发时输出路由变更，帮助定位为什么会被 fallback 命中
router.beforeEach((to, from, next) => {
  // 在控制台查看路由匹配情况
  // 生产环境可以移除或把 console.log 替换为更轻量的埋点
  console.log('[router] navigating from', from.fullPath, 'to', to.fullPath, 'name:', to.name, 'matched:', to.matched.length)
  next()
})

export default router