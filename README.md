# node-rcon

[![npm](https://img.shields.io/npm/v/rcon.svg)](https://www.npmjs.com/package/rcon)

node-rcon is a simple library for connecting to RCON servers in node.js.
It implements the protocol used by Valve's Source and GoldSrc engines,
as well as many other game servers.

It was originally created to connect to Minecraft's RCON server.

## Installation

npm:

    $ npm install rcon

## Usage

See [`examples/basic.js`](https://github.com/pushrax/node-rcon/blob/master/examples/basic.js) for a simple example, or
[`examples/stdio.js`](https://github.com/pushrax/node-rcon/blob/master/examples/stdio.js) for a complete command line client.

Some games use TCP and some use UDP for their RCON implementation. To tell
node-rcon which protocol to use, pass it an options object like so:

```javascript
var options = {
  tcp: false,       // false for UDP, true for TCP (default true)
  challenge: false  // true to use the challenge protocol (default true)
};
client = new Rcon(host, port, password, options);
```

Here's a non-exhaustive list of which games use which options:

| Game              | Protocol  | Challenge |
| :---------------- | :-------- | :-------- |
| Any Source game   | TCP       | N/A       |
| Minecraft         | TCP       | N/A       |
| Any GoldSrc game  | UDP       | Yes       |
| Call of Duty      | UDP       | No        |

Source games include CS:S, CS:GO, TF2, etc. GoldSrc games include CS 1.6, TFC,
Ricochet (lol), etc.

If there's a game you know uses a certain protocol, feel free to submit a pull
request.

Please submit a bug report for any game you try that doesn't work!

Note that some servers may close the connection if it is idle for a long period of time.
If your application may leave the connection idle for a long time, you can either create a
new Rcon instance (and connection) each time you need it, or you can send a ping command
periodically to keep the connection alive.

## Events

The connection emits the following events:

- .emit('auth')

This is sent in response to an authentication request that was successful.

- .emit('end')

The connection was closed from any reason

- .emit('response', str)

There was a response returned to a command/message sent to the server

- .emit('server', str)

There was a message from the server that was not a response to a command or an auth failiure.

- .emit('error', error)

There was an error, usually an authentication failure.
