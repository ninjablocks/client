#/bin/sh
git pull
git fetch --recurse-submodules=yes
npm install
for f in drivers/*;
  do cd $f;
  npm install --force;
  cd ../..;
done
