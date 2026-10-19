import jquery from 'jquery';
import { vi } from 'vitest';
import type { EventBus, LampaApi, LampaEvent, Listener, PluginHost } from '../src/lampa/types';

export function eventBus() {
  const listeners: Record<string, Listener[]> = {};
  const bus: EventBus & {
    send(name: string, event?: LampaEvent): void;
    count(name: string): number;
  } = {
    follow: vi.fn((name: string, listener: Listener) => {
      (listeners[name] ||= []).push(listener);
    }),
    remove: vi.fn((name: string, listener: Listener) => {
      listeners[name] = (listeners[name] || []).filter((item) => item !== listener);
    }),
    send(name, event = {}) {
      (listeners[name] || []).slice().forEach((listener) => listener(event));
    },
    count: (name) => (listeners[name] || []).length,
  };
  return bus;
}

export function mockHost(autoStartPlayer = true) {
  const app = eventBus();
  const playerEvents = eventBus();
  const videoEvents = eventBus();
  const controllers: Record<string, Record<string, () => void>> = {};
  let currentController = 'content';
  const startPlayer = (item: { url: string; title: string }) => {
    playerEvents.send('start', item);
    lampa.Controller.add('player', { back: closePlayer });
    lampa.Controller.toggle('player');
    playerEvents.send('ready', item);
  };
  const closePlayer = () => {
    playerEvents.send('destroy');
    lampa.Controller.toggle('content');
  };
  const lampa: LampaApi = {
    Listener: app,
    Component: { add: vi.fn() },
    Activity: { push: vi.fn(), backward: vi.fn(), active: vi.fn() },
    Controller: {
      add: vi.fn((name, callbacks) => {
        controllers[name] = callbacks;
      }),
      toggle: vi.fn((name) => {
        currentController = name;
        controllers[name]?.toggle?.();
      }),
      collectionSet: vi.fn(),
      collectionFocus: vi.fn(),
    },
    Player: {
      play: vi.fn((item) => {
        playerEvents.send('create', { data: item });
        if (autoStartPlayer) startPlayer(item);
      }),
      playlist: vi.fn(),
      listener: playerEvents,
    },
    PlayerVideo: { listener: videoEvents },
    Noty: { show: vi.fn() },
    Manifest: { app_version: 'test-web-version' },
  };
  const host: PluginHost = {
    Lampa: lampa,
    $: jquery,
    Navigator: { move: vi.fn() },
    appready: true,
  };
  return {
    host,
    lampa,
    app,
    playerEvents,
    videoEvents,
    controllers,
    $: jquery,
    startPlayer,
    closePlayer,
    currentController: () => currentController,
  };
}
