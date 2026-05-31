const STORAGE_KEY = 'sc_listener_welcome_v1';

type ListenerWelcomeStorage = {
  pending: string[];
  seen: string[];
};

function normalizeUserId(userId: string | null | undefined): string {
  return userId?.trim() ?? '';
}

function readStorage(): ListenerWelcomeStorage {
  if (typeof window === 'undefined') {
    return { pending: [], seen: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { pending: [], seen: [] };
    const parsed = JSON.parse(raw) as Partial<ListenerWelcomeStorage>;
    return {
      pending: Array.isArray(parsed.pending)
        ? parsed.pending.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        : [],
      seen: Array.isArray(parsed.seen)
        ? parsed.seen.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [],
    };
  } catch {
    return { pending: [], seen: [] };
  }
}

function writeStorage(state: ListenerWelcomeStorage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function hasSeenListenerWelcome(userId: string): boolean {
  const id = normalizeUserId(userId);
  if (!id) return false;
  return readStorage().seen.includes(id);
}

export function shouldShowListenerWelcome(userId: string): boolean {
  const id = normalizeUserId(userId);
  if (!id) return false;
  const state = readStorage();
  return state.pending.includes(id) && !state.seen.includes(id);
}

/** Call after listener registration — persists until welcome is dismissed. */
export function markListenerWelcomePending(userId: string): void {
  const id = normalizeUserId(userId);
  if (!id || hasSeenListenerWelcome(id)) return;

  const state = readStorage();
  if (state.pending.includes(id)) return;

  writeStorage({
    ...state,
    pending: [...state.pending, id],
  });
}

export function markListenerWelcomeSeen(userId: string): void {
  const id = normalizeUserId(userId);
  if (!id) return;

  const state = readStorage();
  const pending = state.pending.filter((entry) => entry !== id);
  const seen = state.seen.includes(id) ? state.seen : [...state.seen, id];

  writeStorage({ pending, seen });
}

/** @internal Reset for tests. */
export function __resetListenerWelcomeStorageForTests(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
