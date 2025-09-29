// webpack/webpack.prod.js

module.exports = {
  mode: 'production',
  devtool: false,
  optimization: {
    minimize: true,
    minimizer: [
      // CssMinimizerPlugin лучше тоже подключить здесь, а не в common
      new (require('css-minimizer-webpack-plugin'))(),
    ],
  },
};
