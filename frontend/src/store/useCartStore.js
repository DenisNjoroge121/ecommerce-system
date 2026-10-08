import {create} from 'zustand';
import {persist} from 'zustand/middleware';

export const useCartStore = create(
    persist(
        (set,get) => ({
            cart: [],
            addToCart: (product) => {
                const currentCart = get().cart;
                const existing = currentCart.findIndex(item => item.id === product.id);
                if (existing ) {
                    set({
                        cart: currentCart.map((i) => i.id === product.id ? {...i, quantity: i.quantity + 1} : i),
                    });
                } else {
                    set({cart: [...currentCart, {...product, quantity: 1}]});
                }
            },
            removeFromCart: (id) => set({
                cart: get().cart.filter((i) => i.id !==id)
            }),
            clearCart: () => set({cart: []}),
            getTotal: () => get().cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
        }),
        {name: 'shopping-cart'}
    )
);
