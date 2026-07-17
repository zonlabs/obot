import { tool } from 'ai';
import { z } from 'zod';

const descriptions = [
  'High-quality product with excellent features and durability.',
  'Popular choice among customers, great value for money.',
  'Premium build quality with modern design and reliable performance.',
  'Affordable option with solid performance and good reviews.',
];

export const getProductDetails = tool({
  description: 'Get details about a product',
  inputSchema: z.object({
    name: z.string().describe('The product name'),
    store: z.string().optional().describe('The store name'),
  }),
  execute: async ({ name, store }) => {
    const price = (Math.random() * 200 + 10).toFixed(2);
    const rating = (Math.random() * 2 + 3).toFixed(1);
    const description = descriptions[Math.floor(Math.random() * descriptions.length)];
    return { name, store: store || 'Unknown', price: `$${price}`, rating: `${rating}/5`, description };
  },
});

export const compareProducts = tool({
  description: 'Compare multiple products across attributes',
  inputSchema: z.object({
    products: z.array(z.string()).describe('Array of product names to compare'),
  }),
  execute: async ({ products }) => {
    const comparisons = [
      'Based on our analysis, the first product offers better value for money, while the second has superior features.',
      'Both products are well-rated, but the second one has better battery life and warranty options.',
      'The products differ mainly in price range and target audience. The more expensive option has premium materials.',
      'After comparing specifications, we recommend the first product for budget-conscious buyers and the second for those seeking premium features.',
    ];
    return { comparison: comparisons[Math.floor(Math.random() * comparisons.length)], products };
  },
});

export const findDeals = tool({
  description: 'Find deals and discounts for products in a category',
  inputSchema: z.object({
    category: z.string().optional().describe('The product category'),
    maxPrice: z.number().optional().describe('Maximum price filter'),
  }),
  execute: async ({ category, maxPrice }) => {
    const dealTypes = ['20% off', 'Buy one get one free', '$15 off', 'Free shipping', 'Bundle deal'];
    const stores = ['Amazon', 'Walmart', 'Best Buy', 'Target', 'eBay'];
    const deal = dealTypes[Math.floor(Math.random() * dealTypes.length)];
    const store = stores[Math.floor(Math.random() * stores.length)];
    const details = `${deal} available at ${store}${category ? ` for ${category}` : ''}${maxPrice ? ` up to $${maxPrice}` : ''}.`;
    return { deal, store, category: category || 'general', maxPrice: maxPrice || 'No limit', details };
  },
});

export const shoppingTools = {
  getProductDetails,
  compareProducts,
  findDeals,
};
