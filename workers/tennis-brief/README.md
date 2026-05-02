# Tennis Brief

Cloudflare Worker that emails Matt & Lauren a daily ATP/WTA tennis brief.
Fires at 11:30 UTC (6:30am CDT) every day. Calls Claude with web search; if
there's nothing tour-level happening, Claude returns `SKIP` and no email is
sent. Otherwise the brief goes out via Resend to both addresses.

## Deploy

From this directory:

```sh
npx wrangler deploy
```

First deploy needs three secrets set:

```sh
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TRIGGER_SECRET    # any long random string; used by /trigger
```

## Test-fire

Once deployed, hit the manual trigger route. The Worker URL is printed on
deploy, typically `https://tennis-brief.<your-account>.workers.dev`:

```sh
curl -X POST https://tennis-brief.<account>.workers.dev/trigger \
  -H "X-Trigger-Secret: <the secret you set above>"
```

Returns JSON with `status: "sent"` (and the Resend message id) or
`status: "skipped"`. Errors return 500 with the message in the body.

## View logs

```sh
npx wrangler tail
```

Each run logs `[tennis-brief] run start`, `sent id=...`, or `cron failed: ...`.

## Change recipients

Edit `RECIPIENTS` at the top of `src/index.js` and redeploy.

## Disable

Easiest: comment out the `[triggers]` block in `wrangler.toml` and redeploy.
Or delete the worker entirely:

```sh
npx wrangler delete
```

## TODO before this becomes routine

- Set up a real sender domain in Resend and replace `FROM` in `src/index.js`.
  Currently using `onboarding@resend.dev`, which is fine for testing but
  Resend rate-limits it and Gmail will eventually start filtering it.
