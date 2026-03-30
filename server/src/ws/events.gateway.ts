import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    try {
      // optional debug
      console.log('[WS] client connected', client.id);
    } catch (e) {}
  }

  handleDisconnect(client: Socket) {
    try {
      console.log('[WS] client disconnected', client.id);
    } catch (e) {}
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, data: any) {
    try {
      const session = typeof data === 'string' ? data : data?.session;
      if (session) {
        client.join(session);
        console.log(`[WS] client ${client.id} joined session ${session}`);
        return { status: 'ok', session };
      }
    } catch (e) {
      // ignore
    }
    return { status: 'error' };
  }

  emit(event: string, payload: any) {
    try {
      this.server.emit(event, payload);
    } catch (e) {
      // no-op in case server not ready
    }
  }

  emitTo(session: string, event: string, payload: any) {
    try {
      // emit to a room named after the session so frontend can join that room
      this.server.to(session).emit(event, payload);
      // also emit global fallback
      this.server.emit(event, payload);
    } catch (e) {
      // ignore if server not ready
    }
  }
}
