const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Restricts the native CPU architectures bundled in the APK to the two that
 * cover virtually all real Android phones (armeabi-v7a, arm64-v8a). Dropping
 * x86/x86_64 (emulator-only) significantly reduces the universal APK size.
 */
module.exports = function withReactNativeArchitectures(config) {
  return withGradleProperties(config, (cfg) => {
    const key = 'reactNativeArchitectures';
    const value = 'armeabi-v7a,arm64-v8a';

    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === key
    );

    if (existing) {
      existing.value = value;
    } else {
      cfg.modResults.push({ type: 'property', key, value });
    }

    return cfg;
  });
};
