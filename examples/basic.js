// This minimal example connects and runs the "help" command.

var Rcon = require('../node-rcon');

var conn = new Rcon('localhost', 1234, 'password');

conn.on('auth', function() {
  // You must wait until this event is fired before sending any commands,
  // otherwise those commands will fail.
  console.log("Authenticated");
  console.log("Sending command: help")
  conn.send("help");
}).on('response', function(str) {
  console.log("Response: " + str);
}).on('error', function(err) {
  console.log("Error: " + err);
}).on('end', function() {
  console.log("Connection closed");
  process.exit();
});

conn.connect();

// connect() will return immediately.
//
// If you try to send a command here, it will fail since the connection isn't
// authenticated yet. Wait for the 'auth' event.
