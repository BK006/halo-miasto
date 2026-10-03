#!/bin/sh
# npm replaces the node_modules symlink with a real dir on install.
# Move it back into node_modules.nosync so iCloud leaves it alone. Safe to run anytime.
set -e
# Only needed on a local iCloud-synced Mac; never touch deps on CI/Vercel.
[ -n "$CI$VERCEL" ] && exit 0
cd "$(dirname "$0")/.."
if [ -d node_modules ] && [ ! -L node_modules ]; then
  rm -rf node_modules.nosync
  mv node_modules node_modules.nosync
  ln -s node_modules.nosync node_modules
  echo "node_modules moved to node_modules.nosync"
else
  echo "node_modules already linked – nothing to do"
fi
