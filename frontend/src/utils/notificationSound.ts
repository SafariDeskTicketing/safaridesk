let sharedNotificationAudio: HTMLAudioElement | null = null;
let audioPrimed = false;
let lastPlaybackAt = 0;
let suppressRealtimeSoundUntil = 0;

const PLAYBACK_COOLDOWN_MS = 1000;
const SUPPRESS_REALTIME_AFTER_LOCAL_CREATE_MS = 3500;

export const LOCAL_NOTIFICATION_CREATED_EVENT = 'safaridesk:local-notification-created';

const getNotificationAudio = () => {
  if (!sharedNotificationAudio) {
    sharedNotificationAudio = new Audio('/notification-sound.mp3');
    sharedNotificationAudio.preload = 'auto';
    sharedNotificationAudio.volume = 1;
  }
  return sharedNotificationAudio;
};

export const primeNotificationSound = () => {
  try {
    getNotificationAudio();
    audioPrimed = true;
  } catch {
    // Ignore priming failures. Playback attempts remain safe.
  }
};

export const emitLocalNotificationCreated = () => {
  window.dispatchEvent(new Event(LOCAL_NOTIFICATION_CREATED_EVENT));
};

export const playNotificationSound = async (
  priority?: string | null,
  source: 'realtime' | 'local-create' = 'realtime'
) => {
  try {
    if (!audioPrimed) return;

    const now = Date.now();
    if (source === 'local-create') {
      suppressRealtimeSoundUntil = now + SUPPRESS_REALTIME_AFTER_LOCAL_CREATE_MS;
    } else if (now < suppressRealtimeSoundUntil) {
      return;
    }

    if (now - lastPlaybackAt < PLAYBACK_COOLDOWN_MS) {
      return;
    }
    lastPlaybackAt = now;

    const audio = getNotificationAudio();
    audio.currentTime = 0;
    await audio.play();

    const normalizedPriority = priority?.toLowerCase();
    if (normalizedPriority === 'urgent' || normalizedPriority === 'critical') {
      window.setTimeout(() => {
        const urgentEcho = new Audio('/notification-sound.mp3');
        urgentEcho.volume = 1;
        void urgentEcho.play();
      }, 320);
    }
  } catch {
    // Ignore playback failures so create flows still complete successfully.
  }
};