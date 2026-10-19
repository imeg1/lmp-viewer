import { logger } from '../core/logger';
import type { VideoStream } from '../sources/types';
import type { LampaApi, Listener } from './types';

export interface PlayerAdapter {
  readonly state: 'idle' | 'opening' | 'playing';
  play(video: VideoStream, title: string): void;
  cancelOpening(): void;
  dispose(): void;
}

export class LampaPlayerAdapter implements PlayerAdapter {
  private cleanup: (() => void) | undefined;
  private phase: PlayerAdapter['state'] = 'idle';

  get state(): PlayerAdapter['state'] {
    return this.phase;
  }

  constructor(
    private readonly lampa: LampaApi,
    private readonly onError: () => void,
  ) {}

  play(video: VideoStream, title: string): void {
    if (!/^https:\/\/[^\s]+$/i.test(video.url)) throw new Error('Expected an HTTPS video URL');
    if (this.phase !== 'idle') return;
    const item = { url: video.url, title };
    let active = true;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let reported = false;
    const reportError = () => {
      if (reported) return;
      reported = true;
      logger.error('Ошибка загрузки демонстрационного видео');
      this.onError();
    };
    this.phase = 'opening';
    // Also bound the wait before start (including a stalled preroll).
    loadTimer = setTimeout(() => {
      if (active) reportError();
    }, 90000);
    // Lampa forwards the same data object to create, start and ready.
    // A matching URL alone cannot distinguish another plugin's session.
    const create: Listener = (event) => {
      if (active && event.data !== item) this.dispose();
    };
    const start: Listener = (event) => {
      if (!active) return;
      if (event !== item) this.dispose();
      else if (this.phase !== 'playing') {
        this.phase = 'playing';
        clearTimeout(loadTimer);
        // Player.start follows the preroll; do not count advertising time.
        loadTimer = setTimeout(() => {
          if (active && this.phase === 'playing') reportError();
        }, 30000);
      }
    };
    const ready: Listener = (event) => {
      if (active && event === item && this.phase === 'playing') {
        this.lampa.Player.playlist([item]);
      }
    };
    const progress: Listener = (event) => {
      // loadeddata can arrive while playback is still stuck buffering.
      if (
        active &&
        this.phase === 'playing' &&
        typeof event.current === 'number' &&
        event.current > 0
      ) {
        clearTimeout(loadTimer);
      }
    };
    const error: Listener = (event) => {
      // During opening, video errors may still belong to the previous item.
      if (!active || event.fatal === false || this.phase !== 'playing') return;
      this.dispose();
      reportError();
    };
    const destroy: Listener = () => {
      if (active) this.dispose();
    };
    this.cleanup = () => {
      // Lampa sends a snapshot of listeners: a removed callback can still run
      // during the current dispatch. Keep it inert after releasing ownership.
      active = false;
      clearTimeout(loadTimer);
      this.lampa.PlayerVideo.listener.remove('timeupdate', progress);
      this.lampa.PlayerVideo.listener.remove('error', error);
      this.lampa.Player.listener.remove('create', create);
      this.lampa.Player.listener.remove('start', start);
      this.lampa.Player.listener.remove('ready', ready);
      this.lampa.Player.listener.remove('destroy', destroy);
    };
    try {
      this.lampa.PlayerVideo.listener.follow('timeupdate', progress);
      this.lampa.PlayerVideo.listener.follow('error', error);
      this.lampa.Player.listener.follow('create', create);
      this.lampa.Player.listener.follow('start', start);
      this.lampa.Player.listener.follow('ready', ready);
      this.lampa.Player.listener.follow('destroy', destroy);
      this.lampa.Player.play(item);
    } catch (error) {
      if (active) this.dispose();
      throw error;
    }
  }

  cancelOpening(): void {
    if (this.phase === 'opening') this.dispose();
  }

  dispose(): void {
    const cleanup = this.cleanup;
    this.cleanup = undefined;
    this.phase = 'idle';
    cleanup?.();
  }
}
