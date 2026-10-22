import type { Category, MenuItem, Order, OrderLine } from '@/types/domain'

export const MOCK_ADMIN = { email: 'admin@tablefront.test', password: 'admin123' }
export const MOCK_ADMIN_TOKEN = 'mock-admin-token'

// Images are inline SVGs so the demo needs no binary assets and no network.
function dishImage(emoji: string, hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">` +
    `<rect width="400" height="300" fill="hsl(${String(hue)} 70% 88%)"/>` +
    `<text x="200" y="170" font-size="110" text-anchor="middle">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Deliberately not sorted: the API is responsible for sorting by `sortOrder`.
export const categories: Category[] = [
  { id: 'cat-mains', name: 'Mains', sortOrder: 2 },
  { id: 'cat-drinks', name: 'Drinks', sortOrder: 4 },
  { id: 'cat-starters', name: 'Starters', sortOrder: 1 },
  { id: 'cat-desserts', name: 'Desserts', sortOrder: 3 },
]

export const menuItems: MenuItem[] = [
  {
    id: 'item-1',
    name: 'Bruschetta',
    description: 'Grilled sourdough, tomatoes, basil and olive oil.',
    priceCents: 650,
    categoryId: 'cat-starters',
    imageUrl: dishImage('🍞', 30),
    available: true,
    allergens: ['gluten'],
  },
  {
    id: 'item-2',
    name: 'Burrata & tomatoes',
    description: 'Creamy burrata with heirloom tomatoes and basil oil.',
    priceCents: 950,
    categoryId: 'cat-starters',
    imageUrl: dishImage('🧀', 30),
    available: true,
    allergens: ['dairy'],
  },
  {
    id: 'item-3',
    name: 'Kartoffelsuppe',
    description: 'Creamy Bavarian potato soup with smoked sausage and marjoram.',
    priceCents: 750,
    categoryId: 'cat-starters',
    imageUrl: dishImage('🥣', 30),
    available: true,
    allergens: ['dairy'],
  },
  {
    id: 'item-4',
    name: 'Brezel mit Obatzda',
    description: 'Soft Bavarian pretzel with obatzda, a spiced camembert spread.',
    priceCents: 800,
    categoryId: 'cat-starters',
    imageUrl: dishImage('🥨', 30),
    available: true,
    allergens: ['gluten', 'dairy'],
  },
  {
    id: 'item-5',
    name: 'Margherita pizza',
    description: 'Tomato, fior di latte and basil on a wood-fired base.',
    priceCents: 1100,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🍕', 10),
    available: true,
    allergens: ['gluten', 'dairy'],
  },
  {
    id: 'item-6',
    name: 'Diavola pizza',
    description: 'Spicy salami, mozzarella, tomato and chili oil.',
    priceCents: 1300,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🍕', 10),
    available: true,
    allergens: ['gluten', 'dairy'],
  },
  {
    id: 'item-7',
    name: 'Spaghetti carbonara',
    description: 'Guanciale, egg yolk, pecorino and black pepper.',
    priceCents: 1400,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🍝', 10),
    available: true,
    allergens: ['gluten', 'eggs', 'dairy'],
  },
  {
    id: 'item-8',
    name: 'Lasagna',
    description: 'Slow-cooked beef ragù, béchamel and parmesan.',
    priceCents: 1500,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🍝', 10),
    available: false,
    allergens: ['gluten', 'dairy', 'eggs'],
  },
  {
    id: 'item-9',
    name: 'Beef burger',
    description: 'Dry-aged beef, cheddar, pickles and house sauce in a brioche bun.',
    priceCents: 1450,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🍔', 10),
    available: true,
    allergens: ['gluten', 'dairy', 'eggs', 'sesame'],
  },
  {
    id: 'item-10',
    name: 'Wiener Schnitzel',
    description: 'Breaded veal cutlet with warm potato salad and a lemon wedge.',
    priceCents: 1750,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🥩', 10),
    available: true,
    allergens: ['gluten', 'eggs'],
  },
  {
    id: 'item-11',
    name: 'Käsespätzle',
    description: 'Swabian egg noodles baked with mountain cheese and crispy onions.',
    priceCents: 1350,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🧀', 10),
    available: true,
    allergens: ['gluten', 'eggs', 'dairy'],
  },
  {
    id: 'item-12',
    name: 'Tiramisu',
    description: 'Mascarpone cream, espresso-soaked savoiardi and cocoa.',
    priceCents: 700,
    categoryId: 'cat-desserts',
    imageUrl: dishImage('🍰', 330),
    available: true,
    allergens: ['gluten', 'dairy', 'eggs'],
  },
  {
    id: 'item-13',
    name: 'Schwarzwälder Kirschtorte',
    description: 'Black Forest cake with kirsch cherries, cream and chocolate shavings.',
    priceCents: 750,
    categoryId: 'cat-desserts',
    imageUrl: dishImage('🍒', 330),
    available: true,
    allergens: ['gluten', 'dairy', 'eggs'],
  },
  {
    id: 'item-14',
    name: 'Chocolate fondant',
    description: 'Warm chocolate cake with a molten centre and hazelnut crumb.',
    priceCents: 800,
    categoryId: 'cat-desserts',
    imageUrl: dishImage('🍫', 330),
    available: false,
    allergens: ['gluten', 'dairy', 'eggs', 'nuts'],
  },
  {
    id: 'item-15',
    name: 'Apfelstrudel',
    description: 'Warm apple strudel with raisins, cinnamon and vanilla sauce.',
    priceCents: 650,
    categoryId: 'cat-desserts',
    imageUrl: dishImage('🍎', 330),
    available: true,
    allergens: ['gluten', 'dairy'],
  },
  {
    id: 'item-16',
    name: 'Sparkling water',
    description: 'Chilled sparkling mineral water, 0.75 l.',
    priceCents: 300,
    categoryId: 'cat-drinks',
    imageUrl: null,
    available: true,
    allergens: [],
  },
  {
    id: 'item-17',
    name: 'Lemonade',
    description: 'Fresh-pressed lemons, mint and a little honey.',
    priceCents: 450,
    categoryId: 'cat-drinks',
    imageUrl: dishImage('🍋', 200),
    available: true,
    allergens: [],
  },
  {
    id: 'item-18',
    name: 'Espresso',
    description: 'Double shot of our house blend.',
    priceCents: 280,
    categoryId: 'cat-drinks',
    imageUrl: null,
    available: true,
    allergens: [],
  },
  {
    id: 'item-19',
    name: 'Weissbier',
    description: 'Bavarian wheat beer, 0.5 l.',
    priceCents: 450,
    categoryId: 'cat-drinks',
    imageUrl: dishImage('🍺', 200),
    available: true,
    allergens: ['gluten'],
  },
  {
    id: 'item-20',
    name: 'Currywurst mit Pommes',
    description: 'Grilled pork sausage with curry-ketchup sauce and crispy fries.',
    priceCents: 1100,
    categoryId: 'cat-mains',
    imageUrl: dishImage('🌭', 10),
    available: true,
    allergens: ['gluten'],
  },
]

/** The next ids the in-memory store hands out; they continue after the seed data. */
export const NEXT_MENU_ITEM_NUMBER = menuItems.length + 1
export const NEXT_ORDER_NUMBER = 1008

function line(menuItemId: string, quantity: number, note?: string): OrderLine {
  const item = menuItems.find((candidate) => candidate.id === menuItemId)
  if (item === undefined) throw new Error(`Fixture refers to unknown menu item ${menuItemId}`)
  return {
    menuItemId,
    name: item.name,
    unitPriceCents: item.priceCents,
    quantity,
    ...(note === undefined ? {} : { note }),
  }
}

function order(
  number: number,
  minutesAgo: number,
  now: Date,
  rest: Pick<Order, 'status' | 'fulfillment' | 'customer'>,
  lines: OrderLine[],
): Order {
  return {
    id: `ord-${String(number)}`,
    lines,
    totalCents: lines.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
    createdAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
    ...rest,
  }
}

/** Timestamps are relative to `now` so the seeded orders always look recent. */
export function createSeedOrders(now: Date): Order[] {
  return [
    order(
      1001,
      240,
      now,
      {
        status: 'completed',
        fulfillment: 'pickup',
        customer: { name: 'Anna Keller', phone: '+49 30 1234567' },
      },
      [line('item-5', 2), line('item-17', 2)],
    ),
    order(
      1002,
      150,
      now,
      {
        status: 'cancelled',
        fulfillment: 'delivery',
        customer: {
          name: 'Tom Becker',
          phone: '+49 151 2345678',
          address: 'Lindenstr. 14, 10969 Berlin',
        },
      },
      [line('item-9', 1), line('item-16', 1)],
    ),
    order(
      1003,
      35,
      now,
      {
        status: 'ready',
        fulfillment: 'pickup',
        customer: { name: 'Mia Schulz', phone: '+49 160 3456789' },
      },
      [line('item-7', 1, 'Extra pepper, please'), line('item-12', 1)],
    ),
    order(
      1004,
      22,
      now,
      {
        status: 'preparing',
        fulfillment: 'delivery',
        customer: {
          name: 'Jonas Weber',
          phone: '+49 170 4567890',
          address: 'Oranienstr. 99, 10969 Berlin',
        },
      },
      [line('item-6', 2), line('item-2', 1), line('item-19', 2)],
    ),
    order(
      1005,
      14,
      now,
      {
        status: 'preparing',
        fulfillment: 'pickup',
        customer: { name: 'Lena Fischer', phone: '+49 171 5678901' },
      },
      [line('item-11', 1), line('item-17', 1)],
    ),
    order(
      1006,
      6,
      now,
      {
        status: 'new',
        fulfillment: 'delivery',
        customer: {
          name: 'Paul Wagner',
          phone: '+49 172 6789012',
          address: 'Kastanienallee 7, 10435 Berlin',
        },
      },
      [line('item-10', 1, 'No lemon, please'), line('item-1', 1)],
    ),
    order(
      1007,
      2,
      now,
      {
        status: 'new',
        fulfillment: 'pickup',
        customer: { name: 'Sara Hoffmann', phone: '+49 173 7890123' },
      },
      [line('item-5', 1), line('item-15', 2), line('item-18', 2)],
    ),
  ]
}
