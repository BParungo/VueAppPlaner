import { useStorage } from '@vueuse/core';

const ADJECTIVES = [
  'Bold',
  'Calm',
  'Eager',
  'Witty',
  'Lucky',
  'Quick',
  'Brave',
  'Clever',
  'Sunny',
  'Mellow',
];
const ANIMALS = [
  'Otter',
  'Falcon',
  'Lynx',
  'Heron',
  'Badger',
  'Marten',
  'Ibex',
  'Newt',
  'Crane',
  'Vole',
];
const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface LocalUser {
  clientId: string;
  displayName: string;
  color: string;
}

export function useLocalUser() {
  const user = useStorage<LocalUser>(
    'vap.localUser',
    () => ({
      clientId: uuid(),
      displayName: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
      color: pick(COLORS),
    }),
    localStorage,
    { mergeDefaults: true },
  );

  function setDisplayName(name: string) {
    user.value = { ...user.value, displayName: name };
  }

  function setColor(color: string) {
    user.value = { ...user.value, color };
  }

  return { user, setDisplayName, setColor };
}
