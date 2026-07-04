import { ExpoConfig, ConfigContext } from "expo/config";
import { androidVersionCode, iosBuildNumber, version } from "./app-version";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "DoPlan",
  slug: "doplan",
  version,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "doplan",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    usesAppleSignIn: true,
    bundleIdentifier: "com.doplan.doplan",
    buildNumber: iosBuildNumber,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    versionCode: androidVersionCode,
    package: "com.doplan.doplan",
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "7f860522-b94f-4dbb-b403-9cf63e7b3bce",
    },
  },
});
