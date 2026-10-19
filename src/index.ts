import { bootstrap } from './core/bootstrap';
import type { PluginHost } from './lampa/types';

bootstrap(window as unknown as PluginHost);
