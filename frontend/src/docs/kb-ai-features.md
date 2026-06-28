# KB AI Features — How It Works

Covers the two AI features built on top of the Knowledge Base:

1. **AI Learning** — scans resolved tickets and completed tasks, proposes new articles or updates to existing ones.
2. **Ask AI** — grounded Q&A for signed-in agents/admins on article pages and a side-panel.

Both are off-by-default and admin-gated.

---

## AI Learning

### What it does

Reads recent resolved tickets and completed tasks, finds recurring questions or issues, then asks Gemini to draft either a brand-new KB article or an update to the closest-matching existing one. Nothing is ever published automatically — every proposal lands in the **AI Suggestions** queue for admin review.

### Where it lives

- **Settings:** `/config/knowledge-base` → *AI & Learning* card.
- **Queue:** `/knowledge/ai-suggestions` (admin-only tab, hidden when the master toggle is off).
- **Backend service:** `tenant/services/ai/kb_learning.py` (`KBLearningService.run()`).
- **Trigger endpoint:** `POST /kb/ai-suggestions/generate/`.

### The settings, explained

| Setting | Default | What it controls |
|---|---|---|
| `enable_ai_learning` | off | Master switch. When off, nothing runs. |
| `ai_learning_scope` | `disallowed` | `all` = any ticket/task may inform the KB. `published_only` = only resolved/closed items. `disallowed` = dry run (reserved for future use). |
| `ai_learn_from_tickets` | off | Pull from tickets with status `resolved` or `closed`. |
| `ai_learn_from_tasks` | off | Pull from tasks with `task_status='completed'`. |
| `ai_auto_draft_new_articles` | off | Allow proposals of brand-new articles. |
| `ai_auto_suggest_updates` | off | Allow proposals that update an existing article (creates a new version). |
| `ai_require_approval` | on | Currently always treated as on — suggestions always sit in the queue. Left here for a future "auto-publish above confidence X" mode. |
| `ai_min_tickets_before_learning` | 5 | A topic cluster must contain at least this many source items before a proposal is drafted. |

### Data flow, step by step

1. **Gate checks.** The service returns immediately with a `skipped_reason` if the master toggle is off, if no sources are enabled, or if both outputs are disabled.
2. **Collect sources.** For the past 30 days, pull resolved/closed tickets and/or completed tasks. Skip items with fewer than 80 combined characters of title + body.
3. **Dedup.** Skip any ticket/task whose id already appears in the `source_refs` of any prior `KBAISuggestion` for this business. This prevents re-processing the same items across runs.
4. **Cluster.** Bucket sources by ticket category (or task department) with a fallback `general` bucket. The LLM does the real grouping inside each prompt — this step just keeps prompts topical.
5. **Threshold.** Drop any cluster with fewer items than `ai_min_tickets_before_learning`. The queue is intentionally sparse — one-off tickets aren't worth an article.
6. **Existing match?** For each surviving cluster, run a semantic search against current articles using the concatenated titles. If the best hit scores ≥ 0.6 **and** `ai_auto_suggest_updates` is on, draft an update. Otherwise, if `ai_auto_draft_new_articles` is on, draft a new article.
7. **Gemini call.** Strict JSON schema (`title`, `slug`, `excerpt`, `content`, `tags`, `confidence`). Code-fence wrappers are stripped if the model adds them.
8. **Usage gate.** Check the business's monthly AI token cap before making Gemini calls. If the cap is exhausted and overage is off, the endpoint returns `402` instead of spending more tokens.
9. **Persist.** Write a `KBAISuggestion` row in `review_status='pending'` with the proposed content, the source ticket/task refs (ids + truncated titles), the model used, and token usage.
10. **Usage ledger.** Record the provider call in `AIUsageEvent` with feature, model, input/output tokens, estimated cost, and billable overage tokens if overage is enabled.

Failures at any step are logged, not fatal — a flaky search index or a single bad Gemini response doesn't abort the whole run.

### The approval flow

From `/knowledge/ai-suggestions`, admins see each proposal as a card with:

- Kind badge: **New article** or **Update**.
- Source count (tickets + tasks).
- Confidence percentage (0–100%).
- For updates: "Proposes v4 · live is v3" indicator.

Three actions per card:

- **Approve** — publishes a new article (for `new_article`) or bumps the target article's version (for `update_article`, preserving the previous content in `previous_version_data`). The current live version stays served until the new one is published.
- **Edit first** — opens the article editor pre-filled with the proposal. Admin can tweak before saving.
- **Dismiss** — moves the suggestion to `rejected`, optionally with a reason. Rejected items stay in the DB (so the dedup check still applies) but disappear from the queue.

### Manual trigger ("Generate now")

There's a **Generate now** button on the AI Suggestions page (admin-only, visible when AI Learning is enabled). It calls `POST /kb/ai-suggestions/generate/` synchronously.

Use it when:

- Testing the end-to-end flow on staging.
- You just enabled AI Learning for the first time and want to backfill from the last 30 days without waiting for the scheduled run.
- You've closed a batch of tickets on a new topic and want the AI to propose an article now, not tomorrow.

**Heads up:** the call is blocking and can take 5–30 seconds depending on how many clusters produce proposals. Leave the page open until the toast fires. The response summarizes what happened — `generated_count`, `sources_considered`, `clusters_below_threshold`, or a `skipped_reason` if the run bailed early.

### Scheduled runs

**Not yet wired.** The service is ready to call from a management command or Celery task, but nothing schedules it automatically. For now, admins use **Generate now** manually. When scheduling lands, it should iterate over businesses with `enable_ai_learning=true` and run once per business per day.

