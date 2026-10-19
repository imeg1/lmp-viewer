// Only the external API surface used by this plugin. See docs/lampa-api.md.
export interface LampaEvent {
  type?: string;
  fatal?: boolean;
  url?: string;
  title?: string;
  data?: { movie?: Record<string, unknown>; url?: string; title?: string };
  object?: { activity: { render(): JQuery } };
}

export type Listener = (event: LampaEvent) => void;
export interface EventBus {
  follow(name: string, listener: Listener): void;
  remove(name: string, listener: Listener): void;
}

export interface ScreenOptions {
  movie?: Record<string, unknown>;
}

export interface ScreenInstance {
  activity: { loader(loading: boolean): void };
  create(): JQuery;
  start(): void;
  render(): JQuery;
  pause(): void;
  stop(): void;
  destroy(): void;
}

export interface LampaApi {
  Listener: EventBus;
  Component: { add(name: string, component: new (options: ScreenOptions) => ScreenInstance): void };
  Activity: {
    push(
      options: ScreenOptions & { url: string; title: string; component: string; page: number },
    ): void;
    backward(): void;
    active(): { activity?: ScreenInstance['activity'] } | undefined;
  };
  Controller: {
    add(name: string, callbacks: Record<string, () => void>): void;
    toggle(name: string): void;
    collectionSet(root: JQuery): void;
    collectionFocus(target: HTMLElement | false, root: JQuery): void;
  };
  Player: {
    play(video: { url: string; title: string }): void;
    playlist(videos: { url: string; title: string }[]): void;
    listener: EventBus;
  };
  PlayerVideo: { listener: EventBus };
  Noty: { show(message: string): void };
  Manifest?: { app_version?: string };
}

export interface RemoteNavigator {
  move(direction: 'up' | 'down' | 'left' | 'right'): void;
}

export interface PluginHost {
  Lampa?: LampaApi;
  $?: JQueryStatic;
  Navigator?: RemoteNavigator;
  appready?: boolean;
  __lampaStream?: { status: 'waiting' | 'ready' | 'failed' };
}
