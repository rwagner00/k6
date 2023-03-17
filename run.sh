#!/bin/bash
set -eou pipefail

# Update these numbers for our first real test, then leave consistent for all test cases
VUS=50
DURATION=15m

while [[ $(date +%S) -gt 0 ]]
do
    sleep 1
done

# log the date before and after so we know what to look for in new relic
date -u

k6 run woo-checkout.js  --vus="${VUS}" --duration="${DURATION}" --env SITE_URL=https://live-pasta-la-vista.pantheonsite.io/
echo "Test complete at: "
date -u
# Give the site 30 seconds to cool down and then start the test on the next full minute.
echo "Checkout Test complete. Starting Customer test in 30s at the next whole minute."
sleep 30
while [[ $(date +%S) -gt 0 ]]
do
    sleep 1
done

date -u

# TODO: Do we want different durations or vus for this one?
k6 run woo-customer.js  --vus="${VUS}" --duration="${DURATION}" --env SITE_URL=https://live-pasta-la-vista.pantheonsite.io/

date -u
