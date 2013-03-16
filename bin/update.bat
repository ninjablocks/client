@echo off
call git pull
call git fetch --recurse-submodules=yes
call npm install
for /f "usebackq delims=|" %%f in (`dir /b drivers`) do @call echo Updating submodule %%f & cd drivers\%%f & npm install --force --msvs_version=2012 & cd ..\..\