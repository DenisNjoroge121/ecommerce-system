import { create } from 'zustand';
import API from '../api';

const CATALOG_CACHE_KEY = 'belo-catalog-v1';
const PRODUCT_PAGE_SIZE = 32;

let catalogLoadPromise = null;
let categoryLoadPromise = null;

function readCatalogCache() {
  if (typeof window === 'undefined') return null;

  try {
    const cached = JSON.parse(window.localStorage.getItem(CATALOG_CACHE_KEY) || 'null');
    if (Array.isArray(cached?.products) && Array.isArray(cached?.categories)) return cached;
  } catch (error) {
    console.warn('Could not read the saved catalog cache:', error);
  }

  return null;
}

function saveCatalogCache(products, categories) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ products, categories }));
  } catch (error) {
    // The storefront still works when browser storage is unavailable or full.
    console.warn('Could not save the catalog cache:', error);
  }
}

const cachedCatalog = readCatalogCache();

export const useCatalogStore = create((set, get) => ({
  products: cachedCatalog?.products || [],
  categories: cachedCatalog?.categories || [],
  loading: !cachedCatalog?.products?.length,
  loadingMore: false,
  hasLoaded: false,

  loadCatalog: () => {
    if (!categoryLoadPromise) {
      categoryLoadPromise = API.get('categories/')
        .then((response) => {
          set({ categories: response.data });
          saveCatalogCache(get().products, response.data);
        })
        .catch((error) => console.error('Failed to load categories:', error))
        .finally(() => {
          categoryLoadPromise = null;
        });
    }

    const currentCategoryLoad = categoryLoadPromise;
    if (get().hasLoaded || catalogLoadPromise) {
      return Promise.all([currentCategoryLoad, catalogLoadPromise].filter(Boolean));
    }

    set({ loading: get().products.length === 0, loadingMore: false });

    catalogLoadPromise = (async () => {
      const firstResponse = await API.get('products/', {
        params: { page: 1, page_size: PRODUCT_PAGE_SIZE },
      });
      const firstPayload = firstResponse.data;
      const firstBatch = Array.isArray(firstPayload) ? firstPayload : (firstPayload.results || []);
      const pageCount = Array.isArray(firstPayload)
        ? 1
        : Math.ceil((firstPayload.count || firstBatch.length) / PRODUCT_PAGE_SIZE);

      // With no saved catalog, show the first batch while the rest load.
      if (!get().products.length && pageCount > 1) {
        set({ products: firstBatch, loading: false, loadingMore: true });
      }

      const laterPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2).map((page) =>
          API.get('products/', { params: { page, page_size: PRODUCT_PAGE_SIZE } })
        )
      );
      const laterBatches = laterPages.map((response) =>
        Array.isArray(response.data) ? response.data : (response.data.results || [])
      );
      const freshProducts = [firstBatch, ...laterBatches].flat();

      set({
        products: freshProducts,
        hasLoaded: true,
        loading: false,
        loadingMore: false,
      });
      saveCatalogCache(freshProducts, get().categories);
    })()
      .catch((error) => {
        console.error('Failed to load products:', error);
      })
      .finally(() => {
        set({ loading: false, loadingMore: false });
        catalogLoadPromise = null;
      });

    return catalogLoadPromise;
  },

  invalidateCatalog: () => {
    set({ hasLoaded: false });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CATALOG_CACHE_KEY);
      } catch (error) {
        console.warn('Could not clear the saved catalog cache:', error);
      }
    }
  },
}));
