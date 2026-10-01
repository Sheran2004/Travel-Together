import { Category } from '../models/misc.js';
import { CATEGORIES } from '../models/Trip.js';
/** Inserts the default categories the first time the app starts. Admins manage them afterwards. */
export async function ensureCategories() {
  if ((await Category.estimatedDocumentCount()) === 0) await Category.insertMany(CATEGORIES.map((name) => ({ name })));
}
export const categoryActive = (name) => Category.exists({ name, active: true });
