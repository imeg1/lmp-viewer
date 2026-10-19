import { describe, expect, it } from 'vitest';
import { DemoSource } from '../src/sources/demo-source';
import { SourceRegistry } from '../src/sources/registry';

describe('sources', () => {
  it('registers and retrieves the source, rejecting duplicate and unknown IDs', () => {
    const registry = new SourceRegistry();
    const source = new DemoSource();
    registry.register(source);
    expect(registry.get('demo')).toBe(source);
    expect(() => registry.register(source)).toThrow('already registered');
    expect(() => registry.get('missing')).toThrow('Unknown source');
  });

  it('returns exactly one explicitly labeled HTTPS demo video', async () => {
    const source = new DemoSource();
    const results = await source.search();
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toContain('Демонстрация');
    expect(results[0]?.streams).toHaveLength(1);
    expect(results[0]?.streams[0]).toMatchObject({
      format: 'mp4',
      url: expect.stringMatching(/^https:/),
    });
    results[0]!.streams.length = 0;
    expect((await source.search())[0]?.streams).toHaveLength(1);
  });
});
