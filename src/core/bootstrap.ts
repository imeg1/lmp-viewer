import type { LampaApi, Listener, PluginHost } from '../lampa/types';
import { DemoSource } from '../sources/demo-source';
import { SourceRegistry } from '../sources/registry';
import { addMovieButton, COMPONENT } from '../ui/movie-button';
import { createVideoScreen } from '../ui/video-screen';
import { logger } from './logger';

function missingApis(host: PluginHost): string[] {
  const lampa = host.Lampa;
  const methods: Record<string, unknown> = {
    jQuery: host.$,
    'Navigator.move': host.Navigator?.move,
    'Listener.follow': lampa?.Listener?.follow,
    'Listener.remove': lampa?.Listener?.remove,
    'Component.add': lampa?.Component?.add,
    'Activity.push': lampa?.Activity?.push,
    'Activity.backward': lampa?.Activity?.backward,
    'Activity.active': lampa?.Activity?.active,
    'Controller.add': lampa?.Controller?.add,
    'Controller.toggle': lampa?.Controller?.toggle,
    'Controller.collectionSet': lampa?.Controller?.collectionSet,
    'Controller.collectionFocus': lampa?.Controller?.collectionFocus,
    'Player.play': lampa?.Player?.play,
    'Player.playlist': lampa?.Player?.playlist,
    'Player.listener.follow': lampa?.Player?.listener?.follow,
    'Player.listener.remove': lampa?.Player?.listener?.remove,
    'PlayerVideo.listener.follow': lampa?.PlayerVideo?.listener?.follow,
    'PlayerVideo.listener.remove': lampa?.PlayerVideo?.listener?.remove,
    'Noty.show': lampa?.Noty?.show,
  };
  return Object.keys(methods).filter((name) => typeof methods[name] !== 'function');
}

function installStyle(): void {
  if (document.getElementById('lampa-stream-style')) return;
  const style = document.createElement('style');
  style.id = 'lampa-stream-style';
  style.textContent = `
    .lampa-stream-screen{padding:2em;max-width:65em}
    .lampa-stream-screen h1{font-size:1.7em;margin-bottom:.7em}
    .lampa-stream-screen p{line-height:1.5;margin:1em 0}
    .lampa-stream-play{display:inline-block;padding:1em 1.4em;border:2px solid #888;border-radius:.4em;margin:.8em 0}
    .lampa-stream-play.focus{background:#fff;color:#111;border-color:#fff}
    .lampa-stream-credit{font-size:.75em;opacity:.7}
  `;
  document.head.appendChild(style);
}

export function bootstrap(host: PluginHost): void {
  if (host.__lampaStream) return;
  const state = { status: 'waiting' as 'waiting' | 'ready' | 'failed' };
  host.__lampaStream = state;
  let attempts = 0;
  let bus: LampaApi['Listener'] | undefined;
  const detach = () => {
    clearInterval(timer);
    bus?.remove('app', ready);
  };
  const start = () => {
    if (state.status !== 'waiting') return;
    const { Lampa: lampa, $: jquery, Navigator: navigator } = host;
    if (!lampa || !jquery || !navigator || missingApis(host).length) return;
    detach();
    try {
      const registry = new SourceRegistry();
      registry.register(new DemoSource());
      installStyle();
      lampa.Component.add(
        COMPONENT,
        createVideoScreen(lampa, jquery, navigator, registry.get('demo')),
      );
      lampa.Listener.follow('full', (event) => {
        try {
          addMovieButton(lampa, jquery, event);
        } catch (error) {
          logger.error('Ошибка добавления кнопки в карточку', error);
        }
      });
      state.status = 'ready';
      logger.info(`MVP 0.1.0 готов; Lampa web ${lampa.Manifest?.app_version ?? 'неизвестна'}`);
      lampa.Noty.show('Lampa Stream: плагин готов. Откройте карточку фильма.');
    } catch (error) {
      state.status = 'failed';
      logger.error('Ошибка инициализации; перезапустите Lampa', error);
      host.Lampa?.Noty?.show?.('Lampa Stream: ошибка инициализации.');
    }
  };
  const ready: Listener = (event) => {
    if (event.type === 'ready') start();
  };
  const check = () => {
    attempts++;
    if (
      !bus &&
      typeof host.Lampa?.Listener?.follow === 'function' &&
      typeof host.Lampa.Listener.remove === 'function'
    ) {
      bus = host.Lampa.Listener;
      bus.follow('app', ready);
    }
    if (host.appready) start();
    if (attempts >= 120 && state.status === 'waiting') {
      detach();
      state.status = 'failed';
      const missing = missingApis(host);
      const message = missing.length
        ? `Lampa Stream: недоступны API: ${missing.join(', ')}`
        : 'Lampa Stream: не получен сигнал готовности Lampa.';
      logger.error(message);
      host.Lampa?.Noty?.show?.(message);
    }
  };
  const timer = setInterval(check, 500);
  check();
}
