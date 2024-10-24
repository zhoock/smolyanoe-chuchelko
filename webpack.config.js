const path = require("path"); // модуль nodejs для корректной обработки путей
const HtmlWebpackPlugin = require("html-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin"); // автоматическая очистка каталогов
const MiniCssExtractPlugin = require("mini-css-extract-plugin"); // извлекаем CSS из файлов .js при сборке

module.exports = {
  entry: {
    bundle: path.join(__dirname, "src", "index.tsx"),
  },

  output: {
    path: path.join(__dirname, "dist"),
    filename: "index[contenthash].js",
    assetModuleFilename: path.join("images", "[name].[contenthash][ext]"),
    clean: true,
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },

  module: {
    rules: [
      {
        // test: /\.(js|jsx)$/,
        // use: "babel-loader",
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.pug$/,
        loader: "pug-loader",
        options: {
          attrs: ["img:src", "source:srcset"],
        },
      },
      {
        test: /\.(scss|sass|css)$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          "postcss-loader",
          "sass-loader",
        ],
      },
      {
        test: /\.(png|jpe?g|webp|gif)$/i,
        type: "asset/resource",
      },
      {
        test: /\.svg$/,
        type: "asset/resource",
        generator: {
          filename: path.join("icons", "[name].[contenthash][ext]"),
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "index.html"),
      filename: "index.html",
    }),
    new FileManagerPlugin({
      events: {
        onStart: {
          delete: ["dist"],
        },
      },
    }),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash:6].css",
    }),
  ],
  performance: {
    hints: false, // не отображаются предупреждения и ошибоки по производительности
  },
  devServer: {
    // static: {
    //   directory: path.resolve(__dirname, "src"),
    // },
    historyApiFallback: true, // необходимо при испольтзовании React Router для маршрутизации
    watchFiles: path.join(__dirname, "src"), // указывает на каталог src, за которыми будет вестись наблюдение
    port: 5173, // указывает порт на котором будет работать веб-сервер
  },
};
