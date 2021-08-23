// This example reads commands from stdin and sends them on enter key press.
// You need to run `npm install keypress` for this example to work.

var Rcon = require('../node-rcon');
var keypress = require('keypress');

var conn = new Rcon('localhost', 1234, 'password');
var authenticated = false;
var queuedCommands = [];

conn.on('auth', function() {
  console.log("Authenticated");
  authenticated = true;

  // You must wait until this event is fired before sending any commands,
  // otherwise those commands will fail.
  //
  // This example buffers any commands sent before auth finishes, and sends
  // them all once the connection is available.

  for (var i = 0; i < queuedCommands.length; i++) {
    conn.send(queuedCommands[i]);
  }
  queuedCommands = [];

}).on('response', function(str) {
  console.log("Response: " + str);
}).on('error', function(err) {
  console.log("Error: " + err);
}).on('end', function() {
  console.log("Connection closed");
  process.exit();
});

conn.connect();

keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

var buffer = "";

process.stdin.on('keypress', function(chunk, key) {
  if (key && key.ctrl && (key.name == 'c' || key.name == 'd')) {
    conn.disconnect();
    return;
  }
  process.stdout.write(chunk);

  if (key && (key.name == 'enter' || key.name == 'return')) {
    if (authenticated) {
      conn.send(buffer);
    } else {
      queuedCommands.push(buffer);
    }
    buffer = "";
    process.stdout.write("\n");
  } else if (key && key.name == 'backspace') {
    buffer = buffer.slice(0, -1);
    process.stdout.write("\033[K"); // Clear to end of line
  } else {
    buffer += chunk;
  }
});
