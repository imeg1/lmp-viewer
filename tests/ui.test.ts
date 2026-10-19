import { afterEach, describe, expect, it, vi } from 'vitest';
import { addMovieButton } from '../src/ui/movie-button';
import { createVideoScreen } from '../src/ui/video-screen';
import type { VideoResult, VideoSource } from '../src/sources/types';
import { mockHost } from './helpers';

const result: VideoResult[] = [
  { id: 'demo', title: 'Демонстрация', streams: [{ url: 'https://example.org/demo.mp4' }] },
];

function screenWith(source: VideoSource, autoStartPlayer = true) {
  const mock = mockHost(autoStartPlayer);
  const Screen = createVideoScreen(mock.lampa, mock.$, mock.host.Navigator!, source);
  const screen = new Screen({ movie: { id: 42, title: '<img src=x onerror=alert(1)>' } });
  screen.activity = { loader: vi.fn() };
  vi.mocked(mock.lampa.Activity.active).mockReturnValue({ activity: screen.activity });
  document.body.appendChild(screen.create()[0]!);
  screen.start();
  return { ...mock, screen };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
afterEach(() => {
  document.body.innerHTML = '';
});

describe('movie button', () => {
  it('does not duplicate buttons on repeated full events and opens the selected movie', () => {
    const { lampa, $ } = mockHost();
    const root = $('<div><div class="full-start__buttons"></div></div>');
    const movie = { id: 42, title: 'Movie' };
    const event = {
      type: 'complite',
      data: { movie },
      object: { activity: { render: () => root } },
    };
    addMovieButton(lampa, $, event);
    addMovieButton(lampa, $, event);
    expect(root.find('.view--lampa-stream')).toHaveLength(1);
    root.find('.view--lampa-stream').trigger('hover:enter');
    expect(lampa.Activity.push).toHaveBeenCalledWith(
      expect.objectContaining({ movie, component: 'lampa_stream' }),
    );
  });

  it('supports the reference layout with a torrent button', () => {
    const { lampa, $ } = mockHost();
    const root = $('<div><div class="view--torrent"></div></div>');
    addMovieButton(lampa, $, {
      type: 'complite',
      data: { movie: {} },
      object: { activity: { render: () => root } },
    });
    expect(root.find('.view--torrent').next().hasClass('view--lampa-stream')).toBe(true);
  });
});

describe('video screen', () => {
  it('escapes movie titles, marks demo mode, supports arrows and Back', () => {
    const { screen, controllers, host, lampa } = screenWith({
      id: 'demo',
      name: 'Demo',
      search: vi.fn().mockResolvedValue(result),
    });
    expect(screen.render().find('img')).toHaveLength(0);
    expect(screen.render().text()).toContain('Демонстрационный режим');
    expect(lampa.Controller.collectionFocus).toHaveBeenCalled();
    controllers.content?.left?.();
    expect(host.Navigator?.move).toHaveBeenCalledWith('left');
    controllers.content?.back?.();
    expect(lampa.Activity.backward).toHaveBeenCalledTimes(1);
    screen.destroy();
  });

  it('plays, returns focus on player Back, retries, then restores the card controller', async () => {
    const search = vi.fn().mockResolvedValue(result);
    const { screen, lampa, controllers, currentController } = screenWith({
      id: 'demo',
      name: 'Demo',
      search,
    });
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ id: '42' }));
    expect(lampa.Player.play).toHaveBeenCalledWith({
      url: 'https://example.org/demo.mp4',
      title: 'Демонстрация',
    });
    expect(currentController()).toBe('player');
    vi.mocked(lampa.Controller.collectionFocus).mockClear();
    // Emulate Back through the player controller, not a direct content toggle.
    controllers.player?.back?.();
    expect(currentController()).toBe('content');
    expect(lampa.Controller.collectionFocus).toHaveBeenCalledTimes(1);
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    expect(lampa.Player.play).toHaveBeenCalledTimes(2);
    controllers.player?.back?.();
    const cardFocus = vi.fn();
    // Lampa's Activity wrapper starts the previous component when going Back.
    vi.mocked(lampa.Activity.backward).mockImplementation(() => {
      screen.destroy();
      vi.mocked(lampa.Activity.active).mockReturnValue(undefined);
      lampa.Controller.add('content', { toggle: cardFocus });
      lampa.Controller.toggle('content');
    });
    controllers.content?.back?.();
    expect(cardFocus).toHaveBeenCalledTimes(1);
    expect(currentController()).toBe('content');
  });

  it('blocks repeated OK after search resolves while the player is still opening', async () => {
    const search = vi.fn().mockResolvedValue(result);
    const { screen, lampa, startPlayer, closePlayer } = screenWith(
      { id: 'demo', name: 'Demo', search },
      false,
    );
    const button = screen.render().find('.selector');
    button.trigger('hover:enter');
    await flush();
    button.trigger('hover:enter');
    await flush();
    expect(search).toHaveBeenCalledTimes(1);
    expect(lampa.Player.play).toHaveBeenCalledTimes(1);
    startPlayer(vi.mocked(lampa.Player.play).mock.calls[0]![0]);
    button.trigger('hover:enter');
    await flush();
    expect(search).toHaveBeenCalledTimes(1);
    closePlayer();
    button.trigger('hover:enter');
    await flush();
    expect(search).toHaveBeenCalledTimes(2);
    screen.destroy();
  });

  it('permits retry after an opening is cancelled and control returns to content', async () => {
    const search = vi.fn().mockResolvedValue(result);
    const { screen, lampa } = screenWith({ id: 'demo', name: 'Demo', search }, false);
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    lampa.Controller.toggle('content');
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    expect(lampa.Player.play).toHaveBeenCalledTimes(2);
    screen.destroy();
  });

  it.each(['pause', 'stop'] as const)(
    'invalidates a request on %s even after returning, preserving a newer request',
    async (method) => {
      let resolveOld!: (results: VideoResult[]) => void;
      let resolveNew!: (results: VideoResult[]) => void;
      const oldRequest = new Promise<VideoResult[]>((resolve) => {
        resolveOld = resolve;
      });
      const newRequest = new Promise<VideoResult[]>((resolve) => {
        resolveNew = resolve;
      });
      const search = vi.fn().mockReturnValueOnce(oldRequest).mockReturnValueOnce(newRequest);
      const { screen, lampa } = screenWith({ id: 'demo', name: 'Demo', search });
      const button = screen.render().find('.selector');
      button.trigger('hover:enter');
      screen[method]();
      vi.mocked(lampa.Activity.active).mockReturnValue(undefined);
      vi.mocked(lampa.Activity.active).mockReturnValue({ activity: screen.activity });
      screen.start();
      button.trigger('hover:enter');
      resolveOld(result);
      await flush();
      expect(lampa.Player.play).not.toHaveBeenCalled();
      button.trigger('hover:enter');
      expect(search).toHaveBeenCalledTimes(2);
      resolveNew(result);
      await flush();
      expect(lampa.Player.play).toHaveBeenCalledTimes(1);
      screen.destroy();
    },
  );

  it('does not display playback errors from a retained inactive screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { screen, lampa, videoEvents } = screenWith({
      id: 'demo',
      name: 'Demo',
      search: vi.fn().mockResolvedValue(result),
    });
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    screen.pause();
    videoEvents.send('error', { fatal: true });
    expect(lampa.Noty.show).not.toHaveBeenCalled();
    screen.destroy();
  });

  it('ignores a rejected stale request after leaving and returning', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let reject!: (error: Error) => void;
    const pending = new Promise<VideoResult[]>((_resolve, fail) => {
      reject = fail;
    });
    const { screen, lampa } = screenWith({ id: 'demo', name: 'Demo', search: () => pending });
    screen.render().find('.selector').trigger('hover:enter');
    screen.pause();
    screen.start();
    reject(new Error('obsolete failure'));
    await flush();
    expect(lampa.Noty.show).not.toHaveBeenCalled();
    expect(lampa.Player.play).not.toHaveBeenCalled();
    screen.destroy();
  });

  it.each(['reject', 'empty'])('handles %s source results and allows retry', async (mode) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const search =
      mode === 'reject'
        ? vi.fn().mockRejectedValue(new Error('offline'))
        : vi.fn().mockResolvedValue([]);
    const { screen, lampa } = screenWith({ id: 'broken', name: 'Broken', search });
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    expect(lampa.Noty.show).toHaveBeenCalled();
    expect(lampa.Player.play).not.toHaveBeenCalled();
    search.mockResolvedValue(result);
    screen.render().find('.selector').trigger('hover:enter');
    await flush();
    expect(lampa.Player.play).toHaveBeenCalledTimes(1);
    screen.destroy();
  });

  it.each(['destroy', 'leave'])('does not start delayed video after %s', async (action) => {
    let resolve!: (results: VideoResult[]) => void;
    const pending = new Promise<VideoResult[]>((done) => {
      resolve = done;
    });
    const search = vi.fn(() => pending);
    const { screen, lampa } = screenWith({ id: 'slow', name: 'Slow', search });
    screen.render().find('.selector').trigger('hover:enter').trigger('hover:enter');
    expect(search).toHaveBeenCalledTimes(1);
    if (action === 'destroy') screen.destroy();
    else vi.mocked(lampa.Activity.active).mockReturnValue(undefined);
    resolve(result);
    await flush();
    expect(lampa.Player.play).not.toHaveBeenCalled();
    screen.destroy();
  });
});
