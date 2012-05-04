/*!
 * node-rcon - example.js
 * Copyright(c) 2012 Justin Li <j-li.net>
 * MIT Licensed
 */

var Rcon = require('node-rcon');

var conn = new Rcon('localhost', 1234, 'password');
conn.on('auth', function() {

  console.log("Authed!");

}).on('response', function(str) {

  console.log("Got response: " + str);

}).on('end', function() {

  console.log("Socket closed!");
  process.exit();

});

conn.connect();


/*
 * example reads commands from stdin and sends them on enter key press
 */

var stdin = process.openStdin(); 
require('tty').setRawMode(true);    

var buffer = "";

stdin.on('keypress', function (chunk, key) {
  if (key && key.ctrl && key.name == 'c') {
    conn.disconnect();
    return;
  }
  if (key && key.name == 'enter') {
    conn.send(buffer);
    buffer = "";
  } else {
    buffer += chunk;
  }
  process.stdout.write(chunk);

});