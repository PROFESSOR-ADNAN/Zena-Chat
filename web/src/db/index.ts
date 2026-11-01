import Dexie, { type Table } from 'dexie';

export interface LocalConversation {
  id: string;
  type: 'dm' | 'group';
  name?: string;
  lastSeq: number;
  lastEventSeq: number;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
}

export interface LocalMessage {
  id: string; // serverMsgId or clientMsgId
  conversationId: string;
  seq?: number;
  eventSeq?: number;
  senderId: string;
  senderName?: string;
  clientMsgId: string;
  text: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface OutboxItem {
  clientMsgId: string;
  conversationId: string;
  text: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
}

export interface SyncCursor {
  conversationId: string;
  lastEventSeq: number;
  updatedAt: string;
}

export class ZenaDatabase extends Dexie {
  conversations!: Table<LocalConversation, string>;
  messages!: Table<LocalMessage, string>;
  outbox!: Table<OutboxItem, string>;
  syncState!: Table<SyncCursor, string>;

  constructor() {
    super('ZenaChatDB');
    this.version(1).stores({
      conversations: 'id, type, lastMessageAt',
      messages: 'id, conversationId, seq, eventSeq, clientMsgId, status, createdAt',
      outbox: 'clientMsgId, conversationId, createdAt, attempts',
      syncState: 'conversationId',
    });
  }
}

export const db = new ZenaDatabase();
