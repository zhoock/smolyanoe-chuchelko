// Webpack конфигурация для сборки проекта на React с TypeScript и Sass

const path = require('path'); // модуль nodejs для корректной обработки путей
const HtmlWebpackPlugin = require('html-webpack-plugin'); // Плагин для генерации HTML с правильными путями к скриптам
const FileManagerPlugin = require('filemanager-webpack-plugin'); // автоматическая очистка каталогов
const MiniCssExtractPlugin = require('mini-css-extract-plugin'); // извлекаем CSS из файлов .js при сборке
const CopyWebpackPlugin = require('copy-webpack-plugin'); // Копируем файлы и папки в папку dist
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin'); // Минимизация CSS

module.exports = {
  entry: {
    bundle: './src/index.tsx', // Основной файл для React с TypeScript
    // modules: './src/script.js', // Дополнительный скрипт на JavaScript
  },

  output: {
    filename: 'index[contenthash].js', // // Имя итогового бандла, используем contenthash для динамических хешей
    path: path.join(__dirname, 'dist'), // Папка для собранных файлов
    assetModuleFilename: path.join('images', '[name].[contenthash][ext]'),
    clean: true, // Очищать старые файлы при сборке
    publicPath: '/', // Важно для работы historyApiFallback
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'], // Поддерживаемые расширения
  },

  module: {
    // Правила обработки файлов при сборке
    rules: [
      {
        test: /\.tsx?$/, // Обработка TypeScript файлов
        use: 'ts-loader', // Используем ts-loader для компиляции TypeScript
        exclude: /node_modules/, // Исключает папку node_modules,
      },
      {
        test: /\.(js|jsx)$/, // Регулярное выражение, которое ищет все обрабатывает все JS файлы через Babel
        use: 'babel-loader', // Используем babel-loader для JS
        exclude: /node_modules/, // Исключает папку node_modules,
      },
      {
        test: /\.pug$/,
        loader: 'pug-loader',
        options: {
          attrs: ['img:src', 'source:srcset'],
        },
      },
      {
        test: /\.(scss|sass|css)$/, // Правило для обработки файлов с расширениями .scss, .sass и .css
        use: [
          MiniCssExtractPlugin.loader, // MiniCssExtractPlugin.loader: Этот загрузчик извлекает CSS из JavaScript в отдельные файлы (при сборке в production). Это помогает уменьшить размер главного файла JS.
          'css-loader', // Этот загрузчик позволяет работать с CSS-файлами. Он интерпретирует и обрабатывает import и url() в CSS.
          'postcss-loader', // Этот загрузчик используется для обработки CSS с использованием PostCSS, позволяя применять такие плагины, как автопрефиксер (например, postcss-preset-env).
          'sass-loader', // Этот загрузчик используется для компиляции файлов SCSS/SASS в обычный CSS.
        ],
      },
      {
        test: /\.(png|jpe?g|webp|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: path.join('icons', '[name].[contenthash][ext]'),
        },
      },
    ],
  },

  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, './src/_redirects'), // Путь к файлу _redirects
          to: path.resolve(__dirname, './dist/'), // Папка в которую нужно скопировать
        },
        {
          from: path.resolve(__dirname, './src/audio'), // Путь к аудиофайлам в src
          to: path.resolve(__dirname, './dist/audio'), // Папка назначения в dist
        },
        {
          from: path.resolve(__dirname, './src/images'), // Путь к фотографиям в src
          to: path.resolve(__dirname, './dist/images'), // Папка назначения в dist
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html', // Указываем исходный HTML-шаблон
      inject: 'body', // Скрипты будут вставляться перед закрывающим тегом </body>
      filename: 'index.html', // Имя итогового HTML файла
    }),
    new FileManagerPlugin({
      events: {
        onStart: {
          delete: ['dist'],
        },
      },
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash:6].css',
    }),
  ],

  optimization: {
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin(), // Минимизация CSS с помощью CssMinimizerPlugin
    ],
  },

  performance: {
    hints: false, // не отображаются предупреждения и ошибоки по производительности
  },

  devServer: {
    historyApiFallback: true, // необходимо при испольтзовании React Router для маршрутизации
    watchFiles: path.join(__dirname, 'src'), // указывает на каталог src, за которыми будет вестись наблюдение
    port: 3000, // указывает порт на котором будет работать веб-сервер
    hot: true, // включает горячую перезагрузку
  },
};
