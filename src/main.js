import Vue from 'vue'
import App from './App.vue'
import BrHeader from './components/BrHeader.vue'
import router from './router'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'

import { apiFetch, apiGetJson, apiPostJson } from '@/api' // 新增：通用 API helper

Vue.use(BootstrapVue)
Vue.use(IconsPlugin)

Vue.config.productionTip = false

Vue.component('BrHeader', BrHeader)

// 全局注入（可选，保留兼容旧代码）
Vue.prototype.$apiFetch = apiFetch
Vue.prototype.$apiGetJson = apiGetJson
Vue.prototype.$apiPostJson = apiPostJson

new Vue({
    router,
    render: h => h(App),
}).$mount('#app')