/**
 * Phone notifications, in the Android app (see capacitor.config.ts): when you
 * leave the game, what's coming is scheduled on the phone (rested, out of
 * jail, court tomorrow, the room running out), and it tells you when it
 * happens, game closed or not. In a browser this does nothing.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface Upcoming {
  /** A small fixed number per kind of thing (one of each, replaced each time). */
  id: number;
  at: number;
  title: string;
  body: string;
}

export const isApp = () => Capacitor.isNativePlatform();

/** Asked once, while you're in the game (a phone won't ask while the app's in the background). */
export async function askPermission() {
  if (!isApp()) return;
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') await LocalNotifications.requestPermissions();
  } catch {
    /* */
  }
}
async function allowed(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** Replaces whatever was scheduled with these (the ones still to come). */
/** One at a time: leaving and coming straight back mustn't leave reminders set behind you. */
let queue: Promise<void> = Promise.resolve();
export function scheduleAll(list: Upcoming[]): Promise<void> {
  return (queue = queue.then(() => doSchedule(list)));
}
export function clearAll(): Promise<void> {
  return (queue = queue.then(doClear));
}
async function doSchedule(list: Upcoming[]) {
  if (!isApp()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const t = Date.now();
    const next = list.filter((n) => n.at > t + 30_000);
    if (!next.length || !(await allowed())) return;
    await LocalNotifications.schedule({
      notifications: next.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, smallIcon: 'ic_stat_darcvoyd', iconColor: '#b3261e' })),
    });
  } catch {
    /* (No notifications this time: the game goes on without them.) */
  }
}
/** Back in the game: what was scheduled would only repeat what's on the screen. */
async function doClear() {
  if (!isApp()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch {
    /* */
  }
}

/**
 * The app build (its versionCode, the GitHub run that built it) this game
 * needs: raised whenever the app itself changes. Older, and the game says
 * there's a new app to download.
 */
export const APP_BUILD_NEEDED = 1;
export const APP_DOWNLOAD = 'https://github.com/WH173-0U7/Unamed-/releases/latest/download/DarcVoyd.apk';
