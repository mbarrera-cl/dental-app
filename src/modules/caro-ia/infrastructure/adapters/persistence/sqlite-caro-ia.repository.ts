import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import type {
  CaroApprovalRecord,
  CaroApprovalStatus,
  CaroCitation,
  CaroConversation,
  CaroConversationDetail,
  CaroMessage,
  CaroPendingApproval,
  CaroToolCall,
} from '../../../domain/caro-ia.models.js';
import {
  DEFAULT_CONVERSATION_TITLE,
  previewOf,
} from '../../../domain/caro-ia.models.js';
import {
  CaroIaRepositoryPort,
  type CreateApprovalInput,
  type CreateMessageInput,
} from '../../../application/caro-ia.repository.port.js';

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: string;
  citations: string;
  created_at: string;
}

interface ApprovalRow {
  id: string;
  conversation_id: string;
  message_id: string;
  tool: string;
  title: string;
  summary: string;
  parameters: string;
  arguments: string;
  status: string;
  expires_at: string;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
}

const CONVERSATION_COLUMNS = `
  c.id, c.title, c.created_at, c.updated_at,
  (SELECT COUNT(*) FROM caro_messages m WHERE m.conversation_id = c.id) AS message_count,
  (SELECT m.content FROM caro_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS preview
`;

/** SQLite adapter for CaroIA conversations, messages and approvals. */
@Injectable()
export class SqliteCaroIaRepository extends CaroIaRepositoryPort {
  constructor(private readonly database: SqliteDatabase) {
    super();
  }

  async listConversations(userId: string): Promise<CaroConversation[]> {
    const rows = this.database.connection
      .prepare(
        `SELECT ${CONVERSATION_COLUMNS}
         FROM caro_conversations c
         WHERE c.user_id = ? AND c.deleted_at IS NULL
         ORDER BY c.updated_at DESC, c.created_at DESC`,
      )
      .all(userId) as unknown as ConversationRow[];

    return rows.map(toConversation);
  }

  async findConversation(userId: string, id: string): Promise<CaroConversation | null> {
    const row = this.database.connection
      .prepare(
        `SELECT ${CONVERSATION_COLUMNS}
         FROM caro_conversations c
         WHERE c.id = ? AND c.user_id = ? AND c.deleted_at IS NULL`,
      )
      .get(id, userId) as unknown as ConversationRow | undefined;

    return row === undefined ? null : toConversation(row);
  }

  async getDetail(userId: string, id: string): Promise<CaroConversationDetail | null> {
    const conversation = await this.findConversation(userId, id);

    if (conversation === null) {
      return null;
    }

    return { conversation, messages: await this.listMessages(id) };
  }

  async createConversation(userId: string, title: string): Promise<CaroConversation> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.database.connection
      .prepare(
        `INSERT INTO caro_conversations (id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, userId, title, now, now);

    const conversation = await this.findConversation(userId, id);

    if (conversation === null) {
      throw new Error('The conversation could not be read after creation');
    }

    return conversation;
  }

  async renameConversation(
    userId: string,
    id: string,
    title: string,
  ): Promise<CaroConversation | null> {
    const existing = await this.findConversation(userId, id);

    if (existing === null) {
      return null;
    }

    this.database.connection
      .prepare(
        `UPDATE caro_conversations
         SET title = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      )
      .run(title, new Date().toISOString(), id, userId);

