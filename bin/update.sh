#/bin/sh
git pull
git fetch --recurse-submodules=yes
git submodule init
git submodule update
npm install
for f in drivers/*;
  do cd $f;
  npm install --force;
  cd ../..;
done
