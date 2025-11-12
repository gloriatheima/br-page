import Vue from 'vue'
import App from './App.vue'
import BrHeader from './components/BrHeader.vue'
import router from './router' // 确保 router 在使用前被导入

// Bootstrap + BootstrapVue CSS
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

// 引入并注册插件
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'
Vue.use(BootstrapVue)
Vue.use(IconsPlugin)

Vue.config.productionTip = false

Vue.component("BrHeader", BrHeader)

// --- 调试补丁：确保 router 已导入后再挂载 instrumentation ---
// 仅在调试环境启用；发现问题后请移除或用环境变量控制
if (process.env.NODE_ENV !== 'production') {
    try {
        // 1) 追踪 router.push / router.replace（若 router 已存在）
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

        // 2) 追踪 history API 的调用（pushState / replaceState）
        if (typeof history !== 'undefined') {
            const origPushState = history.pushState;
            history.pushState = function (state, title, url) {
                console.group('[history.trace] pushState');
                console.log('url:', url, 'state:', state);
                console.trace();
                console.groupEnd();
                return origPushState.apply(this, arguments);
            };
            const origReplaceState = history.replaceState;
            history.replaceState = function (state, title, url) {
                console.group('[history.trace] replaceState');
                console.log('url:', url, 'state:', state);
                console.trace();
                console.groupEnd();
                return origReplaceState.apply(this, arguments);
            };
        }

        // 3) 监听 hashchange（location.hash 变化）
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('hashchange', (ev) => {
                console.group('[hash.trace] hashchange');
                console.log('oldURL:', ev.oldURL, 'newURL:', ev.newURL);
                console.trace();
                console.groupEnd();
            }, true);
        }

        // 4) 监控 window.location.assign/replace（有些环境可能不允许覆盖，会被 try/catch 捕获）
        try {
            if (typeof window !== 'undefined' && window.location) {
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
            }
        } catch (e) {
            // 浏览器可能不允许覆盖 location 的方法，忽略
            // console.warn('Could not instrument window.location methods', e);
        }

        // 5) 记录点击的 <a>（可以发现是否有 <a href="/"> 之类的触发完整导航）
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('click', (e) => {
                const a = e.target && e.target.closest ? e.target.closest('a') : null;
                if (a) {
                    console.group('[click.trace] anchor click');
                    console.log('hrefAttr:', a.getAttribute('href'), 'href:', a.href, 'target:', a.target);
                    console.trace();
                    console.groupEnd();
                }
            }, true);
        }
    } catch (e) {
        console.warn('debug instrumentation init failed', e);
    }
}
// --- 调试补丁结束 ---

new Vue({
    router, // 注入 router
    render: h => h(App),
}).$mount('#app')