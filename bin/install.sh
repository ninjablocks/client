#/bin/sh

set -e

echo "Updating driver sub modules"
git submodule init
git submodule update
npm install

echo "Installing NPM dependencies for drivers"
for f in `ls -1 drivers`;
do
  pushd drivers/$f
  npm install --force
  popd
done

echo "All done!"
