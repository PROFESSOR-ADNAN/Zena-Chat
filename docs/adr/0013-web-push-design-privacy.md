# ADR 0013: Web Push Notifications and Privacy-Preserving Payloads

## Context
Mobile users outside Addis Ababa frequently close browser tabs or have their background connections killed by mobile OS battery savers. They need to be notified of incoming messages without compromising message privacy.

## Decision
1. Implement Web Push via standard W3C Push API using VAPID keys (`web-push` library).
2. Push jobs are enqueued via BullMQ only when a recipient has **zero active socket connections** across all gateway replicas.
3. **Privacy**: Push notification payloads contain minimal metadata by default: `{ title: "New message from @username", conversationId: "..." }`. No message text is transmitted over third-party push services (Google FCM / Apple APNs) unless user explicitly opts into "Message Previews in Notifications".
4. Subscriptions returning HTTP 404 or 410 (Gone) are immediately deleted from MongoDB.

## Alternatives Considered
- **Sending push on every message regardless of socket status**: Results in duplicate notifications for users actively chatting on their desktop or phone.
- **Including full message text in push payload**: Violates privacy guidelines since push service providers (FCM, Apple) can inspect payloads.

## Consequences
- **Positive**: Privacy-preserving; battery-friendly; eliminates push notification spam when user is actively online.
- **Negative**: iOS Web Push requires the PWA to be explicitly added to the Home Screen ("Add to Home Screen" prompt), which is communicated clearly in the UI.
