---
name: app-store-release
version: 1.0.0
argument-hint: "[--upload] [--screenshots] [--video]"
description: "Release the latest lpm Link iOS build on App Store Connect (appstoreconnect.apple.com) through Chrome: upload a build with mobile/ios/deploy.sh when needed, add the new version, attach the newest build, write What's New, refresh the screenshots (app-store-screenshots) and review video (app-review-video) when they're stale, then submit for review. Use when the user asks to release, ship or submit lpm Link / the iOS app to the App Store."
---

Use Claude in Chrome on the user's logged-in Chrome, starting at `https://appstoreconnect.apple.com/apps` → **lpm Link**.

1. **Build.** Open TestFlight and find the newest build. If it isn't from the current `mobile/ios` code, or the user passed `--upload`, run `mobile/ios/deploy.sh`. It bumps `MARKETING_VERSION` in `project.yml` (tell the user to commit that change), archives the app and uploads it. Reload until the build is no longer Processing, which takes about 5–15 minutes.
2. **Version.** On the Distribution tab, click **+** next to iOS App and enter the build's version. If a draft version already exists, use it instead.
3. **What's New.** Get the user-visible changes from `git log --oneline -- mobile/ios mobile/shared` since the commit that set the version now live on the store (`git log -S'MARKETING_VERSION: "<live>"' -- mobile/ios/project.yml`). Write 3–6 short bullets with no commit jargon and no mention of Tailscale. Show them to the user before saving.
4. **Screenshots.** If the screens changed or the user passed `--screenshots`, run the `app-store-screenshots` skill and upload the images as its "After a run" step says. Otherwise keep the screenshots from the previous version.
5. **Build + review info.** In the Build section, pick the build from step 1. If pairing or the main flows changed or the user passed `--video`, run `app-review-video` and update App Review Information → Notes with the new version, build and video link. Keep Release set to the user's earlier choice. Leave everything else as it was.
6. **Submit.** Ask for the user's OK, then click **Add for Review** → **Submit to App Review**. Confirm the status reads "Waiting for Review". Report the version, build, What's New text and status.

Traps: `ITSAppUsesNonExemptEncryption` is false, so no export compliance question should come up. If one does, ask the user. Never press **Release** or change pricing or availability without the user's explicit request.
