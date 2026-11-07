import { SyncHistoryComponent } from './sync-history.component';
const rows = [
  {
    id: 'a',
    branch: 'release',
    locale: 'he',
    remoteSha: 'AABBCC',
    fingerprint: 'literal[.*]',
  },
  {
    id: 'b',
    branch: 'main',
    locale: 'en',
    remoteSha: 'DDEEFF',
    fingerprint: 'second',
  },
];
const make = (api: any = {}) => new SyncHistoryComponent({} as any, api);
describe('loaded diagnostic history search', () => {
  it('literal trimmed case-insensitive search covers only named fields without changing full set', () => {
    const c = make();
    c.records.set(rows as any);
    for (const query of [' RELEASE ', 'HE', 'aabb', '[.*]']) {
      c.query.set(query);
      expect(c.filteredRecords()).toEqual([rows[0]]);
      expect(c.filteredRecords()[0]).toBe(rows[0]);
    }
    expect(c.records()).toEqual(rows);
    c.query.set('missing');
    expect(c.filteredRecords()).toEqual([]);
    c.query.set('');
    expect(c.filteredRecords()).toBe(c.records());
  });
  it('same-project reread retains search and new project resets it', async () => {
    const api = {
        listSyncPreviewRecords: jest.fn().mockResolvedValue({ records: rows }),
      },
      c = make(api);
    await c.load('p');
    c.query.set('release');
    await c.load('p');
    expect(c.query()).toBe('release');
    expect(c.filteredRecords()).toEqual([rows[0]]);
    await c.load('other');
    expect(c.query()).toBe('');
    expect(c.filteredRecords()).toEqual(rows);
  });
  it('filtering makes no reads and cannot conceal error or alter pending state', () => {
    const api = { listSyncPreviewRecords: jest.fn() },
      c = make(api);
    c.records.set(rows as any);
    c.error.set('Unavailable');
    c.query.set('none');
    expect(c.filteredRecords()).toEqual([]);
    expect(c.error()).toBe('Unavailable');
    expect(c.loading()).toBe(true);
    expect(api.listSyncPreviewRecords).not.toHaveBeenCalled();
  });
});
