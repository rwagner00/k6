#!/bin/bash
set -eou pipefail

SITE_ID="${1:-}"
ENV="${2:-}"

for USR_NO in {1..100}; do
	terminus remote:wp ${SITE_ID}.${ENV} -- user create "test${USR_NO}" "test${USR_NO}@example.com" --role=subscriber --user_pass=3405691582;
	sleep 1
done;
