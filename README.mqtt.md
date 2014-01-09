# MQTT Client

Ninja blocks has been working on a version of client which replaces dnode with MQTT.

# Known Issues

* Revoking tokens doesn't work yet.
* Needs to be tested with a range of devices.
* No authentication of the MQTT connections at the moment.
* TLS still needs to be enabled.
* Need to clear out all some of the dead handler and authentication related code.
* Need to look into handlers for install and uninstall, to establish what they do.
* No way of recognising authentication failures.

# Lower Priority Tasks

* Rewrite credentials.js in the lib folder.
* Add some validation and fault handling
