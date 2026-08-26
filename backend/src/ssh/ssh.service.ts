// backend/src/ssh/ssh.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Client as SshClient, ConnectConfig } from 'ssh2';
import { Socket } from 'socket.io';

interface SshSession {
  client: SshClient;
  stream: any;
  socketId: string;
}

@Injectable()
export class SshService {
  private readonly logger = new Logger(SshService.name);
  private sessions = new Map<string, SshSession>();

  async connect(socket: Socket, config: { host: string; port?: number; username: string; password?: string; privateKey?: string }) {
    this.disconnect(socket.id);

    const ssh = new SshClient();
    const port = config.port || 22;

    const connectOptions: ConnectConfig = {
      host: config.host,
      port,
      username: config.username,
      readyTimeout: 10000,
      keepaliveInterval: 10000,
    };

    if (config.password) {
      connectOptions.password = config.password;
    } else if (config.privateKey) {
      connectOptions.privateKey = config.privateKey;
    }

    ssh.on('ready', () => {
      this.logger.log(`SSH Connection Ready for client [${socket.id}] to [${config.username}@${config.host}:${port}]`);
      socket.emit('ssh:status', { status: 'CONNECTED', host: config.host, username: config.username });

      ssh.shell(
        {
          term: 'xterm-256color',
          cols: 120,
          rows: 35,
        },
        (err, stream) => {
          if (err) {
            this.logger.error(`SSH Shell Error for [${socket.id}]: ${err.message}`);
            socket.emit('ssh:status', { status: 'ERROR', message: `Shell error: ${err.message}` });
            ssh.end();
            return;
          }

          this.sessions.set(socket.id, { client: ssh, stream, socketId: socket.id });

          stream.on('data', (data: Buffer) => {
            socket.emit('ssh:data', data.toString('utf-8'));
          });

          stream.stderr.on('data', (data: Buffer) => {
            socket.emit('ssh:data', data.toString('utf-8'));
          });

          stream.on('close', () => {
            this.logger.log(`SSH Stream Closed for client [${socket.id}]`);
            socket.emit('ssh:status', { status: 'DISCONNECTED', message: 'SSH Shell session closed' });
            this.sessions.delete(socket.id);
            ssh.end();
          });
        },
      );
    });

    ssh.on('error', (err) => {
      this.logger.error(`SSH Connection Error for [${socket.id}]: ${err.message}`);
      socket.emit('ssh:status', { status: 'ERROR', message: err.message || 'Authentication failed or host unreachable' });
      this.sessions.delete(socket.id);
    });

    ssh.on('close', () => {
      socket.emit('ssh:status', { status: 'DISCONNECTED', message: 'SSH connection closed' });
      this.sessions.delete(socket.id);
    });

    try {
      ssh.connect(connectOptions);
    } catch (err: any) {
      socket.emit('ssh:status', { status: 'ERROR', message: `Failed to initiate SSH: ${err.message}` });
    }
  }

  writeInput(socketId: string, data: string) {
    const session = this.sessions.get(socketId);
    if (session && session.stream) {
      session.stream.write(data);
    }
  }

  resizeTerminal(socketId: string, cols: number, rows: number) {
    const session = this.sessions.get(socketId);
    if (session && session.stream && typeof session.stream.setWindow === 'function') {
      session.stream.setWindow(rows, cols, 0, 0);
    }
  }

  disconnect(socketId: string) {
    const session = this.sessions.get(socketId);
    if (session) {
      try {
        if (session.stream) session.stream.end();
        if (session.client) session.client.end();
      } catch (_) {}
      this.sessions.delete(socketId);
      this.logger.log(`Cleaned up SSH session for socket [${socketId}]`);
    }
  }
}
