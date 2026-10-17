import { Injectable } from '@nestjs/common';
import { CaroIaNotConfiguredError, CaroIaProviderError } from '../domain/caro-ia.errors.js';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
}

export interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface DeepSeekToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface DeepSeekResult {
  content: string;
  toolCalls: DeepSeekToolCall[];
}

export abstract class DeepSeekClient {
  abstract complete(
    messages: DeepSeekMessage[],
    tools: DeepSeekToolDefinition[],
    toolChoice: 'required' | 'auto' | 'none',
    signal: AbortSignal,
  ): Promise<DeepSeekResult>;
}

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * OpenAI-compatible DeepSeek chat-completions client. It deliberately keeps
 * the response non-streamed: the orchestrator decides whether the turn is a
 * tool call, an approval proposal or a final answer, and only then emits SSE
 * deltas to the browser.
 */
@Injectable()
export class HttpDeepSeekClient extends DeepSeekClient {
  async complete(
    messages: DeepSeekMessage[],
    tools: DeepSeekToolDefinition[],
    toolChoice: 'required' | 'auto' | 'none',
    signal: AbortSignal,
  ): Promise<DeepSeekResult> {
    const key = process.env.DEEPSEEK_API_KEY?.trim();

    if (key === undefined || key === '') {
      throw new CaroIaNotConfiguredError('DeepSeek');
    }

    const baseUrl = (process.env.DEEPSEEK_API_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combined = AbortSignal.any([signal, timeout]);

    let response: Response;

    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: toolChoice,
          temperature: 0.2,
        }),
        signal: combined,
      });
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      throw new CaroIaProviderError('DeepSeek is unavailable');
    }

    const body = (await response.json().catch(() => ({}))) as DeepSeekResponse;

    if (!response.ok) {
      throw new CaroIaProviderError(
        body.error?.message?.trim() || `DeepSeek returned HTTP ${response.status}`,
      );
    }

    const choice = body.choices?.[0];
    const message = choice?.message;

    if (message === undefined) {
      throw new CaroIaProviderError('DeepSeek returned an empty response');
    }

    return {
      content: message.content ?? '',
      toolCalls: message.tool_calls ?? [],
    };
  }
}
