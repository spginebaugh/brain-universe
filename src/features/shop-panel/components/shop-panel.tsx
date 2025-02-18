'use client';

import React from 'react';
import { ShoppingCart, X, Sparkles, Wand2, Crown, Trophy } from 'lucide-react';
import { useShopStore } from '@/shared/stores/shop-store';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { ShopItem } from '@/shared/types/shop';
import { useState } from 'react';
import { Carousel, CarouselItem } from '@/shared/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

const CategoryIcons = {
  ultimate: Trophy,
  powerup: Sparkles,
  cosmetic: Crown,
  special: Wand2,
};

const CategoryOrder = ['ultimate', 'powerup', 'cosmetic', 'special'];

export const ShopPanel = () => {
  const { isOpen, items, availablePoints, addToCart, checkout, toggleShop } = useShopStore();
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  if (!isOpen) return null;

  const handlePurchase = (item: ShopItem) => {
    addToCart(item);
    checkout();
    setSelectedItem(null);
  };

  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ShopItem[]>);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 text-white z-50">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4 bg-gradient-to-r from-blue-900/80 to-blue-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-4xl font-black tracking-tight">ITEM SHOP</h1>
          <div className="flex items-center gap-2 bg-blue-500/20 rounded-lg px-4 py-2 border border-white/10">
            <ShoppingCart className="w-5 h-5" />
            <Badge variant="secondary" className="text-xl px-4 py-2 bg-blue-500/30 border-none">
              {availablePoints} Points
            </Badge>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleShop}
          className="hover:bg-blue-500/20 rounded-full h-12 w-12"
        >
          <X className="h-8 w-8" />
        </Button>
      </div>

      {/* Main Content */}
      <ScrollArea className="h-[calc(100vh-80px)] px-8 py-6">
        {CategoryOrder.map(category => {
          const categoryItems = itemsByCategory[category] || [];
          if (categoryItems.length === 0) return null;

          const isUltimate = category === 'ultimate';
          
          return (
            <div key={category} className={`mb-8 ${isUltimate ? 'bg-gradient-to-r from-yellow-500/10 to-purple-500/10 p-6 rounded-xl border border-yellow-500/20' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                {CategoryIcons[category as keyof typeof CategoryIcons] && (
                  <div className={`p-2 rounded-lg ${isUltimate ? 'bg-yellow-500/20' : 'bg-blue-500/20'}`}>
                    {React.createElement(CategoryIcons[category as keyof typeof CategoryIcons], { 
                      className: `w-6 h-6 ${isUltimate ? 'text-yellow-400' : ''}` 
                    })}
                  </div>
                )}
                <h2 className={`text-2xl font-bold capitalize ${isUltimate ? 'text-yellow-400' : ''}`}>
                  {isUltimate ? 'Ultimate Prizes' : category}
                </h2>
              </div>
              <Carousel
                opts={{
                  align: 'start',
                  slidesToScroll: 4,
                }}
                className="w-full"
              >
                {categoryItems.map((item) => (
                  <CarouselItem key={item.id} className="basis-1/4">
                    <Card 
                      className={`group relative overflow-hidden border-0 bg-gradient-to-b mr-0
                        ${isUltimate 
                          ? 'from-yellow-900/90 to-purple-900/90 hover:scale-105 border border-yellow-500/20' 
                          : 'from-gray-800/90 to-gray-900/90 hover:scale-105'} 
                        transition-all duration-200 cursor-pointer`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br 
                        ${isUltimate 
                          ? 'from-yellow-500/10 to-purple-500/10' 
                          : 'from-blue-500/10 to-purple-500/10'} 
                        opacity-0 group-hover:opacity-100 transition-opacity`} 
                      />
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="w-full aspect-square object-cover"
                        />
                      ) : (
                        <div className={`w-full aspect-square bg-gradient-to-br 
                          ${isUltimate 
                            ? 'from-yellow-500/30 to-purple-600/30' 
                            : 'from-blue-500/30 to-purple-600/30'} 
                          flex items-center justify-center`}
                        >
                          {React.createElement(CategoryIcons[item.category as keyof typeof CategoryIcons], { 
                            className: `w-20 h-20 opacity-50 ${isUltimate ? 'text-yellow-400' : ''}` 
                          })}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-black/0 p-4">
                        <h3 className={`font-bold text-xl mb-1 ${isUltimate ? 'text-yellow-400' : ''}`}>
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-300 mb-3">{item.description}</p>
                        <div className="flex justify-between items-center">
                          <Badge className={`text-lg py-1 px-3 border-none 
                            ${isUltimate ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20'}`}
                          >
                            {item.price} Points
                          </Badge>
                          <Button
                            variant="secondary"
                            disabled={item.price > availablePoints}
                            className={`border-none ${isUltimate 
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-black font-bold' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                          >
                            Purchase
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </CarouselItem>
                ))}
              </Carousel>
            </div>
          );
        })}
      </ScrollArea>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="sm:max-w-md border-none bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle className={`text-2xl ${selectedItem?.category === 'ultimate' ? 'text-yellow-400' : ''}`}>
              Confirm Purchase
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to purchase {selectedItem?.name} for {selectedItem?.price} points?
            </DialogDescription>
          </DialogHeader>
          <div className={`flex justify-between items-center p-4 rounded-lg border 
            ${selectedItem?.category === 'ultimate' 
              ? 'bg-yellow-900/50 border-yellow-500/20' 
              : 'bg-gray-800 border-gray-700'}`}
          >
            <div>
              <p className={`font-semibold text-lg ${selectedItem?.category === 'ultimate' ? 'text-yellow-400' : ''}`}>
                {selectedItem?.name}
              </p>
              <p className="text-sm text-gray-400">{selectedItem?.description}</p>
            </div>
            <Badge className={`text-lg ${selectedItem?.category === 'ultimate' ? 'bg-yellow-500 text-black' : 'bg-blue-500'}`}>
              {selectedItem?.price} Points
            </Badge>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setSelectedItem(null)}
              className="hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedItem && handlePurchase(selectedItem)}
              disabled={!selectedItem || selectedItem.price > availablePoints}
              className={selectedItem?.category === 'ultimate' 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-black font-bold' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'}
            >
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 