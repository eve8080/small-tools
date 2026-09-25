#!/usr/bin/env bash
# Deploys to AWS: the SPA to S3 (served by CloudFront) and the /api/* Worker code to Lambda.
# Run via `npm run deploy:aws`, which builds first. Uses the agent-dev profile unless AWS_PROFILE is set.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-agent-dev}"
BUCKET=agent-dev-public-site-10130a94
FUNCTION=small-tools-api
DISTRIBUTION=E2HP2M446HG91I

# Hashed assets never change, so they can be cached for a year; everything else must revalidate.
aws s3 sync dist/assets "s3://$BUCKET/assets" --cache-control "public,max-age=31536000,immutable" --only-show-errors
aws s3 sync dist "s3://$BUCKET" --exclude "assets/*" --cache-control "no-cache" --delete --only-show-errors

pkg=$(mktemp -d)
trap 'rm -rf "$pkg"' EXIT
cp worker.js lambda.js "$pkg/"
echo '{"type":"module"}' > "$pkg/package.json"
(cd "$pkg" && zip -q api.zip worker.js lambda.js package.json)
aws lambda update-function-code --function-name "$FUNCTION" --zip-file "fileb://$pkg/api.zip" --output text --query LastUpdateStatus

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" --output text --query Invalidation.Id
echo "Deployed to https://d22qpfwiw6tc.cloudfront.net"
