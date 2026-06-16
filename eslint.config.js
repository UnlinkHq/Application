/* global require, module, __dirname */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off'
    },
  },
]);
