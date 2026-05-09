import { MessageItem } from '../types';

export const splitCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeUsernameForFilter = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('@') ? normalized.slice(1) : normalized;
};

export const isUserBlocked = (authorName: string, blockedUsers: string) => {
  if (!blockedUsers) return false;

  const author = normalizeUsernameForFilter(authorName);
  return splitCommaList(blockedUsers)
    .map(normalizeUsernameForFilter)
    .includes(author);
};

export const containsBlockedWord = (message: MessageItem[] | null, blockedWords: string) => {
  if (!blockedWords || !message) return false;

  const content = message.map((part) => part.Text || '').join(' ').toLowerCase();
  return splitCommaList(blockedWords)
    .map((word) => word.toLowerCase())
    .some((word) => content.includes(word));
};
