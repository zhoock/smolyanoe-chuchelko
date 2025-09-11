// webpack/webpack.dev.js

const path = require('path'); //для того чтобы превратить относительный путь в абсолютный, мы будем использовать пакет path
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin'); // плагин для обновления React компонентов без перезагрузки страницы

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',
  devServer: {
    historyApiFallback: true, // необходимо при испольтзовании React Router для маршрутизации
    static: path.resolve(__dirname, '../dist'), // путь, куда "смотрит" режим разработчика
    // compress: true, // это ускорит загрузку в режиме разработки
    port: 8080, // порт, чтобы открывать сайт по адресу localhost:8080, но можно поменять порт
    open: true, // сайт будет открываться сам при запуске npm run dev
    hot: true,
  },
  plugins: [new ReactRefreshWebpackPlugin()],
};
