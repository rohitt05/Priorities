module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src', // Ensure this matches your actual folder structure (src vs app)
          },
        },
      ],
      'react-native-reanimated/plugin', // 👈 Add this line last!
    ],
  };
};
