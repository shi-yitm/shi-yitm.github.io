const KEY = 'cs2-sensitivity-lab';
export const VERSION = 1;

export function createStore(storage = globalThis.localStorage) {
  const empty = () => ({ version: VERSION, records: [] });
  const read = () => {
    try {
      const data = JSON.parse(storage.getItem(KEY) ?? JSON.stringify(empty()));
      return data.version === VERSION && Array.isArray(data.records) ? data : empty();
    } catch {
      return empty();
    }
  };
  const write = (data) => storage.setItem(KEY, JSON.stringify(data));

  return {
    list: () => [...read().records],
    save(record) {
      if (!record || typeof record !== 'object') throw new Error('无效的历史数据');
      const data = read();
      write({ version: VERSION, records: [record, ...data.records].slice(0, 20) });
    },
    export: () => JSON.stringify(read(), null, 2),
    import(text) {
      const data = JSON.parse(text);
      if (data?.version !== VERSION) throw new Error('不支持的数据版本');
      if (!Array.isArray(data.records)) throw new Error('无效的历史数据');
      write({ version: VERSION, records: data.records.slice(0, 20) });
    },
  };
}
