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
    open: true, // сайт будет открываться сам при запуске npm run dev
    hot: true,
    // Проксируем запросы к Netlify функциям на реальный сайт
    // Используйте переменную окружения NETLIFY_SITE_URL для указания URL вашего сайта
    // Например: NETLIFY_SITE_URL=https://smolyanoechuchelko.ru npm start
    proxy: process.env.NETLIFY_SITE_URL
      ? [
          {
            // Простая настройка - проксируем все запросы к /api/*
            context: ['/api'],
            target: process.env.NETLIFY_SITE_URL,
            changeOrigin: true,
            secure: true,
            logLevel: 'debug',
            // Убеждаемся, что прокси работает
            onProxyReq: (proxyReq, req) => {
              console.log(
                '[HPM] Проксируем:',
                req.method,
                req.url,
                '->',
                process.env.NETLIFY_SITE_URL + req.url
              );
            },
            onProxyRes: (proxyRes, req) => {
              console.log('[HPM] Ответ прокси:', proxyRes.statusCode, req.url);
            },
            onError: (err) => {
              console.error('[HPM] Ошибка прокси:', err.message);
            },
          },
        ]
      : [],
  },
  plugins: [new ReactRefreshWebpackPlugin()],
};
