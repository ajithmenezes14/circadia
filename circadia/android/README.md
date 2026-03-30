# Circadia Android Shell

This folder contains a native Android wrapper for the Circadia web app.

## What it does

- Loads the bundled app from `app/src/main/assets/index.html`
- Runs it inside a full-screen `WebView`
- Provides an Android app icon, theme, manifest, and Gradle setup
- Includes an AdMob banner slot using Google's official test app ID and test banner unit ID

## Open in Android Studio

1. Install Android Studio if it is not already installed.
2. Open Android Studio.
3. Choose `Open` and select this folder:
   `/Users/ajithmenezes/Documents/New project/circadia/android`
4. Let Android Studio download the Android SDK and Gradle dependencies.
5. Run the `app` configuration on an emulator or device.

## Build for Play Store

1. Open the `android` project in Android Studio.
2. Update `applicationId`, version name, and version code if needed in `app/build.gradle`.
3. Replace the placeholder launcher icon with production artwork.
4. Replace the AdMob test IDs before publishing:
   - `app/src/main/res/values/strings.xml`
   - `admob_app_id`
   - `admob_banner_unit_id`
5. Build a signed release bundle:
   `Build > Generate Signed Bundle / APK > Android App Bundle`
6. Upload the generated `.aab` file to Google Play Console.

## Syncing web changes

The Android shell currently bundles a copy of the root `index.html` at:

`app/src/main/assets/index.html`

If you update the root web app, copy it again before building:

```bash
cp ../index.html app/src/main/assets/index.html
```

## Next recommended improvements

- Add a splash screen and production icons
- Add offline-friendly local assets instead of remote analytics placeholders
- Add consent handling before production ads if you need privacy messaging in supported regions
- Replace the test ad IDs with your real AdMob IDs before release
