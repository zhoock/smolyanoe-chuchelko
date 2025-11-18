// webpack/webpack.dev.js

const path = require('path'); //для того чтобы превратить относительный путь в абсолютный, мы будем использовать пакет path
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin'); // плагин для обновления React компонентов без перезагрузки страницы

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',
  devServer: {
    // historyApiFallback должен исключать /api/*, иначе он перехватывает все запросы
    // Важно: прокси обрабатывается ПЕРЕД historyApiFallback, но нужно явно исключить /api
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        // Для всех остальных - fallback на index.html
        { from: /./, to: '/index.html' },
      ],
    },
    static: path.resolve(__dirname, '../dist'), // путь, куда "смотрит" режим разработчика
    // compress: true, // это ускорит загрузку в режиме разработки
    port: 8080, // порт, чтобы открывать сайт по адресу localhost:8080, но можно поменять порт
    open: false, // Netlify Dev сам откроет браузер на порту 8888
    hot: true,
    // Проксируем запросы к Netlify функциям
    // Если NETLIFY_SITE_URL установлен - проксируем на прод
    // Если нет - проксируем на локальный Netlify Dev (порт 8888)
    proxy: [
      {
        // Простая настройка - проксируем все запросы к /api/*
        context: ['/api'],
        target: process.env.NETLIFY_SITE_URL || 'http://localhost:8888',
        changeOrigin: true,
        secure: process.env.NETLIFY_SITE_URL ? true : false,
        logLevel: 'debug',
        // Убеждаемся, что прокси работает
        onProxyReq: (proxyReq, req) => {
          const target = process.env.NETLIFY_SITE_URL || 'http://localhost:8888';
          console.log('[HPM] Проксируем:', req.method, req.url, '->', target + req.url);
        },
        onProxyRes: (proxyRes, req) => {
          console.log('[HPM] Ответ прокси:', proxyRes.statusCode, req.url);
        },
        onError: (err) => {
          console.error('[HPM] Ошибка прокси:', err.message);
        },
      },
    ],
  },
  plugins: [new ReactRefreshWebpackPlugin()],
};
