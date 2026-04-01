import { Controller, Get, Sse } from '@nestjs/common';
import { AppService } from './app.service';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Simple Server-Sent Events endpoint for /events
  @Sse('events')
  events(): Observable<any> {
    // emit a ping every 25 seconds to keep the connection alive
    // (most proxies/browsers timeout idle SSE after 30s)
    return interval(25000).pipe(map(() => ({ data: JSON.stringify({ type: 'ping', ts: Date.now() }) })));
  }
}
