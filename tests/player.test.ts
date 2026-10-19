import { describe, expect, it, vi } from 'vitest';
import { LampaPlayerAdapter } from '../src/lampa/player';
import { mockHost } from './helpers';

const video = { url: 'https://example.org/demo.mp4' };

describe('Lampa player adapter', () => {
  it('passes URL and title to the built-in player and replaces the playlist', () => {
    const { lampa } = mockHost();
    new LampaPlayerAdapter(lampa, vi.fn()).play(video, 'Demo');
    expect(lampa.Player.play).toHaveBeenCalledExactlyOnceWith({ ...video, title: 'Demo' });
    expect(lampa.Player.playlist).toHaveBeenCalledWith([{ ...video, title: 'Demo' }]);
  });

  it('reports fatal errors once and removes listeners on player destruction', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { lampa, videoEvents, playerEvents } = mockHost();
    const onError = vi.fn();
    new LampaPlayerAdapter(lampa, onError).play(video, 'Demo');
    videoEvents.send('error', { fatal: false });
    expect(onError).not.toHaveBeenCalled();
    videoEvents.send('error', { fatal: true });
    videoEvents.send('error', { fatal: true });
    expect(onError).toHaveBeenCalledTimes(1);
    playerEvents.send('destroy');
    expect(videoEvents.count('error')).toBe(0);
    expect(playerEvents.count('destroy')).toBe(0);
  });

  it('cleans up after a synchronous player failure and allows retry', () => {
    const { lampa, videoEvents } = mockHost();
    const adapter = new LampaPlayerAdapter(lampa, vi.fn());
    vi.mocked(lampa.Player.play).mockImplementationOnce(() => {
      throw new Error('player failed');
    });
    expect(() => adapter.play(video, 'Demo')).toThrow('player failed');
    expect(videoEvents.count('error')).toBe(0);
    adapter.play(video, 'Demo');
    adapter.play(video, 'Demo');
    expect(lampa.Player.play).toHaveBeenCalledTimes(2);
    expect(videoEvents.count('error')).toBe(1);
    adapter.dispose();
    expect(videoEvents.count('error')).toBe(0);
  });

  it('ignores replacement video errors even when the URL is the same', () => {
    const { lampa, videoEvents, playerEvents } = mockHost();
    const onError = vi.fn();
    const adapter = new LampaPlayerAdapter(lampa, onError);
    adapter.play(video, 'Demo');
    lampa.Player.play({ ...video, title: 'Another plugin' });
    videoEvents.send('error', { fatal: true });
    expect(onError).not.toHaveBeenCalled();
    expect(adapter.state).toBe('idle');
    for (const name of ['create', 'start', 'ready', 'destroy']) {
      expect(playerEvents.count(name)).toBe(0);
    }
    expect(videoEvents.count('error')).toBe(0);
    // Only our own ready event is allowed to change the playlist.
    expect(lampa.Player.playlist).toHaveBeenCalledTimes(1);
  });

  it('releases ownership on a foreign start even if create was not emitted', () => {
    const { lampa, playerEvents, videoEvents } = mockHost();
    const onError = vi.fn();
    const adapter = new LampaPlayerAdapter(lampa, onError);
    adapter.play(video, 'Demo');
    playerEvents.send('start', { url: 'https://example.org/other.mp4', title: 'Other' });
    videoEvents.send('error', { fatal: true });
    expect(onError).not.toHaveBeenCalled();
    expect(adapter.state).toBe('idle');
  });

  it('does not revive a removed session from a listener dispatch snapshot', () => {
    const { lampa, playerEvents, videoEvents } = mockHost();
    const onError = vi.fn();
    const adapter = new LampaPlayerAdapter(lampa, onError);
    let replaced = false;
    playerEvents.follow('start', () => {
      if (replaced) return;
      replaced = true;
      lampa.Player.play({ url: 'https://example.org/other.mp4', title: 'Other' });
    });
    adapter.play(video, 'Demo');
    videoEvents.send('error', { fatal: true });
    expect(adapter.state).toBe('idle');
    expect(onError).not.toHaveBeenCalled();
    expect(lampa.Player.playlist).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('locks delayed opening and playback until destruction, allowing retry afterwards', () => {
    const { lampa, startPlayer, closePlayer, videoEvents } = mockHost(false);
    const onError = vi.fn();
    const adapter = new LampaPlayerAdapter(lampa, onError);
    adapter.play(video, 'Demo');
    expect(adapter.state).toBe('opening');
    videoEvents.send('error', { fatal: true });
    expect(onError).not.toHaveBeenCalled();
    adapter.play(video, 'Demo');
    expect(lampa.Player.play).toHaveBeenCalledTimes(1);
    expect(lampa.Player.playlist).not.toHaveBeenCalled();
    startPlayer(vi.mocked(lampa.Player.play).mock.calls[0]![0]);
    expect(adapter.state).toBe('playing');
    adapter.cancelOpening();
    expect(adapter.state).toBe('playing');
    adapter.play(video, 'Demo');
    expect(lampa.Player.play).toHaveBeenCalledTimes(1);
    closePlayer();
    expect(adapter.state).toBe('idle');
    adapter.play(video, 'Demo');
    expect(lampa.Player.play).toHaveBeenCalledTimes(2);
    adapter.dispose();
  });

  it("releases cancelled opening subscriptions without closing someone else's player", () => {
    const { lampa, playerEvents, videoEvents } = mockHost(false);
    const adapter = new LampaPlayerAdapter(lampa, vi.fn());
    adapter.play(video, 'Demo');
    adapter.cancelOpening();
    adapter.dispose();
    expect(adapter.state).toBe('idle');
    expect(playerEvents.count('start')).toBe(0);
    expect(videoEvents.count('error')).toBe(0);
  });

  it('rejects non-HTTPS URLs before invoking Lampa', () => {
    const { lampa } = mockHost();
    expect(() =>
      new LampaPlayerAdapter(lampa, vi.fn()).play({ url: 'javascript:alert(1)' }, 'Demo'),
    ).toThrow();
    expect(lampa.Player.play).not.toHaveBeenCalled();
  });
});
