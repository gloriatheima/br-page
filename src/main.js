import Vue from 'vue'
import App from './App.vue'
import BrHeader from './components/BrHeader.vue'
import router from './router' // 新增：引入 router
// 在 main.js 中 router 创建后加入（临时）
document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a) {
        console.log('[link click] hrefAttr=', a.getAttribute('href'), 'href=', a.href, 'target=', a.target);
    }
});

// Bootstrap + BootstrapVue CSS
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

// 引入并注册插件
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'
Vue.use(BootstrapVue)
Vue.use(IconsPlugin)

Vue.config.productionTip = false

Vue.component("BrHeader", BrHeader)

new Vue({
    router, // 注入 router
    render: h => h(App),
}).$mount('#app')
