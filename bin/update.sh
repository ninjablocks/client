#/bin/sh
git fetch --recurse-submodules=yes
npm install
for f in ninja_modules/*;
  do cd $f;
  npm install;
  cd ../..;
done