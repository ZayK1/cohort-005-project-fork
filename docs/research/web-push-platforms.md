# How Web Push works for a React Router web app on Android, iPhone and desktop

Research for [issue #2](https://github.com/ZayK1/cohort-005-project-fork/issues/2) (map: [#1](https://github.com/ZayK1/cohort-005-project-fork/issues/1)). Gathered 2026-11-12. Browser support figures come from MDN's browser-compat-data (BCD) package v8.1.9 (timestamp 2026-11-12), the data behind MDN's compatibility tables.

## Short answer

Cadence can send **Push** to Android, iPhone/iPad and desktop browsers through one standard pipeline: a service worker plus the Push and Notifications APIs, VAPID keys on our server, and encrypted HTTP POSTs to whichever push service the browser picked. There is no per-vendor SDK and no developer account. The push services cost nothing. The main limits:

- **iPhone/iPad only gets Push once Cadence is added to the Home Screen** (iOS/iPadOS 16.4+). In a Safari tab it gets nothing.
- **Permission has to come from a user tap or click** that calls subscribe or requestPermission directly. Safari and Firefox enforce this. Chrome punishes prompts that lack context.
- **Every push has to show a visible Notification.** Silent pushes get the subscription revoked.
- **Vibration and sound are effectively not ours to control.** The `vibrate` option does nothing on Android 8+ and is unsupported on iOS. The only cross-browser control is `silent`, and iOS doesn't support even that.
- **Payload is about 4 KB** (at most 3993 bytes of plaintext). Send a small JSON body. The service worker can fetch more if needed.

## 1. The moving parts (all browsers)

| Piece | What it is | Source |
| --- | --- | --- |
| Service worker | Required. "For an app to receive push messages, it has to have an active service worker." The browser starts it to handle the `push` event even when no tab is open. | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) |
| `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` | Returns a `PushSubscription`: an endpoint URL plus the `p256dh`/`auth` keys used to encrypt the payload. "Each subscription is unique to a service worker." | MDN Push API; [web.dev: subscribing a user](https://web.dev/articles/push-notifications-subscribing-a-user) |
| Endpoint URL | "A unique capability URL: knowledge of the endpoint is all that is necessary to send a message." Keep it secret, store it against the user, and protect the subscribe route from CSRF. | MDN Push API |
| Push service | Run by the browser vendor (FCM for Chrome, APNs for Safari, Mozilla's service for Firefox, and so on). "Each browser uses whatever push service it wants. You as a website developer have no control over that." All of them speak the same protocol ([RFC 8030](https://www.rfc-editor.org/rfc/rfc8030.html)). | [web.dev overview](https://web.dev/articles/push-notifications-overview) |
| `push` event, then `registration.showNotification()` | The service worker decrypts the payload and shows the Notification. `notificationclick` handles the tap. | MDN Push API |
| `pushsubscriptionchange` | Fires when a subscription is invalidated or about to expire. Re-subscribe and update the server. | MDN Push API |

`userVisibleOnly: true` is mandatory in practice. Chrome: "You *must* pass a value of `true`" ([web.dev](https://web.dev/articles/push-notifications-subscribing-a-user)). Safari: "Safari doesn't support invisible push notifications… If you don't, Safari revokes the push notification permission for your site" ([Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). WebKit: "The Web Push API is not an invitation for silent background runtime" ([WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)). **Consequence for Cadence:** the service worker must call `showNotification` for every push it receives. A push can't be used to silently update the bell count.

Service workers require a secure context: HTTPS, or `localhost` for development ([MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)).

## 2. Server side: VAPID and the send request

- **VAPID** ([RFC 8292](https://www.rfc-editor.org/rfc/rfc8292.html)): one P-256 key pair per application. The public key is passed as `applicationServerKey` at subscribe time. The server signs an ES256 JWT with `aud` set to the push service origin, `exp` no more than 24 h ahead, and `sub` set to a `mailto:` or `https:` contact ([web.dev: Web Push protocol](https://web.dev/articles/push-notifications-web-push-protocol)). Chrome, Edge and Samsung require `applicationServerKey` (BCD). Apple returns `VapidPkHashMismatch` if the key in the request doesn't match the one used to subscribe, and asks senders: "Don't refresh your JWT more frequently than once per hour" ([Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- **Encryption** ([RFC 8291](https://www.rfc-editor.org/rfc/rfc8291.html)): `Content-Encoding: aes128gcm` in a single record. (Older web.dev examples show the obsolete `aesgcm` encoding. Use `aes128gcm`.)
- **Headers** ([RFC 8030](https://www.rfc-editor.org/rfc/rfc8030.html)):
  - `TTL` is required. The service returns 400 without it. Apple stores messages for at most 30 days, and caps how many it keeps for an offline device.
  - `Urgency` takes `very-low`, `low`, `normal` (the default) or `high`.
  - `Topic` (≤32 chars) means a newer message replaces an undelivered one with the same topic. This is useful for "latest unread count" style pushes.
- **Responses to handle:**
  - 201: accepted.
  - 404 or 410: the subscription is expired or gone. **Delete it.**
  - 413: payload too large.
  - 429: rate limited. Honour `Retry-After`.

  Sources: RFC 8030 §7.3/§8.4, web.dev, Apple.
- **Network allow-list:** if outbound traffic is restricted, allow `https://*.push.apple.com` (Apple). Endpoints for other browsers are on other hosts (for example `fcm.googleapis.com`). Treat the endpoint as opaque.
- **Library:** the open-source [`web-push`](https://github.com/web-push-libs/web-push) npm package (MPL-2.0, v4.0.0, Node ≥16, last published Nov 2026) handles VAPID, JWT and aes128gcm. No paid service is needed to send.

## 3. Payload size

- RFC 8291: "A push service is not required to support more than 4096 octets of payload body… this equates to, at most, **3993 octets of plaintext**."
- RFC 8030 §7.2: push services "MUST NOT return a 413" for bodies of 4096 bytes or less.
- Apple: `PayloadTooLarge` means "The payload size is over the limit of 4 KB."

**Design implication:** keep the push payload to a title, a short body, a URL and an id. Anything larger should be fetched by the service worker or loaded when the user opens the app.

## 4. Platform by platform

### Android (Chrome, Edge, Samsung Internet, Firefox)

- Push works from a normal browser tab. **Installing a PWA isn't required** for Push on Android or desktop. None of the Chrome/web.dev sources make installation a precondition, and BCD shows `PushManager` supported from Chrome Android 42, Firefox Android 48 and Samsung Internet 4 with no install note. Only Safari's entries carry the "saved to the home screen" note.
- It works with the browser closed: "The Android OS is designed to listen for push messages and upon receiving one, wake up the appropriate Android app" ([web.dev FAQ](https://web.dev/articles/push-notifications-faq)).
- Not supported in Android WebView (BCD), so in-app browsers that use WebView won't get Push.
- Firefox for Android (79+) only allows `subscribe()` in response to a user gesture (BCD).
- Chrome on Android uses a lighter, non-blocking notification prompt from Chrome 155. If it times out, `Notification.requestPermission()` resolves `'default'`, so treat `'default'` as "not yet". Users can also subscribe later from Site Controls, so watch `navigator.permissions.query({name:'notifications'})` for `onchange` ([Chrome blog, 22 Jul 2026](https://developer.chrome.com/blog/notification-prompts-android)).

### Desktop (Chrome, Edge, Firefox, Safari on macOS)

- Chrome 42+, Edge 17+, Firefox 44+, and Safari 16+ on macOS 13 Ventura or later (BCD; [Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). Installation isn't required.
- For Chrome-family browsers, "you will receive messages when the browser is running… The only time a push won't be received is when the browser is completely closed" ([web.dev FAQ](https://web.dev/articles/push-notifications-faq)). The push service queues messages until TTL expires.
- **Uncertain:** whether macOS Safari delivers while Safari is fully quit. Apple's docs don't say, and I found no primary source on it.
- Firefox desktop (72+) requires a user gesture for `subscribe()` (BCD).

### iPhone and iPad (iOS/iPadOS 16.4+)

- **Home Screen only.** "With iOS and iPadOS 16.4, we are adding support for Web Push to Home Screen web apps" ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). BCD: `PushManager` on Safari iOS 16.4, with the note "Notifications are supported in web apps saved to the home screen." Push isn't available in a Safari tab, and in-app browsers and third-party iOS browsers aren't covered by any of these sources.
- **Manifest:** the 16.4 announcement requires a manifest whose `display` is `standalone` or `fullscreen` ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). In iOS/iPadOS 26, "every website added to the Home Screen opens as a web app" by default, even without a manifest ([WebKit, Safari 26](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)). **Uncertain:** whether a manifest-less Home Screen app on iOS 26 can get Push. WebKit doesn't say, so Cadence should ship a proper manifest anyway. The manifest `id` is used to sync Focus settings across devices.
- **Permission must come from a direct user interaction.** Apple: "Provide a method for the user to grant permission with a gesture, such as clicking or tapping a button. When the user completes the gesture, call the push subscription method immediately from the gesture's event handler code" ([Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). Doing async work such as a server round-trip before calling `subscribe()` risks losing the gesture.
- **Getting users there:** the user has to add Cadence to the Home Screen themselves (Share → Add to Home Screen). The web has no API that installs on iOS. The UI needs an "Add to Home Screen to get notifications" hint for iPhone users in Safari. This hint is design guidance, not a platform API.
- Delivered through APNs to the Lock Screen, Notification Center and a paired Apple Watch. Users manage permission per web app in Settings → Notifications, and notifications respect Focus modes ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Badging API:** `navigator.setAppBadge(n)` / `clearAppBadge()` work on Home Screen web apps (iOS 16.4+), including from the service worker's push handler ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); BCD). The badge is visible once notification permission is granted. This fits an Inbox unread count. Chrome and Edge desktop support it too (installed apps). Chrome Android and Firefox don't.
- **Declarative Web Push** (iOS/iPadOS 18.4, macOS Safari 18.5): a push whose JSON has `"web_push": 8030` and a `notification` with `title` and `navigate` is displayed by the browser without running service-worker code. `window.pushManager` can subscribe without a service worker. Browsers that don't support it fall back to the normal service-worker path ([WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/)). This is optional. Cadence can use the standard imperative path everywhere, or send declarative-shaped payloads so Safari can show the notification even if the worker fails.
- **No Apple Developer Program membership needed:** "You don't need to join the Apple Developer Program to send web push notifications" ([Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- **EU caveat (resolved):** iOS 17.4 betas removed Home Screen web apps in the EU, citing the DMA. On 1 Mar 2024 Apple reversed this and kept the existing WebKit-based Home Screen web app capability in the EU. **Source quality:** these are press reports ([9to5Mac](https://9to5mac.com/2024/03/01/apple-home-screen-web-apps-ios-17-eu/), [MacRumors](https://www.macrumors.com/2024/02/15/ios-17-4-web-apps-removed-apple/)). Apple's own notice wasn't retrievable (the current [DMA page](https://developer.apple.com/support/dma-and-apps-in-the-eu/) no longer mentions it). I found no current EU restriction on Web Push.

## 5. Vibration, sound and how a notification looks

`showNotification` options, by platform (BCD; [MDN showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification)):

| Option | Chrome/Edge desktop | Chrome Android | Firefox | Safari macOS | Safari iOS |
| --- | --- | --- | --- | --- | --- |
| `vibrate` | 45+ (no vibration hardware) | **No effect on Android 8 (Oreo)+** ([crbug 40630890](https://crbug.com/40630890)) | No | No | No |
| `silent` | 43+ | 43+ | 132+ | 16.6+ | **No** |
| `icon` | Yes | Yes | Yes | Settable, no effect (the app icon is used) | Settable, no effect |
| `badge` (monochrome status-bar icon) | 53+ | 53+ | No | No | No |
| `image` | 56+ | 56+ | No | No | No |
| `actions` (buttons) | 48+ | 48+ | 152+ | No | No |
| `tag` / `renotify` | Yes / 50+ | Yes / 50+ | tag only | tag only | tag only |
| `requireInteraction` | 47+ | 47+ | No (Windows only for `Notification`) | No | No |
| `navigate` (open URL without JS) | No | No | 158+ | 18.5+ | 18.5+ |

There is **no option to choose a sound**. Sound and vibration come from the OS and the user's per-site or per-app notification settings (Android notification channels, iOS Settings → Notifications and Focus). The only sound control the page has is `silent: true`, which suppresses sound and vibration where supported. `silent: true` together with `vibrate` throws a `TypeError` (MDN). **Implication:** for the "Push" settings spec, Cadence can offer "push on/off" per trigger and maybe a "quiet" toggle via `silent`. It can't offer "buzz pattern" or "pick a sound".

## 6. Permission prompt rules and penalties

- **The gesture rule** applies in Safari (macOS and iOS) and Firefox (desktop 72+, Android 79+), which require `subscribe()` from a user gesture (Apple; BCD). Chrome doesn't hard-require one, but a request without a gesture gets the quiet chip instead of a bubble. Chrome also advises: "Avoid showing prompts and/or overlays without context or immediately after a user lands on the site" ([Chrome permissions chip](https://developer.chrome.com/blog/permissions-chip)). Since Chrome 80, sites with low acceptance get a "quieter" prompt (only a bell in the address bar) ([Chrome Help](https://support.google.com/chrome/answer/3220216)).
- **Once denied, the site can't ask again.** "The user must manually unblock your app by changing its permission state in a settings panel" ([web.dev](https://web.dev/articles/push-notifications-subscribing-a-user)). This is the main argument for a soft pre-prompt (our own "Turn on notifications?" UI first, then the real prompt on its button).
- **Chrome auto-revocation** (announced Oct 2025): Chrome removes notification permission from sites with very low engagement and a high volume of notifications. "This feature does not revoke notifications for any installed web apps" ([Google blog](https://blog.google/chromium/automatic-notification-permission/)).
- **Chrome Push rate limits** (rolling out Jan 2026): sites flagged as disruptive, judged on pushes and prompts relative to time on site and on engagement, are capped at no less than 1,000 messages/min for 1, 7 or 14 days ([Chrome blog](https://developer.chrome.com/blog/web-push-rate-limits)). "Nearly all websites will be unaffected." A course platform sending event-driven notifications shouldn't hit this. That's an inference.
- Users manage permission in browser site settings (desktop and Android) and in iOS Settings → Notifications for Home Screen apps.

## 7. Cost

- **Sending is free at the protocol level.** The push service is the browser vendor's: "Cloud Messaging (FCM) | No-cost" ([Firebase pricing](https://firebase.google.com/pricing)). Apple needs no developer membership. **Uncertain:** Mozilla's and Microsoft's push services don't publish pricing that I found, but no fee or account exists in the Web Push flow (the endpoint plus VAPID is all a sender uses).
- Self-hosting means our own server sends HTTPS POSTs with the open-source `web-push` library. There's no third-party bill. A hosted notification service is a convenience, not a requirement for Push itself.
- Real limits are rate limits (429) and per-device storage caps, not money.

## 8. React Router 8 / Vite specifics for Cadence

- **Serving the service worker:** put `sw.js` in `public/`. Vite serves `public/` "at root path during dev" and copies it unchanged (no hash) into the build ([Vite: public directory](https://vite.dev/guide/assets)), so `/sw.js` is available in both `react-router dev` and the built app. A worker at `/sw.js` gets scope `/` by default. A worker served from a subpath would need a `Service-Worker-Allowed: /` header to control `/` ([MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)). Cadence already serves `public/favicon.svg` this way.
- **Bundling:** a file in `public/` is not processed by Vite, so it must be plain JS, or a module worker (`register('/sw.js', { type: 'module' })`) that only imports other public files. If we want TypeScript or shared code in the worker, that needs a separate build step. I found no official React Router docs page on service workers. **Uncertain:** whether the community `vite-plugin-pwa` works cleanly with React Router framework mode. I didn't verify it.
- **Registration:** call `navigator.serviceWorker.register('/sw.js')` on the client only, for example in a `useEffect` in `app/root.tsx` or in a revealed `entry.client.tsx`. Never call it during SSR.
- **Manifest:** add `public/manifest.webmanifest` (name, icons, `start_url`, `display: "standalone"`, `id`) and a `<link rel="manifest">` via the `links` export in `app/root.tsx`. iPhone Push needs it. Android and desktop Push don't, but it enables install.
- **Server:** a React Router action/resource route (for example `POST /api/push-subscriptions`) stores `{endpoint, p256dh, auth}` per user in SQLite through Drizzle. The sender runs server-side with `web-push`, and deletes rows on a 404/410 response. The VAPID private key goes in an env var, and the public key is exposed to the client.
- **Local dev:** `localhost` counts as a secure context, so Push can be tested on desktop at `http://localhost:5173`. Testing on a phone needs HTTPS (a tunnel or deployed URL). iPhone testing also needs Add to Home Screen.

## Open questions and uncertainty

1. Whether iOS 26 grants Push to Home Screen sites that have no manifest. Not stated by WebKit. Ship a manifest regardless.
2. Whether macOS Safari delivers pushes while Safari is fully quit. Not documented by Apple.
3. Pricing or terms for Mozilla autopush and Microsoft's push service aren't published that I found. They are free in practice, with no account.
4. EU status relies on press reports of Apple's March 2024 reversal, not a current Apple page.
5. Third-party iOS browsers (Chrome/Edge/Firefox on iOS, which use WebKit): whether their "Add to Home Screen" yields a push-capable web app wasn't covered by the sources read.
