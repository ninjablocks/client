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
  pushd drivers/$f
  npm install --force
  popd
done

echo "All done!"
