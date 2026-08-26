// backend/src/ssh/ssh.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SshService } from './ssh.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SshGateway implements OnGatewayDisconnect {
  constructor(private readonly sshService: SshService) {}

  handleDisconnect(client: Socket) {
    this.sshService.disconnect(client.id);
  }

  @SubscribeMessage('ssh:connect')
  async handleConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { host: string; port?: number; username: string; password?: string; privateKey?: string },
  ) {
    await this.sshService.connect(client, payload);
  }

  @SubscribeMessage('ssh:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { data: string },
  ) {
    this.sshService.writeInput(client.id, payload.data || '');
  }

  @SubscribeMessage('ssh:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { cols: number; rows: number },
  ) {
    this.sshService.resizeTerminal(client.id, payload.cols || 120, payload.rows || 35);
  }

  @SubscribeMessage('ssh:disconnect')
  handleDisconnectSession(@ConnectedSocket() client: Socket) {
    this.sshService.disconnect(client.id);
  }
}
