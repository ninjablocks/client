# client

The Node that runs on the Beagle and sends data to the Ninja Platform

# components

The client performs a number of functions at the moment.

## handlers

There are a number of handlers which interact with the cloud

# Prerequisites

* Nodejs 0.10.20+, preferably the latest from [NodeJS
  Website](http://nodejs.org/downloads).
* git 1.8.x, preferably the latest. 

# Installation

To get the client up and running against Ninja Blocks beta environment.

```
export NODE_ENV=beta
git clone https://github.com/ninjablocks/client
cd client
git checkout wip/enterprise
bin/install.sh
```

To start ninjablocks client.

```
node index.js
```

Open your browser [Beta Portal](https://wakai.ninja.is).

## License

Copyright (C) 2012 Ninja Blocks Inc under the MIT license.

