export interface Bundle {
  'bundle-premium': number;
  'bundle-plus': number;
  'bundle-basic': number;
  'bundle-digital': number;
}

export type BundleItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  productType: 'magnet' | 'digital' | 'collector';
};

export type BundleItemWithPrice = BundleItem & {
  price: number;
};
