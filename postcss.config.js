const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcssPresetEnv = require('postcss-preset-env');

module.exports = {
  plugins: [
    autoprefixer(),
    cssnano({ preset: 'default' }),
    postcssPresetEnv({
      browsers: 'last 2 versions',
    }),
  ],
};
