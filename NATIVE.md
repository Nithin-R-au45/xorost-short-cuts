# Building the Xorost iOS & Android apps

Xorost ships as a native app using [Capacitor](https://capacitorjs.com): a thin
native shell that loads the published Xorost website, with native camera and
photo-gallery access for uploads.

## Prerequisites

| Platform | You need |
| --- | --- |
| iOS | A Mac with Xcode, an Apple Developer account ($99/year) |
| Android | Android Studio, a Google Play Console account ($25 one-time) |

Both: Node.js 20+ and this repository cloned from GitHub.

## One-time setup

1. Publish Xorost in Lovable and note the live URL.
2. Put that URL in `capacitor.config.ts` (`server.url`) or export it:
   ```bash
   export CAPACITOR_SERVER_URL="https://your-live-url"
   ```
3. Install the native tooling and create the projects:
   ```bash
   npm install --save-dev @capacitor/cli
   npm install @capacitor/core @capacitor/ios @capacitor/android @capacitor/splash-screen @capacitor/camera
   npx cap add ios      # Mac only
   npx cap add android
   npx cap sync
   ```
   This creates the `ios/` and `android/` folders — commit them to GitHub.

## Permissions (uploads need these)

- **iOS** — in `ios/App/App/Info.plist` add:
  - `NSCameraUsageDescription`: "Record videos to upload to Xorost."
  - `NSPhotoLibraryUsageDescription`: "Choose videos from your library to upload."
- **Android** — `cap sync` adds camera/storage permissions automatically.

## Build & submit

### Android (Play Store)
```bash
npx cap open android
```
In Android Studio: **Build → Generate Signed App Bundle**, create a keystore,
then upload the `.aab` in Play Console → Create app → Production release.

### iOS (App Store)
```bash
npx cap open ios
```
In Xcode: set your Team under Signing & Capabilities, then
**Product → Archive → Distribute App → App Store Connect**. Create the app
listing at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).

## Notes

- The app loads the live site, so most updates publish instantly from Lovable
  with no new store release. Only native changes (icons, permissions, Capacitor
  upgrades) need a new store build.
- App icons: replace the generated ones in `ios/App/App/Assets.xcassets` and
  `android/app/src/main/res/`, or use `npx @capacitor/assets generate`.
- Apple sometimes rejects apps that are only a wrapped website. Xorost's
  native uploads, profiles and notifications usually satisfy this, but be
  ready to answer review questions about what the app does.
