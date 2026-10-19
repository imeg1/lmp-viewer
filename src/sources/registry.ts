import type { VideoSource } from './types';

export class SourceRegistry {
  private readonly sources: Record<string, VideoSource> = Object.create(null) as Record<
    string,
    VideoSource
  >;

  register(source: VideoSource): void {
    if (this.sources[source.id]) throw new Error(`Source already registered: ${source.id}`);
    this.sources[source.id] = source;
  }

  get(id: string): VideoSource {
    const source = this.sources[id];
    if (!source) throw new Error(`Unknown source: ${id}`);
    return source;
  }
}
