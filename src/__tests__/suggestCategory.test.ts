import { suggestCategory } from '@/src/features/expenses/suggestCategory';

test('suggests a category from merchant keywords', () => {
  expect(suggestCategory('Blue Bottle Coffee')).toBe('FOOD');
  expect(suggestCategory('Park Hyatt Tokyo')).toBe('LODGING');
  expect(suggestCategory('Uber Trip')).toBe('TRANSPORT');
  expect(suggestCategory('Airbnb Kyoto')).toBe('LODGING'); // not TRANSPORT via "air"
  expect(suggestCategory('Zzyzx Holdings')).toBeNull();
});
