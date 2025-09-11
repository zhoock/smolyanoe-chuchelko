// postcss.config.js
const cssnano = require('cssnano');
const postcssPresetEnv = require('postcss-preset-env');

module.exports = {
  plugins: [
    postcssPresetEnv({ stage: 3 }), // читает цели из "browserslist"
    cssnano({ preset: 'default' }), // минификация в проде (можно обернуть проверкой NODE_ENV)
  ],
};
