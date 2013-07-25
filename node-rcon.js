/*!
 * node-rcon
 * Copyright(c) 2012 Justin Li <j-li.net>
 * MIT Licensed
 */

var util = require('util')
  , events = require('events')
  , net = require('net')
  , Buffer = require('buffer').Buffer;


var PacketType = {
  COMMAND: 0x02,
  AUTH: 0x03,
  RESPONSE_VALUE: 0x00,
  RESPONSE_AUTH: 0x02
};


function Rcon(host, port, password, id) {
  if(!(this instanceof Rcon)) return new Rcon(host, port, password, id);

  this.host = host;
  this.port = port;
  this.password = password;
  this.socket = null;
  this.rconId = id || 0x0012D4A6; // This is arbitrary in most cases
  this.hasAuthed = false;

  events.EventEmitter.call(this);
};

util.inherits(Rcon, events.EventEmitter);

Rcon.prototype.send = function(data, cmd, id) {
  cmd = cmd || PacketType.COMMAND;
  id = id || this.rconId;

  var sendBuf = new Buffer(data.length + 16);
  sendBuf.writeInt32LE(data.length + 12, 0);
  sendBuf.writeInt32LE(id, 4);
  sendBuf.writeInt32LE(cmd, 8);
  sendBuf.write(data, 12);
  sendBuf.writeInt32LE(0, data.length + 12);
  this.socket.write(sendBuf.toString('binary'), 'binary');
};

Rcon.prototype.connect = function() {
  var self = this;
  this.socket = net.createConnection(this.port, this.host);
  this.socket.on('data', function(data) { self.socketOnData(data) })
             .on('connect', function() { self.socketOnConnect() })
             .on('error', function(err) { self.emit('error', err); })
             .on('end', function() { self.socketOnEnd() });
};

Rcon.prototype.disconnect = function() {
  this.socket.end();
};

Rcon.prototype.setTimeout = function(timeout, callback) {
  var self = this;
  this.socket.setTimeout(timeout, function() {
    self.socket.end();
    if (callback) callback();
  });
};

Rcon.prototype.socketOnData = function(data) {
 	while(data.length > 0){
   	var len  = data.readInt32LE(0);
   	if (!len) return;
 		var id   = data.readInt32LE(4);
 		var type = data.readInt32LE(8);
 		if (len >= 10 && id == this.rconId){
 			if (!this.hasAuthed && type == PacketType.RESPONSE_AUTH){
 				this.hasAuthed = true;
 				this.emit('auth');
 			}else if (type == PacketType.RESPONSE_VALUE){
				/*	Read only "body" of one RCON-Packet (truncate 0x00 at the end) 
				 *  See https://developer.valvesoftware.com/wiki/Source_RCON_Protocol for details
				 */	
       	var str = data.toString('utf8', 12, 12 + len - 10);
				// emit the response without the 0x0a newline.
       	this.emit('response', str.substring(0, str.length - 1));
 			}
 		}
 		data = data.slice(12+len-8);
  	}
 }; 

Rcon.prototype.socketOnConnect = function() {
  this.send(this.password, PacketType.AUTH);
  this.emit('connect');
};

Rcon.prototype.socketOnEnd = function() {
  this.emit('end');
};

module.exports = Rcon;