### AI usage caps and billing handoff

Backend accounting is handled by:

- `AIUsagePolicy` — one per business. Stores the included monthly token cap, hard-cap behavior, overage toggle, and overage price per 1k tokens.
- `AIUsageEvent` — append-only ledger for provider calls. Stores feature (`kb_learning`, `kb_ask`, `kb_embedding`), operation, model, token counts, estimated provider cost, and billable overage.
- `GET /kb/ai-usage/` — admin-only current-month usage summary.
- `PATCH /kb/ai-usage/` — admin-only policy update endpoint.
- `/knowledge/ai-suggestions` — shows the current-month usage meter above the queue: used tokens, included cap, remaining tokens, estimated provider cost, overage status, and a breakdown by feature.

Default policy for a business is:

- `monthly_token_cap=1,000,000`
- `hard_cap_enabled=true`
- `overage_enabled=false`
- `overage_price_per_1k_tokens_usd=0.002`

This is not yet connected to Stripe invoicing. The intended billing handoff is: invoice base subscription normally, then consume `AIUsageEvent.billable_overage_*` rows for the billing period and add them as metered/overage line items.

### Troubleshooting

- **"No new patterns found this time"** — nothing in the last 30 days passed the `ai_min_tickets_before_learning` threshold. Either lower the threshold, close more tickets on a single topic, or just wait.
- **"No new tickets or tasks to learn from since the last run"** — the dedup check caught every candidate. They've all appeared in a prior suggestion's `source_refs`.
- **"AI learning is off. Enable it under Settings → Knowledge Base → AI & Learning."** — self-explanatory. Check the toggle actually saved (see below).
- **Toggles revert after saving** — see Known issues. The root cause (backend role check rejecting non-`admin` roles) was fixed in April 2026; if this happens again, check the browser console for a failure message on `/kb/settings/` POST.
- **Suggestions aren't appearing** — verify in order: (1) `enable_ai_learning=true` for the business, (2) at least one of `ai_learn_from_tickets` / `ai_learn_from_tasks` is on, (3) at least one of `ai_auto_draft_new_articles` / `ai_auto_suggest_updates` is on, (4) `GEMINI_API_KEY` is set in the Django environment, (5) the business has not reached its monthly AI token cap, (6) there are enough recent resolved tickets to clear the threshold.

---

## Ask AI

### What it does

A side-panel that lets signed-in agents/admins ask questions about the knowledge base and get a grounded answer with source citations. **It is not exposed to public/anonymous visitors** — the customer-facing chatbot is a separate product with its own configuration.

### Where it lives

- **Entry point:** universal header **Ask AI** button. The older article-page floating Ask AI panel was removed to avoid two competing assistant surfaces.
- **Backend service:** `tenant/services/ai/kb_ask.py` (`KBAskAIService.answer()`).
- **Endpoint:** `POST /kb/ask-ai/`.

### Request shape

```json
{ "query": "How do I reset a user's password?", "article_slug": "password-reset" }
```

`article_slug` is optional — when present, that article is pinned as the first context source regardless of search score.

### Response shape

```json
{
  "answer": "...markdown prose grounded in the sources...",
  "references": [{ "title": "Password reset", "slug": "password-reset", "excerpt": "..." }],
  "model": "gemini-...",
  "prompt_version": "kb-ask-v1",
  "used_article_ids": [123, 456],
  "input_tokens": 842,
  "output_tokens": 211
}
```

### Context gathering, step by step

1. **Pin article.** If `article_slug` is provided and resolvable for the user's business, it goes in first.
2. **Semantic search.** Use `KBSearchService` (pgvector) to find up to 5 articles the user is allowed to see.
3. **Text fallback.** If semantic search returns nothing (e.g. embeddings not generated yet), fall back to `Q(title__icontains=term) | Q(content__icontains=term)` on the tokenised query.
4. **Trim.** Each article body is truncated to 2500 characters before being fed into the prompt.

### The prompt

System instruction is strict: *answer only from the sources, never invent, and list article titles under "Sources:"*. If Gemini ignores the JSON schema or fails entirely, the service returns the relevant article titles without a generated answer so the UI can still show something useful instead of an error.

### Why there's no on/off toggle

Ask AI is an internal agent/admin tool. It's not shown to public visitors. We deliberately removed the `enable_ask_ai` setting in April 2026 because it was redundant (the visibility is already controlled by auth status) and confusing (admins kept conflating it with the public chatbot). If a business doesn't want agents using Ask AI, don't configure a `GOOGLE_GENAI_API_KEY` — the endpoint will return the fallback "no answer, here are some relevant titles" response instead of erroring.

---

## Known issues

- **KBSettings multi-tenancy fix (migration 0056)** must be applied before any business can save KB settings. Before this migration, `KBSettings.key` had a global `unique=True` that broke every tenant except the first. Run `python manage.py migrate tenant` on every environment.
- **Role check previously too strict.** The `create()` and `update()` handlers on `KBSettingsViewSet` used to accept only literal role name `admin` and 403'd users with role `owner` / `super_admin` / `superuser`. Fixed April 2026 to accept all admin-ish roles via `_is_kb_admin()`.
- **value_type mismatch.** Frontend used to send `value_type: 'number'`, which isn't in the model's `SETTING_TYPES` choices, causing serializer validation to reject integer settings (`articles_per_page`, `ai_min_tickets_before_learning`) with a 400 that got silently swallowed. Fixed April 2026 — use `'integer'` to match the model.
- **Scheduled learning runs** are not yet implemented. Admins rely on the **Generate now** button for now.
- **Auto-publish above confidence X** is not yet implemented. `ai_require_approval` is effectively always on.
