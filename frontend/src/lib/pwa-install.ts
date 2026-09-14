// Captura o evento antes de o React montar, inclusive em navegações internas.
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let pending: InstallPromptEvent | null = null;
let installed = window.matchMedia('(display-mode: standalone)').matches;
let snapshot = { available: false, installed };
const listeners = new Set<() => void>();

function notify() {
  snapshot = { available: pending !== null, installed };
  listeners.forEach((listener) => listener());
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pending = event as InstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  installed = true;
  pending = null;
  notify();
});

window.matchMedia('(display-mode: standalone)').addEventListener('change', (event) => {
  installed = event.matches;
  notify();
});

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getInstallSnapshot() { return snapshot; }

export async function installForja(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = pending;
  if (!event) return 'unavailable';
  pending = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome;
}
