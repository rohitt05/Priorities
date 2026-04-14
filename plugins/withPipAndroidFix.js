const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * This plugin injects the required SDK versions into the root project's 
 * build.gradle so that react-native-pip-android can read them via safeExtGet.
 */
module.exports = function withPipAndroidFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = fixGradle(config.modResults.contents);
    }
    return config;
  });
};

function fixGradle(content) {
  const versionInfo = `
    // [FIX] react-native-pip-android versions
    ext {
        PipAndroid_compileSdkVersion = 35
        PipAndroid_targetSdkVersion = 35
        PipAndroid_buildToolsVersion = "35.0.0"
        PipAndroid_minSdkVersion = 24
    }
  `;

  if (content.includes('PipAndroid_compileSdkVersion')) {
    return content;
  }

  // Inject at the beginning of the allprojects or buildscript block
  return content.replace(/allprojects\s*{/, `allprojects { \n${versionInfo}`);
}
