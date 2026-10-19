import type { VideoResult, VideoSource } from './types';

export const DEMO_CREDIT =
  'Big Buck Bunny © 2008 Blender Foundation · www.bigbuckbunny.org · CC BY 3.0';

export class DemoSource implements VideoSource {
  readonly id = 'demo';
  readonly name = 'Демонстрационный источник';

  search(): Promise<VideoResult[]> {
    return Promise.resolve([
      {
        id: 'big-buck-bunny',
        title: 'Демонстрация — Big Buck Bunny',
        streams: [
          {
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            format: 'mp4',
          },
        ],
      },
    ]);
  }
}
