const { withProjectBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

/**
 * This plugin injects the required SDK versions into the root project's 
 * build.gradle so that react-native-pip-android can read them via safeExtGet,
 * and configures AndroidManifest.xml to support Picture-in-Picture mode.
 */
module.exports = function withPipAndroidFix(config) {
  // 1. Configure build.gradle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = fixGradle(config.modResults.contents);
    }
    return config;
  });

  // 2. Configure AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainActivity = config.modResults.manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      mainActivity.$['android:supportsPictureInPicture'] = 'true';

      const existingConfigChanges = mainActivity.$['android:configChanges'] || '';
      const neededChanges = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];
      let changesArray = existingConfigChanges ? existingConfigChanges.split('|') : [];

      neededChanges.forEach((change) => {
        if (!changesArray.includes(change)) {
          changesArray.push(change);
        }
      });

      mainActivity.$['android:configChanges'] = changesArray.join('|');
    }
    return config;
  });

  return config;
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
