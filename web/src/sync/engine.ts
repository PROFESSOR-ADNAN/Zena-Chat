import { io, Socket } from 'socket.io-client';
import { db, LocalMessage, OutboxItem } from '../db';

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export class SyncEngine {
  private socket: Socket | null = null;
  private token: string | null = null;
  private isSyncing = false;
  private eventBuffer: any[] = [];
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private currentState: ConnectionState = 'offline';

  constructor() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  public getToken(): string | null {
    return this.token;
  }

  public init(token: string) {
    this.token = token;
    if (this.socket) {
      this.socket.disconnect();
    }

    if (!token) {
      this.updateState('offline');
      return;
    }

    this.updateState('connecting');

    const backendUrl =
      import.meta.env.VITE_BACKEND_URL ||
      (window.location.port === '5173' ? 'http://localhost:5000' : window.location.origin);

    this.socket = io(backendUrl, {
      transports: ['websocket'],
      auth: { token, deviceId: this.getDeviceId() },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });

    this.setupSocketHandlers();
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.updateState('offline');
  }

  public joinConversation(conversationId: string) {
    if (this.socket && this.socket.connected && conversationId) {
      this.socket.emit('conversation:join', conversationId);
    }
  }

  private getDeviceId(): string {
    let id = localStorage.getItem('zena_device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('zena_device_id', id);
    }
    return id;
  }

  public onStateChange(listener: (state: ConnectionState) => void) {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  private updateState(state: ConnectionState) {
    this.currentState = state;
    this.stateListeners.forEach((l) => l(state));
  }

  private handleNetworkChange(online: boolean) {
    if (!online) {
      this.updateState('offline');
    } else if (this.socket && !this.socket.connected) {
      this.updateState('reconnecting');
      this.socket.connect();
    }
  }

  private setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', async () => {
      this.updateState('connected');
      await this.runSync();
      await this.flushOutbox();
    });

    this.socket.on('disconnect', () => {
      this.updateState(navigator.onLine ? 'reconnecting' : 'offline');
    });

    this.socket.on('message:new', async (data: any) => {
      if (this.isSyncing) {
        this.eventBuffer.push({ type: 'message', data });
        return;
      }
      await this.applyIncomingMessage(data);
    });

    this.socket.on('receipt:update', async (data: any) => {
      await this.applyReceiptUpdate(data);
    });
  }

  public async runSync() {
    if (!this.socket || !this.socket.connected || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const cursors = await db.syncState.toArray();
      const cursorMap: Record<string, number> = {};
      cursors.forEach((c) => {
        cursorMap[c.conversationId] = c.lastEventSeq;
      });

      this.socket.emit('sync:request', { cursors: cursorMap }, async (res: any) => {
        if (res?.ok && Array.isArray(res.events)) {
          for (const ev of res.events) {
            if (ev.type === 'message') {
              await this.applyIncomingMessage(ev.data);
            }
          }
        }

        // Apply buffered events in order
        while (this.eventBuffer.length > 0) {
          const buffered = this.eventBuffer.shift();
          if (buffered.type === 'message') {
            await this.applyIncomingMessage(buffered.data);
          }
        }

        this.isSyncing = false;
      });
    } catch (err) {
      console.error('Sync failed:', err);
      this.isSyncing = false;
    }
  }

  private async applyIncomingMessage(msg: any) {
    const existing = await db.messages.get(msg._id);
    if (!existing) {
      await db.messages.put({
        id: msg._id,
        conversationId: msg.conversationId,
        seq: msg.seq,
        eventSeq: msg.eventSeq,
        senderId: msg.senderId,
        senderName: msg.senderDisplayName || msg.senderUsername,
        clientMsgId: msg.clientMsgId,
        text: msg.text || '',
        status: 'delivered',
        createdAt: msg.createdAt,
      });

      // Update sync cursor
      await db.syncState.put({
        conversationId: msg.conversationId,
        lastEventSeq: msg.eventSeq,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async applyReceiptUpdate(data: { conversationId: string; deliveredSeq?: number; readSeq?: number }) {
    if (data.readSeq) {
      await db.messages
        .where('conversationId')
        .equals(data.conversationId)
        .filter((m) => !!m.seq && m.seq <= data.readSeq! && m.status !== 'read')
        .modify({ status: 'read' });
    } else if (data.deliveredSeq) {
      await db.messages
        .where('conversationId')
        .equals(data.conversationId)
        .filter((m) => !!m.seq && m.seq <= data.deliveredSeq! && m.status === 'sent')
        .modify({ status: 'delivered' });
    }
  }

  public async sendMessage(conversationId: string, text: string): Promise<string> {
    const clientMsgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const localMsg: LocalMessage = {
      id: clientMsgId,
      conversationId,
      senderId: 'self',
      clientMsgId,
      text,
      status: 'sending',
      createdAt: now,
    };

    const outboxItem: OutboxItem = {
      clientMsgId,
      conversationId,
      text,
      createdAt: now,
      attempts: 0,
    };

    await db.messages.put(localMsg);
    await db.outbox.put(outboxItem);

    this.sendSingleOutboxItem(outboxItem);
    return clientMsgId;
  }

  public async flushOutbox() {
    const items = await db.outbox.orderBy('createdAt').toArray();
    for (const item of items) {
      await this.sendSingleOutboxItem(item);
    }
  }

  private async sendSingleOutboxItem(item: OutboxItem) {
    if (!this.socket || !this.socket.connected) return;

    return new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        // Ack timeout reached (8s)
        await db.outbox.update(item.clientMsgId, {
          attempts: item.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });
        resolve();
      }, 8000);

      this.socket!.emit(
        'message:send',
        {
          conversationId: item.conversationId,
          clientMsgId: item.clientMsgId,
          text: item.text,
        },
        async (ack: any) => {
          clearTimeout(timer);
          if (ack?.ok) {
            await db.outbox.delete(item.clientMsgId);
            await db.messages.update(item.clientMsgId, {
              id: ack.serverMsgId,
              seq: ack.seq,
              status: 'sent',
            });
          } else {
            await db.messages.update(item.clientMsgId, { status: 'failed' });
          }
          resolve();
        }
      );
    });
  }
}

export const syncEngine = new SyncEngine();
