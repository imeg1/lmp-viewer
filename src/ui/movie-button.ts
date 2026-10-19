import { logger } from '../core/logger';
import type { LampaApi, LampaEvent } from '../lampa/types';

export const COMPONENT = 'lampa_stream';

export function addMovieButton(lampa: LampaApi, $: JQueryStatic, event: LampaEvent): void {
  if (event.type !== 'complite' || !event.data?.movie || !event.object?.activity) return;
  const root = event.object.activity.render();
  if (root.find('.view--lampa-stream').length) return;
  const container = root.find('.full-start__buttons').first();
  const torrent = root.find('.view--torrent').first();
  if (!container.length && !torrent.length) {
    logger.error('Контейнер кнопок карточки не найден');
    lampa.Noty.show('Lampa Stream: контейнер кнопок в карточке не найден.');
    return;
  }
  const button = $('<div class="full-start__button selector view--lampa-stream"></div>');
  button.append($('<span></span>').text('▶ Смотреть онлайн'));
  button.on('hover:enter.lampaStream', () => {
    try {
      lampa.Activity.push({
        url: '',
        title: 'Lampa Stream · Демонстрация',
        component: COMPONENT,
        movie: event.data?.movie,
        page: 1,
      });
    } catch (error) {
      logger.error('Не удалось открыть экран плагина', error);
      lampa.Noty.show('Не удалось открыть Lampa Stream. Перезапустите Lampa.');
    }
  });
  if (container.length) container.append(button);
  else torrent.after(button);
}
