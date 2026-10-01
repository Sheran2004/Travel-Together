import { useEffect, useState } from 'react';
import api from '../services/api';
import { CATEGORIES } from '../utils/format';
let cache = null;
/** Categories are managed by admins and stored in MongoDB; falls back to defaults if the API is unreachable. */
export function useCategories() {
  const [c, setC] = useState(cache || CATEGORIES);
  useEffect(() => { if (cache) return; api.get('/categories').then((r) => { if (r.data.categories.length) { cache = r.data.categories; setC(cache); } }).catch(() => {}); }, []);
  return c;
}
export const resetCategoriesCache = () => { cache = null; };
