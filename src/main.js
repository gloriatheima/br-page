import Vue from 'vue'
import App from './App.vue'
import BrHeader from './components/BrHeader.vue'
import router from './router' // 新增：引入 router

// Bootstrap + BootstrapVue CSS
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

// 引入并注册插件
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'
Vue.use(BootstrapVue)
Vue.use(IconsPlugin)

Vue.config.productionTip = false

Vue.component("BrHeader", BrHeader)

// --- 临时调试补丁：追踪谁触发完整导航或路由 push/replace ---
// 把这段放在 import router 后、new Vue(...) 之前；仅在调试时启用
if (process.env.NODE_ENV !== 'production') {
    try {
        // 追踪 router.push / router.replace 被谁调用
        if (typeof router !== 'undefined' && router) {
            const origPush = router.push.bind(router);
            router.push = function (location, onComplete, onAbort) {
                console.group('[router.trace] push called');
                console.log('location:', location);
                console.trace();
                console.groupEnd();
                return origPush(location, onComplete, onAbort);
            };
            const origReplace = router.replace.bind(router);
            router.replace = function (location, onComplete, onAbort) {
                console.group('[router.trace] replace called');
                console.log('location:', location);
                console.trace();
                console.groupEnd();
                return origReplace(location, onComplete, onAbort);
            };
        }
    } catch (e) {
        console.warn('router trace init failed', e);
    }

    // 追踪 window.location.assign/replace（完整导航）
    try {
        const origAssign = window.location.assign.bind(window.location);
        window.location.assign = function (url) {
            console.group('[location.trace] assign called');
            console.log('url:', url);
            console.trace();
            console.groupEnd();
            return origAssign(url);
        };
        const origReplaceLoc = window.location.replace.bind(window.location);
        window.location.replace = function (url) {
            console.group('[location.trace] replace called');
            console.log('url:', url);
            console.trace();
            console.groupEnd();
            return origReplaceLoc(url);
        };
    } catch (e) {
        // 有些环境不允许覆盖，非致命
    }

    // 全局点击记录（检测是否是 <a href="/..."> 导致的完整导航）
    document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a) {
            console.log('[click.trace] anchor click:', { hrefAttr: a.getAttribute('href'), href: a.href, target: a.target });
        }
    }, true);
}
// --- 调试补丁结束 ---

new Vue({
    router, // 注入 router
    render: h => h(App),
}).$mount('#app')