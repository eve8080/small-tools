# Implementation Brief — PR #3 BTC price in USD

## Context

GitHub PR #3 (`kennethshso:btc-price-usd` into `eve8080:main`) adds `usd_hkd` to `/api/crypto` and converts the BTC card's live HKD price to USD. The initial PR passed the existing test, lint, typecheck, and build commands, but independent review found a blocking partial-upstream failure in the CoinPaprika path.

## Required fix

In `worker.js`, make USD/HKD derivation resilient to incomplete or malformed CoinPaprika data:

- Validate the BTC `quotes.USD.price` and `quotes.HKD.price` components before division.
- Accept only finite positive numeric components and expose only a finite positive `usd_hkd`.
- If either component is missing, zero, negative, non-numeric, non-finite, or otherwise unusable, continue returning the otherwise-valid crypto market data with `usd_hkd: null` instead of failing `/api/crypto`.
- Preserve existing top/held/global behavior and the frontend's HKD fallback.
- Apply an equivalent finite-positive output contract to the CoinGecko rate calculation if needed, without turning optional exchange-rate failure into endpoint failure.

## Deployment hotfix — Cloudflare upstream fallback

Live verification after merging PR #3 found that the AWS deployment serves `/api/crypto?symbols=` successfully, but CoinPaprika returns HTTP 402 to the Cloudflare Worker egress, leaving the Cloudflare home-page crypto card unavailable immediately after deployment.

Implement a narrow production fallback in `worker.js`:

- Keep CoinPaprika/CoinGecko as the primary upstream and preserve the existing Worker cache behavior.
- Only when primary crypto loading fails and the Cloudflare-only `env.ASSETS` binding is present, request the already deployed AWS API at `https://d22qpfwiw6tc.cloudfront.net/api/crypto` with the same validated symbol list.
- Do not use the AWS fallback when running inside AWS Lambda, preventing recursion.
- Accept the fallback only for an HTTP-success response with the complete expected crypto JSON shape; otherwise retain the existing stale-cache or 502 behavior. Validate every coin entry's required identifiers and finite numeric price, plus the nested global fields consumed by the frontend, so malformed HTTP-200 data cannot replace valid stale data.
- Detect Cloudflare by requiring an actual `env.ASSETS.fetch` function, not merely a truthy value, preventing accidental recursion from an unrelated Lambda environment variable.
- Bound the AWS fallback request with an explicit timeout/abort signal so a stalled fallback cannot consume the remaining Worker execution window.
- Cache a successful fallback response exactly like a primary response.
- Add tests for successful Cloudflare fallback, fallback failure, stale-cache precedence/behavior, and proof that AWS/Lambda does not call itself.
- Do not modify frontend behavior, dependencies, secrets, or unrelated features.

## Tests

Add focused tests covering the CoinPaprika path with unusable FX components, including at minimum a missing USD quote and zero or invalid values. Assert that:

- `/api/crypto` still returns HTTP 200 when market data remains usable.
- `usd_hkd` is `null` for unusable inputs.
- Valid inputs still return approximately `7.8`.
- Existing stale-cache and frontend fallback behavior remain passing.

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Boundaries

- Do not change dependencies.
- Do not refactor unrelated code or alter other tools.
- Do not expose or edit production secrets.
- Do not commit, push, merge, or deploy; Eve performs those actions after independent verification.

## Completion criteria

- The partial CoinPaprika response reproduced by review no longer returns 502.
- New regression tests fail on the original PR revision and pass after the fix.
- All required verification commands pass.
- The resulting diff is limited to this fix, its tests, and the required project context documents.
