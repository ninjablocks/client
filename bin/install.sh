#/bin/sh

set -e

echo "Updating driver sub modules"
git submodule init
git submodule update
npm install

echo "Installing NPM dependencies for drivers"
for f in `ls -1 drivers`;
do
  $(cd drivers/$f && npm install);
done

echo "All done!"