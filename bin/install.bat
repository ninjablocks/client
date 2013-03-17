@echo off
echo Initialising submodules
call git submodule init 
echo Updating submodules
call git submodule update
echo Installing parent project
call npm install
for /f "usebackq delims=|" %%f in (`dir /b drivers`) do @call echo Installing submodule %%f & cd drivers\%%f & npm install --msvs_version=2012 & cd ..\..\