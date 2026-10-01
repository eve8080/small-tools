# Small Tools — Claude project context

## Purpose and architecture

- React 19 + TypeScript + Vite PWA providing a dashboard of small utilities.
- Frontend features live under `src/features/` and call same-origin `/api/*` routes.
- `worker.js` implements the Cloudflare Worker API and is also executed on AWS Lambda through `lambda.js`.
- Production is deployed to both Cloudflare Workers and AWS (S3 + CloudFront + Lambda). Read `README.md`, `wrangler.jsonc`, and `deploy-aws.sh` before changing deployment behavior.

## Source of truth

- Application source: `src/`, `worker.js`, `lambda.js`, and root configuration files.
- Tests: `*.test.ts`, `*.test.tsx`, and `worker.test.js`.
- Generated `dist/` files are build output; do not hand-edit them.
- `IMPLEMENTATION_BRIEF.md` records the active implementation and acceptance criteria.

## Required verification

Run all of these before declaring code ready:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

For API changes, also add or update `worker.test.js` coverage and verify failure/fallback behavior.

## Coding and security boundaries

- Keep TypeScript strict and preserve existing formatting/style.
- Never add credentials, API keys, passwords, tokens, `.env` contents, or generated dependency/build artifacts to Git.
- Validate external API data before arithmetic or serialization; a partial upstream response must degrade gracefully when a fallback is documented.
- Preserve existing API compatibility unless the brief explicitly requires a breaking change.
- Do not modify unrelated features or dependencies.

## Git and deployment

- Do not commit, push, merge, or deploy unless Eve explicitly authorizes that exact action.
- Deployment is an external production write and requires explicit approval.
- When deployment is approved, commit first, deploy the committed revision, then probe the live API and UI.
- AWS production URL: `https://d22qpfwiw6tc.cloudfront.net`.
