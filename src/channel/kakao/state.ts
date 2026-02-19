export interface KakaoConversationRef {
  channelId: string;
  userId: string;
}

export interface KakaoChannelState {
  hasProcessedEvent(eventId: string): boolean;
  markEventProcessed(eventId: string): void;
  getConversationId(ref: KakaoConversationRef): string | undefined;
  setConversationId(ref: KakaoConversationRef, conversationId: string): void;
}

const toConversationKey = (ref: KakaoConversationRef): string => `${ref.channelId}:${ref.userId}`;

export class InMemoryKakaoChannelState implements KakaoChannelState {
  private readonly processedEvents = new Set<string>();

  private readonly conversationMap = new Map<string, string>();

  public hasProcessedEvent(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  public markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
  }

  public getConversationId(ref: KakaoConversationRef): string | undefined {
    return this.conversationMap.get(toConversationKey(ref));
  }

  public setConversationId(ref: KakaoConversationRef, conversationId: string): void {
    this.conversationMap.set(toConversationKey(ref), conversationId);
  }
}

export const createDefaultKakaoChannelState = (): KakaoChannelState =>
  new InMemoryKakaoChannelState();

export { toConversationKey };
