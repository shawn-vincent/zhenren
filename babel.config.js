module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Temporarily disabled Tamagui babel plugin due to config loading issues
      // [
      //   '@tamagui/babel-plugin',
      //   {
      //     components: ['tamagui'],
      //     config: './tamagui.config.ts',
      //     logTimings: false,
      //     disableExtraction: true,
      //   },
      // ],
      'react-native-reanimated/plugin',
    ],
  };
};