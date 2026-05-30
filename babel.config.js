module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        // Strip console.* calls from release builds only.
        plugins: ['transform-remove-console'],
      },
    },
  };
};