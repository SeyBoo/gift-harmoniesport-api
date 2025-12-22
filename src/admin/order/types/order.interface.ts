import { OrderItem } from '../../../payment/entities/order.entity';

export interface AdminOrderProduct {
  id: number;
  name: string;
}

export interface AdminOrder {
  paymentIntentId: string;
  customerName: string;
  delivery_address: string;
  delivery_address_information: string;
  delivery_city: string;
  delivery_country: string;
  delivery_postalcode: string;
  delivery_status: string;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  products: AdminOrderProduct[];
  total: string;
  id: number;
}
