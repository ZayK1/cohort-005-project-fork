# Free notification services and tools for Cadence's Inbox and Push

Research for [#3](https://github.com/ZayK1/cohort-005-project-fork/issues/3) (map: [#1](https://github.com/ZayK1/cohort-005-project-fork/issues/1)). Researched **2026-11-12** against vendors' own pricing pages and docs, plus Apple/WebKit, MDN and the IETF RFCs. Prices and limits are as of that date and change often. Anything marked **Unverified** could not be confirmed from a primary source.

This document does not make the build-vs-buy decision; that is [#6](https://github.com/ZayK1/cohort-005-project-fork/issues/6).

## What Cadence needs

- **Inbox**: a bell with an unread count, a list of Notifications, and mark as read. Ideally live updates.
- **Push**: standard Web Push to desktop browsers and phones, including iPhone through a Home Screen web app.
- Fits ADR 0006: one SQLite file through Drizzle, one Node server, no Redis, Mongo or queue today.
- Free only: free tiers, open-source self-hosting, or building it ourselves.

## Summary

- **No free hosted service gives a prebuilt Inbox *and* sends Web Push itself**, except SuprSend (which gates preferences and digest to a $250/mo plan) and MagicBell (capped at 1,000 deliveries/mo).
- **Novu, Knock and Courier** have good free hosted Inboxes (about 10,000 messages/mo), but none sends browser Web Push itself. They hand it to FCM or OneSignal, or (Novu only) to a webhook we write that calls `web-push`. So Push needs a second provider or DIY code either way.
- **OneSignal** is Push only. It has no Inbox and does not store per-user notification history.
- **Self-hosted Novu** is open source and free, but needs MongoDB, Redis, S3-compatible storage and 4 services (about 4 vCPU and 8 GB RAM). That is more infrastructure than the whole of Cadence.
- **DIY** (SQLite tables + the `web-push` library + our own Inbox UI) costs nothing, adds no infrastructure, keeps all data in the SQLite file, and Apple confirms standard VAPID Web Push works for iPhone Home Screen web apps. The cost is building the bell, list, settings screen and any grouping ourselves.
- Every hosted option moves Notification state out of SQLite into the vendor, so the app gets a second source of truth.

## Comparison

| | Free limit | Prebuilt Inbox (React) | Live updates | Sends Web Push itself | iPhone (Home Screen) Push | Settings (preferences) on free | Digest / grouping on free | Branding on free | Infra for us | Lock-in | Fit with one SQLite file |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **DIY** (`web-push` + SQLite) | Unlimited, $0 | No, build it | Build it (SSE or polling) | Yes (own VAPID keys) | Yes, Apple-documented | Build it | Build it | None | None new | None | Native |
| **OneSignal** Free | Web push "Max 10,000 subscribers per send" (cap ambiguous) | **No Inbox** | No | Yes (own SDK and worker) | Yes, documented | Not found | Not found | Not stated | None | High (SDK, subscriptions in OneSignal; export is paid) | Push only; Inbox still DIY in SQLite |
| **Novu Cloud** Free | 10,000 workflow runs/mo, 5 workflows, 3 seats | Yes, `@novu/react` | Yes (websocket) | No: FCM, OneSignal, Pushpad (paid) or Push Webhook | Via FCM/OneSignal/webhook + DIY | Yes, built-in UI | Yes, max digest window 1 day | Yes ("Powered by Novu") | None | Medium (MIT core is an exit) | Second source of truth |
| **Novu self-hosted** | Unlimited, $0 (MIT core) | Yes | Yes (socket.io WS service) | Same as Cloud | Same as Cloud | Yes | Yes | Not stated | MongoDB, Redis, S3, api/worker/ws/dashboard, ~4 vCPU / 8 GB | Low | Poor: far heavier than the app |
| **Knock** Free | 10,000 messages/mo (each channel counts) | Yes, `@knocklabs/react` | Yes (socket) | No: FCM or OneSignal | Via FCM (Knock tutorial handles iPhone) | Hook or hosted page; no prebuilt component | Yes | Yes | None | High (proprietary backend; SDKs MIT) | Second source of truth |
| **Courier** Developer | 10,000 sends/mo (one send = one template to one recipient, any channels) | Yes, `@trycourier/courier-react` | Yes | No: 12 providers (FCM, OneSignal, ...) | Depends on provider | Yes (gating unverified) | Exists (gating unverified) | Unverified | None | High | Second source of truth |
| **SuprSend** Free | 10,000 notifications/mo (each channel counts) | Yes, `@suprsend/react` | Yes (socket) | **Yes** (SuprSend holds the VAPID keys) | Likely; only stated on their blog | **No** (Business, $250/mo) | **No** (Business, $250/mo) | Yes | Host a service worker | High (VAPID keys held by vendor) | Second source of truth |
| **MagicBell** Builder | **1,000 deliveries/mo** (each channel counts) | Yes, `@magicbell/react` | Yes | Yes (uses our VAPID keys) | Yes (`WebPushButton` has an iOS install prompt) | Yes, `UserPreferences` component | Unverified | Unverified | None | High (proprietary SDK licence) | Second source of truth |
| **FCM** (Firebase) | "No-cost" | No | No | Yes (via Firebase SDK) | Yes per Firebase's support table | No | No | None | None | Medium (Google project, FCM tokens) | Push only; Inbox still DIY |

"Each channel counts" means one event sent to both the Inbox and Push uses 2 of the monthly allowance.

## Vendor details

### DIY: SQLite + `web-push` + our own Inbox

- **`web-push` library**: MPL-2.0, active. 4.0.0 was published to npm on 2026-11-06 (ESM, `engines: node ">= 16"`). The previous release was 3.6.7 (2024-01-16). It generates VAPID keys, encrypts payloads and sends. Sources: https://github.com/web-push-libs/web-push, https://registry.npmjs.org/web-push
  - 4.0.0 is under two weeks old; pinning 3.6.7 or waiting is reasonable. `@types/web-push` 3.6.4 (2024-10-22) may not match v4. **Unverified.**
  - README warning: a localhost VAPID subject such as `mailto:user@localhost` can be rejected by Safari (`BadJwtToken`).
- **Standards**: RFC 8030 (Web Push protocol), RFC 8291 (message encryption), RFC 8292 (VAPID). https://www.rfc-editor.org/rfc/rfc8030
- **iPhone and iPad** (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/, https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers):
  - "with iOS and iPadOS 16.4, we are adding support for Web Push to Home Screen web apps." Safari 16 on macOS 13+ also supports it.
  - The web app must be added to the Home Screen, with a manifest whose `display` is `standalone` or `fullscreen`.
  - Permission can only be requested "in response to direct user interaction". If the person declines, iOS does not ask again for that web app (per https://documentation.onesignal.com/docs/en/web-push-for-ios.md).
  - "You don't need to join the Apple Developer Program to send web push notifications."
  - No silent push: "Safari doesn't support invisible push notifications", and Safari revokes permission if one is sent.
  - Payload limit 4 KB. The Badging API (`setAppBadge`) works for Home Screen web apps.
  - Not available on Shared iPad.
- **Cost of push services**: Apple says no paid programme is needed. FCM and Mozilla autopush are free to senders in practice, since the browser picks the endpoint and VAPID needs no account. **Unverified**: no explicit "free" statement found on the FCM or Mozilla pages.
- **Expired subscriptions**: RFC 8030 §7.3 says the push service "MUST return a 404 (Not Found)" for an expired subscription. web.dev says to delete the subscription on 404 or 410 (https://web.dev/articles/push-notifications-web-push-protocol). Apple returns "410 The device token has expired". The `web-push` README does not cover this; catch `statusCode` 404/410 and delete the row.
- **Live Inbox updates without new infra**: Server-Sent Events from the Node server, or polling / revalidating on focus. SSE is one-way, reconnects automatically, and over HTTP/1.1 shares a limit of 6 connections per browser and domain (https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events). With one Node process an in-memory map of open streams is enough; several processes would need pub/sub.
- **What we would build**: `notifications`, `push_subscriptions` and notification-settings tables in Drizzle; a manifest and service worker (`push` and `notificationclick` handlers, always calling `showNotification`); subscribe/unsubscribe, list, unread count and mark-read routes; an "Add to Home Screen" hint on iPhone; any grouping/digest as our own code.
- **Lock-in and infra**: none. Everything stays in the SQLite file plus one dependency.

### OneSignal

Source: https://onesignal.com/pricing
- Free web push: "Max 10,000 subscribers per send". The FAQ says "For web push notifications, we charge based on subscribers, and you get an unlimited volume of sends." **Unverified** whether 10,000 is a cap on total web subscribers or on each send.
- Mobile push and in-app messages unlimited "for organizations with up to 1,000 monthly active users"; that MAU count "does not include web push". Email 10,000/mo.
- Free caps: 3 active Journeys, 6 segments, 6 data tags, admin-only user permissions. CSV export, Notification History API, frequency capping and Intelligent Delivery are paid.
- **No Inbox**: OneSignal "does not currently store the history of messages sent to each individual user" and recommends storing a copy on your own server (https://documentation.onesignal.com/docs/en/create-an-activity-feed.md). OneSignal "in-app messages" are pop-up campaigns, not a feed.
- iPhone Push documented for iOS/iPadOS 16.4+ Home Screen web apps (https://documentation.onesignal.com/docs/en/web-push-for-ios.md).
- Lock-in: proprietary Web SDK and its own `OneSignalSDKWorker.js` service worker, which must be merged with ours. Subscriptions belong to the OneSignal project.
- Fit: no infra, but only covers Push; the Inbox would be DIY in SQLite anyway.

### Novu Cloud

Sources: https://novu.co/pricing, https://docs.novu.co/platform/developer/limits
- Free: "$0/month, no credit card required", "10,000 workflow runs / month", subscribers "Unlimited", "Up to 3 team members", "Up to 5 workflows", 60 events/second, all channels.
- Free limits doc: Inbox feed retention 30 days; digest window 1 day; delay 1 day; activity log 1 day.
- Branding: "Remove Novu branding" is Pro-only (from $30/mo); the toggle "is disabled on the free plan" (https://docs.novu.co/platform/inbox/prepare-for-production).
- Inbox: `@novu/react` (React 18+, React 19 supported) with bell, live unread count, mark as read, built-in preferences UI, tabs and filters (https://docs.novu.co/platform/inbox/overview). Needs an HMAC `subscriberHash` in production so subscriber IDs cannot be guessed.
- Push: providers only: FCM, Expo, APNS, OneSignal, Push Webhook, Pusher Beams, Pushpad (https://docs.novu.co/platform/integrations/push). No VAPID sending of its own.
  - Push Webhook "sends push notifications directly to a webhook URL that you control", signed with HMAC SHA256 (https://docs.novu.co/platform/integrations/push/push-webhook). That webhook could call `web-push`, which is the free route.
  - Pushpad is paid (€100/mo, trial only), so it is out.
- **Unverified**: exactly what counts as a "workflow run"; whether any Inbox or Preferences features are gated on Free (the pricing table did not render cleanly).

### Novu self-hosted

Sources: https://github.com/novuhq/novu, https://docs.novu.co/community/self-hosting-novu/overview, https://docs.novu.co/community/self-hosted-and-novu-cloud
- Licence: "core technology is fully open source, licensed under MIT license, and the enterprise code is covered under a commercial license" (the `enterprise` folder).
- Infra: API, Worker, WS and Dashboard services; MongoDB; Redis with AOF; S3-compatible storage ("10 GB minimum"). Single-VM sizing "4 vCPUs and 8 GB RAM". The community docker-compose does not include S3 and "may not be optimal for production".
- Community edition includes the Inbox, digest and preferences component. Cloud-only: snooze, translations, email activity tracking, SSO, RBAC.
- Push works the same as Cloud (providers or Push Webhook).
- Fit: poor. Adds four services plus MongoDB, Redis and S3 to an app that has one SQLite file.

### Knock

Source: https://knock.app/pricing
- Free: $0, no credit card; up to 10,000 messages/mo, where a message is "A single message delivered to a single user on a single channel". "We don't hard cap your messages"; Knock contacts you about billing. Unlimited seats, workflows and environments. Feed retention "No limit, but can be configured"; logs 30 days. Batching/digest and preferences on all plans. "Remove Knock branding": No on Free. Next tier Starter $250/mo.
- Inbox: `@knocklabs/react` (MIT SDKs) "comes pre-built with a real-time feed component": `NotificationIconButton`, `NotificationFeedPopover`, unread badge, `markAsRead` (https://docs.knock.app/in-app-ui/react/feed). "By default, Knock feeds are accessible to anyone who has the feed ID"; production needs enhanced security with a signed user token.
- Preferences: `usePreferences` hook or a hosted preference page; no prebuilt preferences component (https://docs.knock.app/in-app-ui/react/headless/preferences).
- Push: "Knock does not have a first-party web push channel." Web push goes through FCM (https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm); the tutorial's code includes the iPhone Add to Home Screen step.
- **Unverified**: whether the push channel is included on Free ("Unlimited delivery channels" does not name push); where the Knock branding renders.

### Courier

Sources: https://www.courier.com/pricing, https://www.courier.com/docs/workspaces/billing
- Free ("Developer"): "10,000 sends per month". "One send is one template sent to one recipient", so a multi-channel send counts once; undelivered and preference-blocked sends also count. Above that you need the Business plan ($0.005 per send from the first one, card required). No per-seat fees.
- Inbox: `@trycourier/courier-react` v9 (MIT); "Messages arrive in real time", unread badges, read and archive (https://www.courier.com/docs/platform/inbox/inbox-overview).
- Preferences: embeddable React component or hosted page, enforced on every send (https://www.courier.com/docs/in-app/preference-center). Digest via an "Add to Digest" step.
- Push: "Courier sends push through the providers you connect, such as APNs, Firebase Cloud Messaging (FCM), Expo, or OneSignal" (https://www.courier.com/docs/integrations/push/overview). No built-in VAPID sender.
- **Unverified**: whether Inbox, Preferences or Digest are gated on Developer (the plan table did not render); branding; retention.

### SuprSend

Source: https://www.suprsend.com/pricing
- Free: "$0/month", "No Credit Card required", "10k Notifications/mo", "Unlimited Team Members", "Unlimited Channels", "In-app notification feed (with SuprSend branding)", logs 30 days. Each channel counts as a separate notification. Going over does not stop sending; they contact you.
- **"Batching & Digest" and "User Preferences" are Business plan only ($250/mo).** New accounts get a 30-day all-features trial, then drop to Free.
- Inbox: `@suprsend/react` (MIT) with bell, badge, mark all read, tabs, live socket (https://docs.suprsend.com/docs/react-in-app-feed).
- Web Push: native. "SuprSend generates the VAPID key pair for you. The private key stays in SuprSend" (https://docs.suprsend.com/docs/web-push-quick-start). We host a `serviceworker.js` that loads their SDK.
- Lock-in: because SuprSend holds the VAPID private key, leaving means every subscriber re-subscribes.
- **Unverified**: iPhone Home Screen support in their docs (docs list "Safari (macOS)"; iOS 16.4+ is claimed only on their blog); whether Web Push is explicitly on Free.

### MagicBell

Source: https://www.magicbell.com/pricing
- Free ("Builder"): $0, "1,000 Deliveries/mo.", "1 Project", "Unlimited Team Members", "Unlimited Users". Deliveries add up across channels, so Inbox + Push per event leaves about 500 events/mo. Overage "charged per use". Next tier Startup $249/mo.
- Inbox: `@magicbell/react` with `Inbox`, `FloatingInbox`, `UserPreferences` (per-category channel toggles) (https://www.magicbell.com/docs/libraries/magicbell-react). Real-time via a persistent connection (https://www.magicbell.com/docs/channels/in_app).
- Web Push: `WebPushButton`, with a `requestInstallLabel` "to show when the app needs to be installed as a PWA (iOS requirement)". Uses our own VAPID keys, so subscriptions could in principle move with us (https://www.magicbell.com/docs/channels/web_push).
- Lock-in: the JS SDK uses a proprietary licence that bans redistribution (https://raw.githubusercontent.com/magicbell/magicbell-js/main/LICENSE); notification data hosted by MagicBell.
- **Unverified**: retention, branding, digest, credit-card requirement and hard-stop behaviour on Builder.

### Firebase Cloud Messaging (Push only)

- "No-cost" on the Spark plan (https://firebase.google.com/pricing); no send limits listed there (**Unverified** quotas).
- The JS SDK support table marks Cloud Messaging "iOS Safari: Yes" (https://firebase.google.com/docs/web/environments-js-sdk).
- Needs `firebase-messaging-sw.js`, a VAPID key from the Firebase console and HTTPS (https://firebase.google.com/docs/cloud-messaging/js/client).
- No Inbox, settings or digest. Adds a Google dependency over plain VAPID for little gain, but is the route Knock and Courier use for web push.

### Considered and rejected

- **Pusher Beams**: free Sandbox of 1,000 subscribers, but its Safari docs say "Safari does not support Web Push Notifications on iOS or iPadOS devices", and Safari needs a paid Apple Developer certificate (https://pusher.com/docs/beams/getting-started/web/configure-safari/). No Inbox.
- **Engagespot**: engagespot.co and its pricing page returned HTTP 404 on 2026-11-12; its React package was last published 2025-05-09. Free-tier numbers only on aggregator sites. Too risky.
- **ntfy**: pushes to the ntfy app or ntfy's own PWA, not Cadence's own site (https://docs.ntfy.sh/subscribe/pwa/). No in-app Inbox.
- **Gotify, Apprise**: not checked against sources. Gotify is a self-hosted server with its own client app; Apprise is a library for sending to other services. Neither gives Web Push from Cadence's own site or an in-app Inbox.

## Which options look viable for free

1. **DIY**: covers everything with no limits, lock-in or new infra; costs build time for the Inbox UI, settings and grouping.
2. **Hosted Inbox (Novu Cloud or Knock free) + DIY or FCM Push**: prebuilt real-time Inbox and settings on about 10,000 messages/mo, with vendor branding and data outside SQLite. Push still needs FCM or our own `web-push` code (Novu's Push Webhook makes the latter clean).
3. **OneSignal for Push + DIY Inbox**: offloads Push only; adds a proprietary SDK and service worker for something `web-push` does directly.
4. **Less suitable on free**: SuprSend (no settings or digest on free; vendor holds VAPID keys), MagicBell (1,000 deliveries/mo), Courier (Push needs a third vendor; plan gating unverified), self-hosted Novu (MongoDB + Redis + S3 + 4 services).

## Not verified

- OneSignal: whether 10,000 is a total web-subscriber cap or per send on Free.
- Novu: definition of a "workflow run"; Free gating of Inbox/Preferences features.
- Knock: whether push is on Free; where branding appears.
- Courier: Free gating of Inbox, Preferences and Digest; branding; retention.
- SuprSend: iPhone support in official docs; Web Push explicitly on Free.
- MagicBell: retention, branding, digest, overage behaviour.
- FCM send quotas; explicit "free" statements for FCM and Mozilla autopush.
- Whether `@types/web-push` 3.6.4 matches `web-push` 4.0.0.
- Apple's 2024 EU Home Screen web app reversal: only press reports and a forum post, no Apple page (https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/).
