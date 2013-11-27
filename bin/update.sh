#/bin/sh

set -e

echo "Pulling down changes"
git pull

echo "Updating driver sub modules"
git fetch --recurse-submodules=yes
git submodule init
git submodule update

echo "Installing NPM dependencies"
npm install --force

echo "Installing NPM dependencies for drivers"

for f in `ls -1 drivers`;
do
  $(cd drivers/$f && npm install --force);
done

echo "All done!"