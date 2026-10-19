import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from '../src/core/bootstrap';
import type { PluginHost } from '../src/lampa/types';
import { mockHost } from './helpers';

describe('bootstrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.head.innerHTML = '';
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('registers once, including when the script is executed twice', () => {
    const { host, lampa, app } = mockHost();
    bootstrap(host);
    bootstrap(host);
    app.send('app', { type: 'ready' });
    expect(lampa.Component.add).toHaveBeenCalledTimes(1);
    expect(app.count('full')).toBe(1);
    expect(app.count('app')).toBe(0);
    expect(document.querySelectorAll('#lampa-stream-style')).toHaveLength(1);
    expect(host.__lampaStream?.status).toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for ready and ignores unrelated app events', () => {
    const { host, lampa, app } = mockHost();
    host.appready = false;
    bootstrap(host);
    app.send('app', { type: 'start' });
    expect(lampa.Component.add).not.toHaveBeenCalled();
    app.send('app', { type: 'ready' });
    expect(lampa.Component.add).toHaveBeenCalledTimes(1);
  });

  it('handles absent Lampa without throwing and stops waiting', () => {
    const host: PluginHost = {};
    expect(() => bootstrap(host)).not.toThrow();
    vi.advanceTimersByTime(60_000);
    expect(host.__lampaStream?.status).toBe('failed');
    expect(vi.getTimerCount()).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it('handles Lampa appearing after the script has loaded', () => {
    const host: PluginHost = {};
    bootstrap(host);
    const available = mockHost();
    Object.assign(host, available.host);
    vi.advanceTimersByTime(500);
    expect(available.lampa.Component.add).toHaveBeenCalledTimes(1);
  });

  it('rejects incomplete APIs without a partial registration', () => {
    const { host, lampa } = mockHost();
    host.Navigator = undefined;
    bootstrap(host);
    vi.advanceTimersByTime(60_000);
    expect(lampa.Component.add).not.toHaveBeenCalled();
    expect(host.__lampaStream?.status).toBe('failed');
  });
});
