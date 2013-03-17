client - Windows Instructions
===========================

There are no guarantees anything will work on Windows, but this might get you a little closer.

Tested on Windows 8 with VS2012

### Requirements

Visual Studio 2010 or 2012

<strike>
LibXML2
Get the batch file from https://gist.github.com/shimondoodkin/4341933/download
Unpack ftp://xmlsoft.org/libxml2/win32/libxml2-2.7.8.win32.zip
Add both to path
</strike>

### Installation
Run these from the VS command prompt
```
git clone https://github.com/ninjablocks/client.git
cd client
./bin/install.bat
```

## If it all goes wrong...

If you have VS2012, you may need to set an environment variable
```
VisualStudioVersion=11.0
```
You may also need to update npm's built-in node-gyp
https://github.com/TooTallNate/node-gyp/wiki/Updating-npm's-bundled-node-gyp

If npm errors out fetching dependencies via git, check that git.exe (*not just git.cmd*) is on the path

## License

Copyright (C) 2012 Ninja Blocks Inc

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.