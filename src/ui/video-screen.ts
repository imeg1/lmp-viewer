import { logger } from '../core/logger';
import { LampaPlayerAdapter } from '../lampa/player';
import type { LampaApi, RemoteNavigator, ScreenInstance, ScreenOptions } from '../lampa/types';
import { DEMO_CREDIT } from '../sources/demo-source';
import type { Movie, VideoSource } from '../sources/types';

export function normalizeMovie(raw: Record<string, unknown> = {}): Movie {
  const date = typeof raw.release_date === 'string' ? raw.release_date : '';
  const year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined;
  return {
    id: String(raw.id ?? ''),
    title: typeof raw.title === 'string' ? raw.title : 'Фильм',
    originalTitle: typeof raw.original_title === 'string' ? raw.original_title : undefined,
    year,
    imdbId: typeof raw.imdb_id === 'string' ? raw.imdb_id : undefined,
    kinopoiskId:
      typeof raw.kinopoisk_id === 'string' || typeof raw.kinopoisk_id === 'number'
        ? String(raw.kinopoisk_id)
        : undefined,
  };
}

export function createVideoScreen(
  lampa: LampaApi,
  $: JQueryStatic,
  navigator: RemoteNavigator,
  source: VideoSource,
): new (options: ScreenOptions) => ScreenInstance {
  return class VideoScreen implements ScreenInstance {
    activity!: ScreenInstance['activity'];
    private readonly root = $('<div class="lampa-stream-screen"></div>');
    private readonly button = $('<div class="selector lampa-stream-play"></div>').text(
      '▶ Воспроизвести тестовое видео',
    );
    private readonly status = $('<p role="status" aria-live="polite"></p>');
    private readonly movie: Movie;
    private readonly player: LampaPlayerAdapter;
    private searching = false;
    private requestId = 0;
    private active = false;
    private destroyed = false;

    constructor(options: ScreenOptions) {
      this.movie = normalizeMovie(options.movie);
      this.player = new LampaPlayerAdapter(lampa, () => this.showError());
      this.root.append(
        $('<h1></h1>').text(this.movie.title),
        $('<p></p>').text('Демонстрационный режим. Будет показано тестовое видео Big Buck Bunny.'),
        this.button,
        this.status,
        $('<p class="lampa-stream-credit"></p>').text(DEMO_CREDIT),
      );
      this.button.on('hover:enter.lampaStream', () => void this.play());
    }

    create(): JQuery {
      this.activity.loader(false);
      return this.render();
    }

    start(): void {
      if (this.destroyed || lampa.Activity.active()?.activity !== this.activity) return;
      this.active = true;
      lampa.Controller.add('content', {
        toggle: () => {
          if (!this.isActive()) return;
          // Returning from a cancelled launch must permit another OK.
          this.player.cancelOpening();
          lampa.Controller.collectionSet(this.root);
          lampa.Controller.collectionFocus(this.button[0] || false, this.root);
        },
        up: () => navigator.move('up'),
        down: () => navigator.move('down'),
        left: () => navigator.move('left'),
        right: () => navigator.move('right'),
        back: () => {
          this.pause();
          lampa.Activity.backward();
        },
      });
      lampa.Controller.toggle('content');
    }

    private async play(): Promise<void> {
      if (!this.isActive() || this.searching || this.player.state !== 'idle') return;
      const request = ++this.requestId;
      this.searching = true;
      this.status.text('Подготовка тестового видео…');
      try {
        const results = await source.search(this.movie);
        if (request !== this.requestId || !this.isActive()) return;
        const result = results[0];
        const stream = result?.streams[0];
        if (!stream || !result) throw new Error('Demo source returned no video');
        this.status.text('Демонстрационное видео. Для возврата нажмите «Назад».');
        this.player.play(stream, result.title);
      } catch (error) {
        logger.error('Не удалось запустить демонстрационное видео', error);
        if (request === this.requestId) this.showError();
      } finally {
        if (request === this.requestId) this.searching = false;
      }
    }

    private isActive(): boolean {
      return this.active && !this.destroyed && lampa.Activity.active()?.activity === this.activity;
    }

    private showError(): void {
      if (!this.isActive()) return;
      const message =
        'Не удалось воспроизвести тестовое видео. Проверьте интернет и повторите попытку.';
      this.status.text(message);
      lampa.Noty.show(message);
    }

    render(): JQuery {
      return this.root;
    }

    pause(): void {
      this.active = false;
      this.requestId++;
      if (this.searching)
        this.status.text('Подготовка отменена. Нажмите OK для повторного запуска.');
      this.searching = false;
    }

    stop(): void {
      this.pause();
    }

    destroy(): void {
      this.destroyed = true;
      this.pause();
      this.player.dispose();
      this.button.off('.lampaStream');
      this.root.remove();
    }
  };
}
