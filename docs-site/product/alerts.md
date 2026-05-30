# Alerts

Alerts let you define rules that fire automatically when a token's social buzz, sentiment, or price crosses a threshold you set. Triggered alerts land in an in-app inbox.

## Creating an alert rule

1. Go to **Alerts** in the sidebar (or navigate to `/alerts`).
2. In the **New rule** form at the top of the page, fill in:
   - **Symbol** — the token to watch (e.g. `PEPE`).
   - **Condition** — what should trigger the alert (see below).
   - **Threshold** or **Target** — the condition-specific value.
3. Click **Create alert**.

The new rule appears immediately in the **Active rules** list below the form.

## Alert conditions

### Buzz spike

Fires when the token's mention volume increases by at least the threshold percentage within the monitoring window.

- Set **Threshold %** to the minimum percentage increase that should trigger the alert (e.g. `100` means a 100% / 2× spike).

### Sentiment flip

Fires when the prevailing sentiment classification for the token changes.

- Set **Target sentiment** to the sentiment you want to detect: **Any** (fire on any flip), **Bull** (fire only when sentiment turns bullish), or **Bear** (fire only when sentiment turns bearish).

No threshold percentage is needed for sentiment flips.

### Price move

Fires when the token's price changes by at least the threshold percentage in either direction.

- Set **Threshold %** to the minimum move size (e.g. `10` means a 10% price swing).

## Managing rules

The **Active rules** list shows every rule you have created. For each rule you can:

- **Toggle enabled / disabled** — use the toggle switch on the right of the row to pause a rule without deleting it. A paused rule does not fire.
- **Delete** — click the × icon to permanently remove the rule.

## Alert inbox

The **Inbox** section below the rules list shows a history of every time your rules have triggered. Each item shows:

- A blue dot if the notification is unread.
- The trigger message describing what happened and by how much.
- A relative timestamp.

Clicking an inbox item marks it as read and navigates to the relevant page (e.g. the Movers page or the Live Feed filtered to that token).

Click **Mark all read** in the inbox header to clear all unread indicators at once.

## Email notifications

By default, alerts are delivered in-app only. To also receive an email when a rule fires, go to **Account → Notifications** and enable **Email me when an alert triggers**.
