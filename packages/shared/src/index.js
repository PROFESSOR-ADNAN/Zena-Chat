import { z } from 'zod';

export const PROTOCOL_VERSION = '1.0.0';

export const LIMITS = {
  MAX_TEXT_LENGTH: 4000,
  MAX_ATTACHMENT_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_GROUP_MEMBERS: 200,
  MAX_CONVERSATION_NAME_LENGTH: 64,
  EDIT_WINDOW_MS: 15 * 60 * 1000, // 15 mins
  DELETE_WINDOW_MS: 15 * 60 * 1000, // 15 mins
  SYNC_BATCH_SIZE: 100,
  HEARTBEAT_PING_INTERVAL_MS: 25000,
  HEARTBEAT_PING_TIMEOUT_MS: 20000,
  PRESENCE_TTL_SEC: 45,
  TYPING_DEBOUNCE_MS: 3000,
  TYPING_AUTO_EXPIRE_MS: 5000,
  ACK_TIMEOUT_MS: 8000,
};

// Common primitives
export const MongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');
export const ClientMsgIdSchema = z.string().uuid('clientMsgId must be a valid UUID');

// User & Auth Schemas
export const UserRoleSchema = z.enum(['user', 'admin']);
export const GroupMemberRoleSchema = z.enum(['owner', 'admin', 'member']);

export const RegisterRequestSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric and underscore'),
  displayName: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginRequestSchema = z.object({
  login: z.string().min(1), // email or username
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});

// Socket Event Schemas
export const MessageSendEventSchema = z.object({
  conversationId: MongoIdSchema,
  clientMsgId: ClientMsgIdSchema,
  text: z.string().max(LIMITS.MAX_TEXT_LENGTH).optional(),
  attachmentId: MongoIdSchema.optional(),
  replyToId: MongoIdSchema.optional(),
}).refine(data => Boolean(data.text || data.attachmentId), {
  message: 'Must provide either text or attachmentId',
});

export const MessageEditEventSchema = z.object({
  conversationId: MongoIdSchema,
  messageId: MongoIdSchema,
  text: z.string().min(1).max(LIMITS.MAX_TEXT_LENGTH),
});

export const MessageDeleteEventSchema = z.object({
  conversationId: MongoIdSchema,
  messageId: MongoIdSchema,
});

export const ReceiptDeliveredEventSchema = z.object({
  conversationId: MongoIdSchema,
  upToSeq: z.number().int().positive(),
});

export const ReceiptReadEventSchema = z.object({
  conversationId: MongoIdSchema,
  upToSeq: z.number().int().positive(),
});

export const SyncRequestEventSchema = z.object({
  cursors: z.record(z.number().int().nonnegative()),
});

export const TypingStartEventSchema = z.object({
  conversationId: MongoIdSchema,
});

export const TypingStopEventSchema = z.object({
  conversationId: MongoIdSchema,
});

export const ConversationJoinEventSchema = z.object({
  conversationId: MongoIdSchema,
});

// Outgoing / Broadcast Payloads
export const MessageNewPayloadSchema = z.object({
  _id: MongoIdSchema,
  conversationId: MongoIdSchema,
  seq: z.number().int().positive(),
  eventSeq: z.number().int().positive(),
  senderId: MongoIdSchema,
  senderUsername: z.string().optional(),
  senderDisplayName: z.string().optional(),
  clientMsgId: ClientMsgIdSchema,
  type: z.enum(['text', 'image']),
  text: z.string().optional(),
  attachmentId: MongoIdSchema.optional(),
  replyToId: MongoIdSchema.optional(),
  createdAt: z.string(),
  editedAt: z.string().optional(),
  deletedAt: z.string().optional(),
});

export const ReceiptUpdatePayloadSchema = z.object({
  conversationId: MongoIdSchema,
  userId: MongoIdSchema,
  deliveredSeq: z.number().int().positive().optional(),
  readSeq: z.number().int().positive().optional(),
  updatedAt: z.string(),
});

export const PresenceSnapshotItemSchema = z.object({
  userId: MongoIdSchema,
  isOnline: z.boolean(),
  lastSeenAt: z.string().optional(),
});

export const PresenceUpdatePayloadSchema = z.object({
  userId: MongoIdSchema,
  isOnline: z.boolean(),
  lastSeenAt: z.string().optional(),
});

export const TypingUpdatePayloadSchema = z.object({
  conversationId: MongoIdSchema,
  userId: MongoIdSchema,
  username: z.string(),
  isTyping: z.boolean(),
});

// RFC 9457 Problem Details Schema
export const ProblemDetailsSchema = z.object({
  type: z.string().url().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.array(z.any()).optional(),
});
