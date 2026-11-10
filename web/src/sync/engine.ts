import { io, Socket } from 'socket.io-client';
import { db, LocalMessage, OutboxItem } from '../db';
import { apiFetch } from '../api';

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export class SyncEngine {
  private socket: Socket | null = null;
  private token: string | null = null;
  private isSyncing = false;
  private eventBuffer: any[] = [];
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private conversationListeners: Set<(conv: any) => void> = new Set();
  private conversationDeleteListeners: Set<(data: { conversationId: string }) => void> = new Set();
  private messageListeners: Set<(msg: any) => void> = new Set();
  private messageEditListeners: Set<(msg: any) => void> = new Set();
  private messageDeleteListeners: Set<(data: { _id: string; conversationId: string }) => void> = new Set();
  private currentState: ConnectionState = 'offline';
  private activeRoomId: string | null = null;

  constructor() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCurrentUserId(): string | null {
    try {
      const saved = localStorage.getItem('zena_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed._id || parsed.id || null;
      }
    } catch {}
    return null;
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
    this.activeRoomId = null;
    this.updateState('offline');
  }

  public joinConversation(conversationId: string) {
    this.activeRoomId = conversationId;
    if (this.socket && this.socket.connected && conversationId) {
      this.socket.emit('conversation:join', conversationId);
    }
  }

  public markAsRead(conversationId: string, upToSeq?: number) {
    if (this.socket && this.socket.connected && conversationId && upToSeq && upToSeq > 0) {
      this.socket.emit('receipt:read', { conversationId, upToSeq });
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

  public onConversationNew(listener: (conv: any) => void) {
    this.conversationListeners.add(listener);
    return () => this.conversationListeners.delete(listener);
  }

  public onConversationDelete(listener: (data: { conversationId: string }) => void) {
    this.conversationDeleteListeners.add(listener);
    return () => this.conversationDeleteListeners.delete(listener);
  }

  public onMessageNew(listener: (msg: any) => void) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onMessageEdit(listener: (msg: any) => void) {
    this.messageEditListeners.add(listener);
    return () => this.messageEditListeners.delete(listener);
  }

  public onMessageDelete(listener: (data: { _id: string; conversationId: string }) => void) {
    this.messageDeleteListeners.add(listener);
    return () => this.messageDeleteListeners.delete(listener);
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

      // Re-join active room if set
      if (this.activeRoomId) {
        this.socket?.emit('conversation:join', this.activeRoomId);
      }

      await this.runSync();
      await this.flushOutbox();
    });

    this.socket.on('disconnect', () => {
      this.updateState(navigator.onLine ? 'reconnecting' : 'offline');
    });

    this.socket.on('message:new', async (data: any) => {
      await this.applyIncomingMessage(data);
    });

    this.socket.on('message:edited', async (data: any) => {
      await db.messages.update(data._id, {
        text: data.text,
        editedAt: data.editedAt,
      });
      this.messageEditListeners.forEach((l) => l(data));
    });

    this.socket.on('message:deleted', async (data: any) => {
      await db.messages.delete(data._id);
      this.messageDeleteListeners.forEach((l) => l(data));
    });

    this.socket.on('conversation:new', (conv: any) => {
      this.conversationListeners.forEach((l) => l(conv));
    });

    this.socket.on('conversation:deleted', async (data: any) => {
      await db.messages.where('conversationId').equals(data.conversationId).delete();
      this.conversationDeleteListeners.forEach((l) => l(data));
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

      const syncTimer = setTimeout(() => {
        this.isSyncing = false;
      }, 5000);

      this.socket.emit('sync:request', { cursors: cursorMap }, async (res: any) => {
        clearTimeout(syncTimer);
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
    // 1. If we have a local optimistic message with this clientMsgId, delete it first
    if (msg.clientMsgId) {
      const local = await db.messages.where('clientMsgId').equals(msg.clientMsgId).first();
      if (local && local.id !== msg._id) {
        await db.messages.delete(local.id);
      }
    }

    const currentUserId = this.getCurrentUserId();
    const isMe =
      msg.senderId === currentUserId ||
      msg.senderId?._id === currentUserId ||
      msg.senderId === 'self';

    await db.messages.put({
      id: msg._id,
      conversationId: msg.conversationId,
      seq: msg.seq,
      eventSeq: msg.eventSeq,
      senderId: typeof msg.senderId === 'object' && msg.senderId?._id ? msg.senderId._id : (msg.senderId || 'other'),
      senderName:
        msg.senderDisplayName ||
        msg.senderUsername ||
        (typeof msg.senderId === 'object' ? msg.senderId.displayName || msg.senderId.username : undefined),
      clientMsgId: msg.clientMsgId || msg._id,
      text: msg.text || '',
      status: isMe ? 'sent' : 'delivered',
      createdAt: msg.createdAt,
    });

    // Update sync cursor
    if (msg.eventSeq) {
      await db.syncState.put({
        conversationId: msg.conversationId,
        lastEventSeq: msg.eventSeq,
        updatedAt: new Date().toISOString(),
      });
    }

    this.messageListeners.forEach((l) => l(msg));
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

  public async editMessage(conversationId: string, messageId: string, text: string): Promise<boolean> {
    try {
      if (!this.socket || !this.socket.connected) {
        const res = await apiFetch(`/api/v1/conversations/${conversationId}/messages/${messageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ text }),
        });
        if (res?._id) {
          await db.messages.update(messageId, { text, editedAt: res.editedAt || new Date().toISOString() });
          return true;
        }
        return false;
      }

      return new Promise((resolve) => {
        this.socket!.emit('message:edit', { conversationId, messageId, text }, async (res: any) => {
          if (res?.ok) {
            await db.messages.update(messageId, {
              text,
              editedAt: res.message?.editedAt || new Date().toISOString(),
            });
            resolve(true);
          } else {
            // Fallback to REST
            try {
              const restRes = await apiFetch(`/api/v1/conversations/${conversationId}/messages/${messageId}`, {
                method: 'PATCH',
                body: JSON.stringify({ text }),
              });
              if (restRes?._id) {
                await db.messages.update(messageId, { text, editedAt: restRes.editedAt || new Date().toISOString() });
                resolve(true);
                return;
              }
            } catch {}
            resolve(false);
          }
        });
      });
    } catch {
      return false;
    }
  }

  public async deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    try {
      if (!this.socket || !this.socket.connected) {
        await apiFetch(`/api/v1/conversations/${conversationId}/messages/${messageId}`, {
          method: 'DELETE',
        });
        await db.messages.delete(messageId);
        return true;
      }

      return new Promise((resolve) => {
        this.socket!.emit('message:delete', { conversationId, messageId }, async (res: any) => {
          if (res?.ok) {
            await db.messages.delete(messageId);
            resolve(true);
          } else {
            // Fallback to REST
            try {
              await apiFetch(`/api/v1/conversations/${conversationId}/messages/${messageId}`, {
                method: 'DELETE',
              });
              await db.messages.delete(messageId);
              resolve(true);
              return;
            } catch {}
            resolve(false);
          }
        });
      });
    } catch {
      return false;
    }
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
            await db.messages.delete(item.clientMsgId);
            await db.messages.put({
              id: ack.serverMsgId,
              conversationId: item.conversationId,
              seq: ack.seq,
              senderId: this.getCurrentUserId() || 'self',
              clientMsgId: item.clientMsgId,
              text: item.text,
              status: 'sent',
              createdAt: item.createdAt,
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
