# MQTT Client

Ninja blocks has been working on a version of client which replaces dnode with MQTT.

# Known Issues

* Revoking tokens doesn't work yet.
* Needs to be tested with a range of devices.
* Need to clear out all some of the dead handler and authentication related code.
* No way of recognising authentication failures.
* Actuations are not working at the moment fix needed at the server end.

# Lower Priority Tasks

* Rewrite credentials.js in the lib folder.
* Add some validation and fault handling

# TLS ninja certificate

At the moment we are using a self signed cert for
mqttbeta.ninjablocks.co so you need to export the following env var
before running client.

```
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

#Running 
Set cloudHost in the args: 

```
node /opt/ninja/client/client.js --cloudHost mqttbeta.ninjablocks.co
```