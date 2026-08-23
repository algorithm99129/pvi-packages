/** Socket.IO namespace for predefined chat broadcasts. */
export const CHAT_SOCKET_NAMESPACE = '/chat';

export const CHAT_SOCKET_EVENTS = {
  subscribe: 'chat:subscribe',
  send: 'chat:send',
  message: 'chat:message',
} as const;

export type ChatChannel = 'global' | 'team';

export interface ChatPhraseDefinition {
  id: string;
  text: string;
  category?: string;
}

export interface ChatEmojiDefinition {
  id: string;
  /** Unicode glyph shown in UI and chat history. */
  glyph: string;
}

export interface ChatCatalog {
  phrases: ChatPhraseDefinition[];
  emojis: ChatEmojiDefinition[];
}

export interface ChatMessagePayload {
  id: string;
  channel: ChatChannel;
  teamId?: string;
  senderUserId: string;
  senderDisplayName: string;
  senderAvatarId: string;
  phraseId?: string;
  emojiId?: string;
  /** Resolved phrase text or emoji glyph for display. */
  text: string;
  sentAt: string;
}

export interface ChatSendPayload {
  channel: ChatChannel;
  phraseId?: string;
  emojiId?: string;
}

export const CHAT_FOLDER = 'Chat';

export const DEFAULT_CHAT_CATALOG: ChatCatalog = {
  phrases: [
    { id: 'hello', text: 'Hello!', category: 'greeting' },
    { id: 'good_luck', text: 'Good luck!', category: 'greeting' },
    { id: 'welcome', text: 'Welcome!', category: 'greeting' },
    { id: 'good_job', text: 'Good job!', category: 'praise' },
    { id: 'well_defended', text: 'Well defended!', category: 'praise' },
    { id: 'thanks', text: 'Thanks!', category: 'praise' },
    { id: 'need_help', text: 'Need help?', category: 'team' },
    { id: 'rally_up', text: 'Rally up!', category: 'team' },
    { id: 'defend_now', text: 'Defend now!', category: 'team' },
    { id: 'attack_now', text: 'Attack now!', category: 'battle' },
    { id: 'hold_line', text: 'Hold the line!', category: 'battle' },
    { id: 'garden_alert', text: 'Garden under attack!', category: 'battle' },
    { id: 'oops', text: 'Oops!', category: 'general' },
  ],
  emojis: [
    { id: 'wave', glyph: '👋' },
    { id: 'thumbs_up', glyph: '👍' },
    { id: 'fire', glyph: '🔥' },
    { id: 'skull', glyph: '💀' },
    { id: 'plant', glyph: '🌻' },
    { id: 'leaf', glyph: '🍃' },
    { id: 'bug', glyph: '🐛' },
    { id: 'swords', glyph: '⚔️' },
    { id: 'shield', glyph: '🛡️' },
    { id: 'trophy', glyph: '🏆' },
    { id: 'heart', glyph: '❤️' },
    { id: 'party', glyph: '🎉' },
  ],
};

export function normalizeChatCatalog(raw: unknown): ChatCatalog {
  if (!raw || typeof raw !== 'object') {
    return { phrases: [], emojis: [] };
  }
  const row = raw as Partial<ChatCatalog>;
  const phrases = Array.isArray(row.phrases)
    ? row.phrases
        .map((p) => {
          if (!p || typeof p !== 'object') return null;
          const id = String((p as ChatPhraseDefinition).id ?? '').trim();
          const text = String((p as ChatPhraseDefinition).text ?? '').trim();
          if (!id || !text) return null;
          const category = (p as ChatPhraseDefinition).category;
          return {
            id,
            text,
            ...(category ? { category: String(category).trim() } : {}),
          };
        })
        .filter((p): p is ChatPhraseDefinition => Boolean(p))
    : [];
  const emojis = Array.isArray(row.emojis)
    ? row.emojis
        .map((e) => {
          if (!e || typeof e !== 'object') return null;
          const id = String((e as ChatEmojiDefinition).id ?? '').trim();
          const glyph = String((e as ChatEmojiDefinition).glyph ?? '').trim();
          if (!id || !glyph) return null;
          return { id, glyph };
        })
        .filter((e): e is ChatEmojiDefinition => Boolean(e))
    : [];
  return { phrases, emojis };
}
