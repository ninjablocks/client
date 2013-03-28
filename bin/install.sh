#/bin/sh
git submodule init
git submodule update
npm install
for f in drivers/*;
  do cd $f;
  npm install;
  cd ../..;
done