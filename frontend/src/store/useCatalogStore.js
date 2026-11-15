import { create } from 'zustand';
import API from '../api';

let catalogLoadPromise = null;

export const useCatalogStore = create((set, get) => ({
  products: [],
  categories: [],
  loading: true,
  loadingMore: false,
  hasLoaded: false,

  loadCatalog: () => {
    if (get().hasLoaded || catalogLoadPromise) return catalogLoadPromise || Promise.resolve();

    set({ loading: true });
    API.get('categories/')
      .then((response) => set({ categories: response.data }))
      .catch((error) => console.error('Failed to load categories:', error));

    catalogLoadPromise = (async () => {
      let page = 1;
      try {
        let hasMore = true;
        while (hasMore) {
          const response = await API.get('products/', { params: { page, page_size: 8 } });
          const payload = response.data;
          const batch = Array.isArray(payload) ? payload : (payload.results || []);

          set((state) => ({
            products: page === 1 ? batch : [...state.products, ...batch],
            hasLoaded: true,
            loading: false,
          }));

          hasMore = Array.isArray(payload) ? false : Boolean(payload.next);
          set({ loadingMore: hasMore });
          page += 1;
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        set({ loading: false, loadingMore: false });
        catalogLoadPromise = null;
      }
    })();

    return catalogLoadPromise;
  },
}));
