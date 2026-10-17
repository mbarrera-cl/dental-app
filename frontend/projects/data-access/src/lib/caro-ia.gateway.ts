import type { Observable } from 'rxjs';
import type {
  CaroApprovalDecision,
  CaroAttachment,
  CaroConversation,
  CaroConversationDetail,
  CaroConversationQuery,
  CaroCreateConversationInput,
  CaroSendMessageInput,
  CaroStreamEvent,
  CaroTranscription,
} from './caro-ia.model';

/**
 * Puerto de la UI hacia CaroIA. La rama UI usa `CaroIaMockGateway`; la rama
 * backend lo implementa con HTTP + SSE (`CaroIaHttpGateway`). El store solo
 * conoce esta interfaz.
 */
export abstract class CaroIaGateway {
  abstract list(query?: CaroConversationQuery): Observable<CaroConversation[]>;
  abstract get(id: string): Observable<CaroConversationDetail>;
  abstract create(input?: CaroCreateConversationInput): Observable<CaroConversation>;
  abstract rename(id: string, title: string): Observable<CaroConversation>;
  abstract remove(id: string): Observable<void>;
  abstract send(conversationId: string, input: CaroSendMessageInput): Observable<CaroStreamEvent>;
  abstract uploadAttachment(conversationId: string, file: File): Observable<CaroAttachment>;
  abstract transcribeAudio(audio: Blob): Observable<CaroTranscription>;
  abstract decideApproval(
    conversationId: string,
    approvalId: string,
    decision: CaroApprovalDecision,
  ): Observable<CaroStreamEvent>;
}
