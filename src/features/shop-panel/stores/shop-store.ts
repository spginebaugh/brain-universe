import { create } from 'zustand';
import { ShopState, ShopItem } from '@/shared/types/shop';

const initialItems: ShopItem[] = [
  // Ultimate Prizes
  {
    id: 'ultimate-1',
    name: 'Game with Clix',
    description: 'Play a game with professional Fortnite player Clix',
    price: 10000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-2',
    name: 'A Sunday off at Gauntlet',
    description: 'Take a well-deserved break from the Gauntlet challenges',
    price: 15000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-3',
    name: '$10,000 USD',
    description: 'Cash prize redeemable in US Dollars',
    price: 50000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-4',
    name: 'Pickleball with DR',
    description: 'Play a game of pickleball with DR',
    price: 20000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-5',
    name: 'Additional Relish Order',
    description: 'Get an extra order of relish with your next meal',
    price: 5000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-6',
    name: 'Bird Pass',
    description: 'Exclusive access to Bird scooter rides',
    price: 8000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-7',
    name: 'OpenAI Deep Research Membership',
    description: 'Access to OpenAI\'s advanced research and development resources',
    price: 25000,
    category: 'ultimate',
  },
  {
    id: 'ultimate-8',
    name: '15 Minutes of Social time on 5th floor',
    description: 'Enjoy a brief social break on the exclusive 5th floor',
    price: 12000,
    category: 'ultimate',
  },
  // Powerups
  {
    id: '1',
    name: 'Double Points',
    description: 'Double all points earned for 1 hour',
    price: 100,
    category: 'powerup',
  },
  {
    id: '3',
    name: 'Progress Boost',
    description: 'Boost progress gain by 50% for 30 minutes',
    price: 150,
    category: 'powerup',
  },
  // Cosmetics
  {
    id: '2',
    name: 'Golden Border',
    description: 'Add a golden border to your profile',
    price: 200,
    category: 'cosmetic',
  },
  {
    id: 'cosmetic-1',
    name: 'Animated Avatar',
    description: 'Make your profile picture come alive with subtle animations',
    price: 300,
    category: 'cosmetic',
  },
  {
    id: 'cosmetic-2',
    name: 'Neon Theme',
    description: 'Transform your interface with vibrant neon colors',
    price: 250,
    category: 'cosmetic',
  },
  {
    id: 'cosmetic-3',
    name: 'Custom Emojis',
    description: 'Unlock a set of exclusive animated emojis for chat',
    price: 180,
    category: 'cosmetic',
  },
  {
    id: 'cosmetic-4',
    name: 'Achievement Badges',
    description: 'Display your top achievements with animated badges',
    price: 400,
    category: 'cosmetic',
  },
  {
    id: 'cosmetic-5',
    name: 'Particle Effects',
    description: 'Add sparkle effects to your interactions and clicks',
    price: 350,
    category: 'cosmetic',
  },
];

interface ShopStore extends ShopState {
  toggleShop: () => void;
  addToCart: (item: ShopItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  checkout: () => void;
}

export const useShopStore = create<ShopStore>((set) => ({
  isOpen: false,
  availablePoints: 1000, // Initial points
  items: initialItems,
  cart: [],

  toggleShop: () => set((state) => ({ isOpen: !state.isOpen })),

  addToCart: (item) =>
    set((state) => {
      const existingItem = state.cart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return {
          cart: state.cart.map((cartItem) =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          ),
        };
      }
      return { cart: [...state.cart, { ...item, quantity: 1 }] };
    }),

  removeFromCart: (itemId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== itemId),
    })),

  updateQuantity: (itemId, quantity) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      ),
    })),

  checkout: () =>
    set((state) => {
      const totalCost = state.cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      if (totalCost > state.availablePoints) {
        return state;
      }
      return {
        availablePoints: state.availablePoints - totalCost,
        cart: [],
      };
    }),
})); 