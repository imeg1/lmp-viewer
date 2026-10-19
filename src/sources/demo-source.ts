import type { VideoResult, VideoSource } from './types';

export const DEMO_CREDIT =
  'Big Buck Bunny © 2008 Blender Foundation · www.bigbuckbunny.org · CC BY 3.0 · демонстрационный фрагмент';

export class DemoSource implements VideoSource {
  readonly id = 'demo';
  readonly name = 'Демонстрационный источник';

  search(): Promise<VideoResult[]> {
    return Promise.resolve([
      {
        id: 'big-buck-bunny',
        title: 'Демонстрация — фрагмент Big Buck Bunny',
        streams: [
          {
            url: 'https://www.w3schools.com/html/mov_bbb.mp4',
            format: 'mp4',
          },
        ],
      },
    ]);
  }
}
