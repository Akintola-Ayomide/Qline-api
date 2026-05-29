import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class QueueGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinQueueRoom')
  handleJoinRoom(@MessageBody() data: { queueId: number }, @ConnectedSocket() client: Socket) {
    client.join(`queue_${data.queueId}`);
  }
}
