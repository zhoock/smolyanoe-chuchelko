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
    // Code splitting: разделяем код на чанки для лучшей производительности
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Отдельный чанк для vendor библиотек (React, Redux и т.д.)
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        // Отдельный чанк для общих компонентов и утилит
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
