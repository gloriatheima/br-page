import Vue from 'vue'
import Router from 'vue-router'

import BrGuides from '@/components/BrGuides.vue'
import MakeBrowserTalk from '@/components/MakeBrowserTalk.vue'
import ContentGen from '@/components/ContentGen.vue'
import BrWithAI from '@/components/BrWithAI.vue'
import BrIntroduction from '@/components/BrIntroduction.vue'

Vue.use(Router)

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
  { path: '*', component: NotFound }
]

export default new Router({
  mode: 'hash',
  routes
})