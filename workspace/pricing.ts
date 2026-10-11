const FREE_SHIPPING_THRESHOLD = 58;
const SHIPPING_FEE = 10;

export function calculateTotal(subtotal: number): number {
    if(!Number.isFinite(subtotal) || subtotal < 0) {
        throw new Error("subtotal 必须是正数");
    }
    return subtotal >= FREE_SHIPPING_THRESHOLD ? subtotal : subtotal + SHIPPING_FEE;
}