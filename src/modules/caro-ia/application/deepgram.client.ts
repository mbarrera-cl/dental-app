import { Injectable } from '@nestjs/common';
import { CaroIaNotConfiguredError, CaroIaProviderError } from '../domain/caro-ia.errors.js';
import type { CaroTranscription } from '../domain/caro-ia.models.js';

export abstract class DeepgramClient {
  abstract transcribe(
    audio: Uint8Array,
    mimeType: string,
    signal: AbortSignal,
  ): Promise<CaroTranscription>;
}

interface DeepgramResponse {
  metadata?: { duration?: number };
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string; confidence?: number }>;
    }>;
  };
}

const DEFAULT_BASE_URL = 'https://api.deepgram.com';
const REQUEST_TIMEOUT_MS = 90_000;

/** Deepgram pre-recorded transcription. Audio is never persisted. */
@Injectable()
export class HttpDeepgramClient extends DeepgramClient {
  async transcribe(
    audio: Uint8Array,
    mimeType: string,
    signal: AbortSignal,
  ): Promise<CaroTranscription> {
    const key = process.env.DEEPGRAM_API_KEY?.trim();

    if (key === undefined || key === '') {
      throw new CaroIaNotConfiguredError('Deepgram');
    }

    const baseUrl = (process.env.DEEPGRAM_API_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = process.env.DEEPGRAM_MODEL?.trim() || 'nova-3';
    const language = process.env.DEEPGRAM_LANGUAGE?.trim() || 'es';
    const query = new URLSearchParams({
      model,
      language,
      smart_format: 'true',
      punctuate: 'true',
    });
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combined = AbortSignal.any([signal, timeout]);

    let response: Response;

    try {
      const bytes = new Uint8Array(audio.byteLength);
      bytes.set(audio);
      response = await fetch(`${baseUrl}/v1/listen?${query.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${key}`,
          'Content-Type': mimeType,
        },
        body: new Blob([bytes], { type: mimeType }),
        signal: combined,
      });
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      throw new CaroIaProviderError('Deepgram is unavailable');
    }

    if (!response.ok) {
      throw new CaroIaProviderError(`Deepgram returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as DeepgramResponse;
    const alternative = body.results?.channels?.[0]?.alternatives?.[0];
    const text = alternative?.transcript?.trim() ?? '';

    if (text === '') {
      throw new CaroIaProviderError('Deepgram returned an empty transcription');
    }

    return {
      text,
      confidence: typeof alternative?.confidence === 'number' ? alternative.confidence : null,
      durationSeconds:
        typeof body.metadata?.duration === 'number' ? body.metadata.duration : null,
    };
  }
}
