import type { LampaApi, Listener, PluginHost } from '../lampa/types';
import { DemoSource } from '../sources/demo-source';
import { SourceRegistry } from '../sources/registry';
import { addMovieButton, COMPONENT } from '../ui/movie-button';
import { createVideoScreen } from '../ui/video-screen';
import { logger } from './logger';

function usable(lampa: LampaApi): boolean {
  return [
    lampa.Listener?.follow,
    lampa.Listener?.remove,
    lampa.Component?.add,
    lampa.Activity?.push,
    lampa.Activity?.backward,
    lampa.Activity?.active,
    lampa.Controller?.add,
    lampa.Controller?.toggle,
    lampa.Controller?.collectionSet,
    lampa.Controller?.collectionFocus,
    lampa.Player?.play,
    lampa.Player?.playlist,
    lampa.Player?.listener?.follow,
    lampa.Player?.listener?.remove,
    lampa.PlayerVideo?.listener?.follow,
    lampa.PlayerVideo?.listener?.remove,
    lampa.Noty?.show,
  ].every((method) => typeof method === 'function');
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
    if (
      !lampa ||
      typeof jquery !== 'function' ||
      typeof navigator?.move !== 'function' ||
      !usable(lampa)
    )
      return;
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
    } catch (error) {
      state.status = 'failed';
      logger.error('Ошибка инициализации; перезапустите Lampa', error);
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
      logger.error('Lampa не готова или API несовместимы после 60 секунд ожидания');
    }
  };
  const timer = setInterval(check, 500);
  check();
}
