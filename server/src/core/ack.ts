import { Logger } from '@nestjs/common';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { Message } from 'src/entities/message.entity';
import { EventsGateway } from 'src/ws/events.gateway';
import { Repository } from 'typeorm';

const logger = new Logger('OnAckChanged');

export function OnAckChanged(
    ack: wppconnect.Ack,
    msgRepo: Repository<Message>,
    instance: { id: string; name: string; },
    events: EventsGateway,
) {
    console.log('Ack received:', ack);

    // Map WppConnect ack number to UIMessage status string
    // AckType: -1=FAILED, 0=CLOCK, 1=SENT, 2=RECEIVED, 3=READ, 4=PLAYED
    const ackToStatus = (ackVal: number): string => {
      if (ackVal >= 3) return 'read';
      if (ackVal === 2) return 'delivered';
      if (ackVal >= 0) return 'sent';
      return 'failed';
    };
    const status = ackToStatus(Number(ack.ack));

    // Update the message record in the database with the new ack status
    msgRepo
        .createQueryBuilder()
        .update('messages')
        .set({ status })
        .where('message_id = :messageId', { messageId: ack.id })
        .execute()
        .then(() => {
            // Emit the ack status change to the client
            events.emitTo(instance.name, 'ack:changed', {
                instance_id: instance.id,
                message_id: ack.id,
                ack: ack.ack,
                status,
                timestamp: new Date().toISOString(),
            });
            events.emit('ack:changed', {
                instance_id: instance.id,
                message_id: ack.id,
                ack: ack.ack,
                status,
                timestamp: new Date().toISOString(),
            });
        })
        .catch((error) => {
            logger.error(`Failed to update ack status for message ${ack.id}: ${error.message}`);
        });
}