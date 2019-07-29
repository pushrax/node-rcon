/*!
 * node-rcon
 * Copyright(c) 2012 Justin Li <j-li.net>
 * MIT Licensed
 */

import events from 'events';
import net from 'net';
import dgram from 'dgram';
import { Buffer } from 'buffer';

const PacketType = {
  COMMAND: 0x02,
  AUTH: 0x03,
  RESPONSE_VALUE: 0x00,
  RESPONSE_AUTH: 0x02
};


/**
 * options:
 *   tcp - true for TCP, false for UDP (optional, default true)
 *   challenge - if using UDP, whether to use the challenge protocol (optional, default true)
 *   id - RCON id to use (optional)
 */

interface Options {
  tcp?: boolean;
  challenge?: boolean;
  id?: number;
}

export class Rcon extends events.EventEmitter {
  private host: string;
  private port: number;
  private password: string;
  private rconId: number;
  private hasAuthed: boolean;
  private outstandingData: Uint8Array | null;
  private tcp: boolean;
  private challenge: boolean;
  private _challengeToken: string;
  private _tcpSocket!: net.Socket;
  private _udpSocket!: dgram.Socket;

  constructor(host: string, port: number, password: string, options: Options) {
    super();
    options = options || {};
    this.host = host;
    this.port = port;
    this.password = password;
    this.rconId = options.id || 0x0012D4A6; // This is arbitrary in most cases
    this.hasAuthed = false;
    this.outstandingData = null;
    this.tcp = options.tcp == null ? true : options.tcp;
    this.challenge = options.challenge == null ? true : options.challenge;
    this._challengeToken = "";

    events.EventEmitter.call(this);
  };

  public send = (data: string, cmd: number, id?: number) => {
    let sendBuf: Buffer;
    if (this.tcp) {
      cmd = cmd || PacketType.COMMAND;
      id = id || this.rconId;

      const length = Buffer.byteLength(data);
      sendBuf = Buffer.alloc(length + 14);
      sendBuf.writeInt32LE(length + 10, 0);
      sendBuf.writeInt32LE(id, 4);
      sendBuf.writeInt32LE(cmd, 8);
      sendBuf.write(data, 12);
      sendBuf.writeInt16LE(0, length + 12);
    } else {
      if (this.challenge && !this._challengeToken) {
        this.emit('error', new Error('Not authenticated'));
        return;
      }
      let str = "rcon ";
      if (this._challengeToken) str += this._challengeToken + " ";
      if (this.password) str += this.password + " ";
      str += data + "\n";
      sendBuf = Buffer.alloc(4 + Buffer.byteLength(str));
      sendBuf.writeInt32LE(-1, 0);
      sendBuf.write(str, 4)
    }
    this._sendSocket(sendBuf);
  };

  private _sendSocket = (buf: Buffer) => {
    if (this._tcpSocket) {
      this._tcpSocket.write(buf.toString('binary'), 'binary');
    } else if (this._udpSocket) {
      this._udpSocket.send(buf, 0, buf.length, this.port, this.host);
    }
  };

  public connect = () => {
    const self = this;

    if (this.tcp) {
      this._tcpSocket = net.createConnection(this.port, this.host);
      this._tcpSocket.on('data', (data) => { self._tcpSocketOnData(data) })
        .on('connect', () => { self.socketOnConnect() })
        .on('error', (err) => { self.emit('error', err) })
        .on('end', () => { self.socketOnEnd() });
    } else {
      this._udpSocket = dgram.createSocket("udp4");
      this._udpSocket.on('message', (data) => { self._udpSocketOnData(data) })
        .on('listening', () => { self.socketOnConnect() })
        .on('error', (err) => { self.emit('error', err) })
        .on('close', () => { self.socketOnEnd() });
      this._udpSocket.bind(0);
    }
  };

  public disconnect = () => {
    if (this._tcpSocket) this._tcpSocket.end();
    if (this._udpSocket) this._udpSocket.close();
  };

  public setTimeout = (timeout: number, callback: () => any) => {
    if (!this._tcpSocket) return;

    const self = this;
    this._tcpSocket.setTimeout(timeout, () => {
      self._tcpSocket.end();
      if (callback) callback();
    });
  };

  private _udpSocketOnData = (data: Buffer) => {
    const a = data.readUInt32LE(0);
    if (a == 0xffffffff) {
      const str = data.toString("utf-8", 4);
      const tokens = str.split(" ");
      if (tokens.length == 3 && tokens[0] == "challenge" && tokens[1] == "rcon") {
        this._challengeToken = tokens[2].substr(0, tokens[2].length - 1).trim();
        this.hasAuthed = true;
        this.emit('auth');
      } else {
        this.emit('response', str.substr(1, str.length - 2));
      }
    } else {
      this.emit('error', new Error("Received malformed packet"));
    }
  }

  private _tcpSocketOnData = (data: Buffer) => {
    if (this.outstandingData != null) {
      data = Buffer.concat([this.outstandingData, data], this.outstandingData.length + data.length);
      this.outstandingData = null;
    }

    while (data.length) {
      const len = data.readInt32LE(0);
      if (!len) return;

      const id = data.readInt32LE(4);
      const type = data.readInt32LE(8);

      if (len >= 10 && data.length >= len + 4) {
        if (id == this.rconId) {
          if (!this.hasAuthed && type == PacketType.RESPONSE_AUTH) {
            this.hasAuthed = true;
            this.emit('auth');
          } else if (type == PacketType.RESPONSE_VALUE) {
            // Read just the body of the packet (truncate the last null byte)
            // See https://developer.valvesoftware.com/wiki/Source_RCON_Protocol for details
            let str = data.toString('utf8', 12, 12 + len - 10);

            if (str.charAt(str.length - 1) === '\n') {
              // Emit the response without the newline.
              str = str.substring(0, str.length - 1);
            }

            this.emit('response', str);
          }
        } else {
          this.emit('error', new Error("Authentication failed"));
        }

        data = data.slice(12 + len - 8);
      } else {
        // Keep a reference to the chunk if it doesn't represent a full packet
        this.outstandingData = data;
        break;
      }
    }
  };

  public socketOnConnect = () => {
    this.emit('connect');

    if (this.tcp) {
      this.send(this.password, PacketType.AUTH);
    } else if (this.challenge) {
      const str = "challenge rcon\n";
      const sendBuf = Buffer.alloc(str.length + 4);
      sendBuf.writeInt32LE(-1, 0);
      sendBuf.write(str, 4);
      this._sendSocket(sendBuf);
    } else {
      const sendBuf = Buffer.alloc(5);
      sendBuf.writeInt32LE(-1, 0);
      sendBuf.writeUInt8(0, 4);
      this._sendSocket(sendBuf);

      this.hasAuthed = true;
      this.emit('auth');
    }
  };

  public socketOnEnd = () => {
    this.emit('end');
    this.hasAuthed = false;
  };
}

export default Rcon;
