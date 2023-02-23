#!/bin/bash
set -eou pipefail

# Update these numbers for our first real test, then leave consistent for all test cases
VUS=50
DURATION=5m

# log the date before and after so we know what to look for in new relic
date -u

k6 run woo-checkout.js  --vus="${VUS}" --duration="${DURATION}" --env SITE_URL=https://live-pasta-la-vista.pantheonsite.io/

date -u

# TODO: Do we want different durations or vus for this one?
k6 run woo-customer.js  --vus="${VUS}" --duration="${DURATION}" --env SITE_URL=https://live-pasta-la-vista.pantheonsite.io/

date -u