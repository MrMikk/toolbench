import { createStore, get, set, del, keys } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';
import type { AppStorage } from './types';

// One IndexedDB database per app slug keeps namespaces fully isolated.
const stores = new Map<string, UseStore>();

function storeFor(slug: string): UseStore {
  let store = stores.get(slug);
  if (!store) {
    store = createStore(`toolbench:${slug}`, 'kv');
    stores.set(slug, store);
  }
  return store;
}

export function createAppStorage(slug: string): AppStorage {
  const store = storeFor(slug);
  return {
    get<T>(key: string) {
      return get<T>(key, store);
    },
    set<T>(key: string, value: T) {
      return set(key, value, store);
    },
    delete(key: string) {
      return del(key, store);
    },
    async keys() {
      return (await keys(store)).map(String);
    },
  };
}
