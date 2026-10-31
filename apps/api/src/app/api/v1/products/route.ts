import { listProducts, postProduct } from '@/routes/products';

export const GET = listProducts.handle;
export const POST = postProduct.handle;
