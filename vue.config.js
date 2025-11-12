// const { defineConfig } = require('@vue/cli-service')
// module.exports = defineConfig({
//   transpileDependencies: true
// })


const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/content': {
        target: 'https://browser-rendering.gloriatrials.com',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/content': '/api/content' }
      },
      '/snapshot': {
        target: 'https://browser-rendering.gloriatrials.com',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/snapshot': '/api/snapshot' }
      },
      '/screenshot': {
        target: 'https://browser-rendering.gloriatrials.com',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/screenshot': '/api/screenshot' }
      },
      '/pdf': {
        target: 'https://browser-rendering.gloriatrials.com',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/pdf': '/api/pdf' }
      },
      '/scrape': {
        target: 'https://browser-rendering.gloriatrials.com',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/scrape': '/api/scrape' }
      },
      '/status': {
        target: 'https://browser-rendering.gloriatrials.com',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/status': '/api/status' }
      },
      // 其它接口同理...
    }
  }
});