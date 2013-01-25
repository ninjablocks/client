#/bin/sh
git submodule init
git submodule update
npm install
for f in ninja_modules/*;
  do cd $f;
  npm install;
  cd ../..;
done