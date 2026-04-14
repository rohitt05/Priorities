const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'node_modules/react-native-pip-android/android/build.gradle');

if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf8');
    
    // Force compileSdkVersion to 35
    content = content.replace(/compileSdkVersion\s+.*/g, 'compileSdkVersion 35');
    // Force targetSdkVersion to 35
    content = content.replace(/targetSdkVersion\s+.*/g, 'targetSdkVersion 35');
    // Force buildToolsVersion to "35.0.0" (or similar)
    content = content.replace(/buildToolsVersion\s+.*/g, 'buildToolsVersion "35.0.0"');

    fs.writeFileSync(targetPath, content);
    console.log('[PATCH] Fixed react-native-pip-android build.gradle');
} else {
    console.warn('[PATCH] react-native-pip-android/android/build.gradle not found. Skipping patch.');
}
