export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: 'powerup' | 'cosmetic' | 'special' | 'ultimate';
}

export interface CartItem extends ShopItem {
  quantity: number;
}

export interface ShopState {
  isOpen: boolean;
  availablePoints: number;
  items: ShopItem[];
  cart: CartItem[];
} 