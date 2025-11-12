// --- 强化调试补丁：捕获 history/hash/route 改变与点击；打印堆栈 ---
// 仅在调试时启用，定位后请移除
if (process.env.NODE_ENV !== 'production') {
    try {
        // 1) 捕获 router.push / replace（若有 router 实例）
        if (typeof router !== 'undefined' && router) {
            const origPush = router.push.bind(router);
            router.push = function (location, onComplete, onAbort) {
                console.group('[router.trace] push');
                console.log('location:', location);
                console.trace();
                console.groupEnd();
                return origPush(location, onComplete, onAbort);
            };
            const origReplace = router.replace.bind(router);
            router.replace = function (location, onComplete, onAbort) {
                console.group('[router.trace] replace');
                console.log('location:', location);
                console.trace();
                console.groupEnd();
                return origReplace(location, onComplete, onAbort);
            };
        }
    } catch (e) {
        console.warn('router trace init failed', e);
    }

    try {
        // 2) 捕获 history API 的调用（pushState / replaceState）
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

        // 3) 监听 hashchange（location.hash 变化）
        window.addEventListener('hashchange', (ev) => {
            console.group('[hash.trace] hashchange');
            console.log('oldURL:', ev.oldURL, 'newURL:', ev.newURL);
            console.trace();
            console.groupEnd();
        }, true);

        // 4) 监控直接写 window.location.href / assign / replace（部分浏览器可能不允许覆盖）
        try {
            const origAssign = window.location.assign.bind(window.location);
            window.location.assign = function (url) {
                console.group('[location.trace] assign');
                console.log('url:', url);
                console.trace();
                console.groupEnd();
                return origAssign(url);
            };
            const origReplaceLoc = window.location.replace.bind(window.location);
            window.location.replace = function (url) {
                console.group('[location.trace] replace');
                console.log('url:', url);
                console.trace();
                console.groupEnd();
                return origReplaceLoc(url);
            };
        } catch (e) {
            // ignore if not allowed
        }

        // 5) 记录所有点击的 <a>（判断是否为内部绝对路径或 hash 链接触发）
        document.addEventListener('click', (e) => {
            const a = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!a) return;
            console.group('[click.trace] anchor click');
            console.log('hrefAttr:', a.getAttribute('href'), 'href:', a.href, 'target:', a.target);
            console.trace();
            console.groupEnd();
        }, true);

        // 6) 当 beforeEach 取消或允许导航时，打印更详细信息（可额外放到 router.beforeEach）
        // （如果你已经有 beforeEach，请临时把下面这段合并进去以便打印更多信息）
        // router.beforeEach((to, from, next) => {
        //   console.log('[router.debug] to:', to.fullPath, 'from:', from.fullPath);
        //   console.trace();
        //   next();
        // });
    } catch (e) {
        console.warn('debug instrumentation failed', e);
    }
}