    return this.findConversation(userId, id);
  }

  async softDeleteConversation(userId: string, id: string): Promise<boolean> {
    const existing = await this.findConversation(userId, id);

    if (existing === null) {
      return false;
    }

    this.database.connection
      .prepare(
        `UPDATE caro_conversations
         SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      )
      .run(new Date().toISOString(), new Date().toISOString(), id, userId);

    return true;
  }

  async listMessages(conversationId: string): Promise<CaroMessage[]> {
    const rows = this.database.connection
      .prepare(
        `SELECT id, conversation_id, role, content, tool_calls, citations, created_at
         FROM caro_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(conversationId) as unknown as MessageRow[];

    const approvals = this.approvalsFor(conversationId);
    const byMessage = new Map<string, CaroPendingApproval[]>();

    for (const approval of approvals) {
      const list = byMessage.get(approval.messageId) ?? [];
      list.push(toPendingApproval(approval));
      byMessage.set(approval.messageId, list);
    }

    return rows.map((row) => toMessage(row, byMessage.get(row.id) ?? []));
  }

  async insertMessage(input: CreateMessageInput): Promise<CaroMessage> {
    const id = randomUUID();
    const createdAt = input.createdAt ?? new Date().toISOString();

    this.database.connection
      .prepare(
        `INSERT INTO caro_messages
          (id, conversation_id, role, content, tool_calls, citations, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.conversationId,
        input.role,
        input.content,
        JSON.stringify(input.toolCalls ?? []),
        JSON.stringify(input.citations ?? []),
        createdAt,
      );

    return {
      id,
      role: input.role,
      content: input.content,
      createdAt,
      attachments: [],
      toolCalls: input.toolCalls ?? [],
      approvals: [],
      citations: input.citations ?? [],
    };
  }

  async touchConversation(conversationId: string, updatedAt: string): Promise<void> {
    this.database.connection
      .prepare('UPDATE caro_conversations SET updated_at = ? WHERE id = ?')
      .run(updatedAt, conversationId);
  }

  async setTitleIfDefault(conversationId: string, title: string): Promise<void> {
    this.database.connection
      .prepare(
        `UPDATE caro_conversations
         SET title = ?, updated_at = ?
         WHERE id = ? AND title = ? AND deleted_at IS NULL`,
      )
      .run(title, new Date().toISOString(), conversationId, DEFAULT_CONVERSATION_TITLE);
  }

  async createApproval(input: CreateApprovalInput): Promise<void> {
    this.database.connection
      .prepare(
        `INSERT INTO caro_approvals
          (id, conversation_id, message_id, tool, title, summary, parameters, arguments,
           status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.approval.id,
        input.conversationId,
        input.messageId,
        input.approval.tool,
        input.approval.title,
        input.approval.summary,
        JSON.stringify(input.approval.parameters),
        JSON.stringify(input.arguments),
        input.approval.status,
        input.approval.expiresAt,
        input.createdAt,
      );
  }

  async findApproval(
    userId: string,
    conversationId: string,
    approvalId: string,
  ): Promise<CaroApprovalRecord | null> {
    const row = this.database.connection
      .prepare(
        `SELECT a.* FROM caro_approvals a
         JOIN caro_conversations c ON c.id = a.conversation_id
         WHERE a.id = ? AND a.conversation_id = ?
           AND c.user_id = ? AND c.deleted_at IS NULL`,
      )
      .get(approvalId, conversationId, userId) as unknown as ApprovalRow | undefined;

    return row === undefined ? null : toApprovalRecord(row);
  }

  async decideApproval(
    approvalId: string,
    status: CaroApprovalStatus,
    decidedBy: string,
    decidedAt: string,
  ): Promise<boolean> {
    const result = this.database.connection
      .prepare(
        `UPDATE caro_approvals
         SET status = ?, decided_by = ?, decided_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(status, decidedBy, decidedAt, approvalId);

    return Number(result.changes) > 0;
  }

  async expireApproval(approvalId: string): Promise<void> {
    this.database.connection
      .prepare(
        `UPDATE caro_approvals
         SET status = 'expired', decided_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(new Date().toISOString(), approvalId);
  }

  async purgeOlderThan(cutoff: string): Promise<number> {
    const result = this.database.connection
      .prepare('DELETE FROM caro_conversations WHERE updated_at < ?')
      .run(cutoff);

    return Number(result.changes);
  }

  private approvalsFor(conversationId: string): CaroApprovalRecord[] {
    const rows = this.database.connection
      .prepare(
        `SELECT * FROM caro_approvals
         WHERE conversation_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(conversationId) as unknown as ApprovalRow[];

    return rows.map(toApprovalRecord);
  }
}

function toConversation(row: ConversationRow): CaroConversation {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview === null ? null : previewOf(row.preview),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: Number(row.message_count),
  };
}

function toMessage(row: MessageRow, approvals: CaroPendingApproval[]): CaroMessage {
  return {
    id: row.id,
    role: row.role === 'user' ? 'user' : 'assistant',
    content: row.content,
    createdAt: row.created_at,
    attachments: [],
    toolCalls: parseJson<CaroToolCall[]>(row.tool_calls, []),
    approvals,
    citations: parseJson<CaroCitation[]>(row.citations, []),
  };
}

function toPendingApproval(row: CaroApprovalRecord): CaroPendingApproval {
  return {
    id: row.id,
    tool: row.tool,
    title: row.title,
    summary: row.summary,
    parameters: row.parameters,
    status: row.status,
    expiresAt: row.expiresAt,
  };
}

function toApprovalRecord(row: ApprovalRow): CaroApprovalRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    tool: row.tool,
    title: row.title,
    summary: row.summary,
    parameters: parseJson<Array<{ label: string; value: string }>>(row.parameters, []),
    arguments: parseJson<Record<string, unknown>>(row.arguments, {}),
    status: row.status as CaroApprovalStatus,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
