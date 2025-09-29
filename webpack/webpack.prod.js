// webpack/webpack.prod.js
const path = require('path');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const PrerenderSPAPlugin = require('prerender-spa-plugin');
const { PuppeteerRenderer } = PrerenderSPAPlugin;

module.exports = {
  mode: 'production',
  devtool: false,

  optimization: {
    minimize: true,
    minimizer: [new CssMinimizerPlugin()],
  },

  plugins: [
    // Пререндерим ключевые маршруты, чтобы соцсети видели OG-теги без JS
    new PrerenderSPAPlugin({
      // Папка с готовым билдом (если у тебя другой output.path — поменяй тут)
      staticDir: path.resolve(__dirname, '../dist'),

      // Маршруты для пререндера (позже добавим все /albums/:slug)
      routes: ['/', '/albums'],

      renderer: new PuppeteerRenderer({
        headless: true,
        // Ждём, пока страница сама сообщит, что мета-теги готовы
        renderAfterDocumentEvent: 'seo-ready',
        // Фолбэк-таймер на всякий случай
        renderAfterTime: 8000,
      }),
    }),
  ],
};
