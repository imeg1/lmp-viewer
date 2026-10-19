export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  year?: number;
  imdbId?: string;
  kinopoiskId?: string;
}

export interface VideoStream {
  url: string;
  quality?: string;
  format?: 'mp4' | 'hls' | 'dash';
}

export interface VideoResult {
  id: string;
  title: string;
  streams: VideoStream[];
}

export interface VideoSource {
  id: string;
  name: string;
  search(movie: Movie): Promise<VideoResult[]>;
}
