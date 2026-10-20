---
title: "Slack Integration Setup"
description: "Create and configure a Slack app for SafariDesk's Slack-to-ticket integration, including the scope and Socket Mode pitfalls that silently break event delivery"
---

# Slack Integration Setup

SafariDesk can turn Slack messages into tickets and post ticket updates back into Slack threads. The integration itself (OAuth connect, signed webhook, ticket creation) works out of the box, but Slack's own app configuration has several steps that fail silently if done in the wrong order. This guide exists because every one of these was hit and debugged the hard way — follow it in order.

Related pages:

- [Configuration](./configuration.md)
- [Troubleshooting](./troubleshooting.md)

---

## 1. Create the Slack app

Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From an app manifest**, and paste:

```json
{
    "display_information": {
        "name": "your-app-name"
    },
    "features": {
        "app_home": {
            "home_tab_enabled": true,
            "messages_tab_enabled": false,
            "messages_tab_read_only_enabled": true
        },
        "bot_user": {
            "display_name": "your-app-name",
            "always_online": true
        }
    },
    "oauth_config": {
        "redirect_urls": [
            "https://YOUR_API_DOMAIN/api/v1/integrations/slack/callback/"
        ],
        "scopes": {
            "bot": [
                "channels:read",
                "channels:history",
                "chat:write",
                "groups:read",
                "chat:write.public",
                "channels:join",
                "im:read",
                "mpim:read"
            ]
        }
    },
    "settings": {
        "event_subscriptions": {
            "bot_events": [
                "message.channels"
            ],
            "request_url": "https://YOUR_API_DOMAIN/api/v1/integrations/slack/events/webhook/"
        },
        "socket_mode_enabled": false
    }
}
```

Replace `YOUR_API_DOMAIN` with your backend's public domain in both places. Using the manifest avoids the pitfalls below — building the app by clicking through the UI tab by tab is how most of these get missed.

If you build it manually instead of via manifest, you must replicate every value in that JSON exactly, across the **Socket Mode**, **OAuth & Permissions**, and **Event Subscriptions** pages.

---

## 2. Get your app credentials

**Basic Information → App Credentials**, copy:

- Client ID → `SLACK_CLIENT_ID`
- Client Secret → `SLACK_CLIENT_SECRET`
- Signing Secret → `SLACK_SIGNING_SECRET`

Set these in your `.env` (see [Configuration](./configuration.md)).

## 3. Set `SLACK_OAUTH_SCOPES` — this is the step that gets missed

```
SLACK_OAUTH_SCOPES=channels:read,channels:history,groups:read,chat:write,users:read,chat:write.public,channels:join,im:read,mpim:read
```

**This is the single most important line in this guide.** SafariDesk's "Connect Slack" button builds its own OAuth authorize URL using this env var — it does **not** use Slack's own "Install App" button, which is the only place Slack auto-adds scopes required by your configured events. If `channels:history` is missing from this list, every customer who connects through SafariDesk's own UI will get a token that can never receive `message.channels` events — **no error, no log line, nothing arrives at the webhook at all.** Slack's UI will still show the event as "subscribed" the whole time, which makes this look like a Slack-side bug when it is actually a scope mismatch between what Slack's dashboard shows and what your server actually requests.

Restart the backend after changing this (`docker compose up -d --force-recreate` for the API/worker services — a plain `restart` does not reread `.env`).

---

## 4. Leave Socket Mode off

Do not enable **Socket Mode**. If it's on, Slack delivers all events over a WebSocket connection instead of HTTP POSTs to your Request URL, and SafariDesk's webhook (`SlackWebhookView`) only implements the HTTP path. With Socket Mode on, the Request URL still verifies successfully (that's a one-time handshake), but no live events ever arrive afterward — same silent-failure shape as the missing scope above.

---

## 5. Install (or reinstall) the app

**Install App** → Install to Workspace. If you add or change any event or scope *after* an install, you must reinstall — an existing install does not retroactively pick up new permissions.

---

## 6. Connect from SafariDesk

In SafariDesk's integration settings, click **Connect Slack**. This performs the real OAuth exchange and stores the token per business. On success, every **public** channel the bot can see is automatically joined — no manual `/invite` needed for those.

**Private channels can never be auto-joined** — this is a Slack platform restriction with no workaround; invite the bot manually (`/invite @your-bot-name`) in any private channel you want it to watch.

---

## 7. Installing into other workspaces

By default a Slack app can only be installed into the workspace it was created in. To let other workspaces (other SafariDesk tenants) install it, go to **Manage Distribution** and activate **Public Distribution**. This requires:

- OAuth redirect URL configured (done in step 1)
- HTTPS on all URLs (already true)
- Checking "I've reviewed and removed any hard-coded information" (true for SafariDesk — every token is obtained per-business via real OAuth, nothing hardcoded)

> **Known Slack-side issue:** `Activate Public Distribution` can fail with a generic error whose network response shows `x-slack-failure: ratelimited`. This has been observed to persist far longer than Slack's documented ~1 day reset, is unrelated to any SafariDesk configuration, and has no confirmed client-side workaround — it requires contacting Slack Support. You do not need distribution active to test or use the integration within the app's own home workspace.

---

## Verifying it's actually working

A confirmed-good setup looks like this:

1. Connect Slack → integration row appears with a real `team_id` and `bot_user_id`.
2. `GET` the app's granted scopes (or check the stored integration record) and confirm `channels:history` is present. If it isn't, step 3 above wasn't applied before connecting — fix the env var, restart, disconnect, reconnect.
3. Send a message in a public channel → a ticket should appear with `source = slack` within a few seconds.
4. If nothing happens, see [Troubleshooting → Slack Events Not Creating Tickets](./troubleshooting.md#slack-events-not-creating-tickets) before assuming it's a bug in the application code — in practice it has always been one of the three issues above.
