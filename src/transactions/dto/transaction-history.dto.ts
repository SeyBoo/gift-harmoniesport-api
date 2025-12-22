import { ApiProperty } from '@nestjs/swagger';

export class OrderProductDto {
  @ApiProperty()
  productId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: string;

  @ApiProperty()
  totalPrice: string;

  @ApiProperty()
  productType: string;
}

export class OrderDetailsDto {
  @ApiProperty()
  orderId: number;

  @ApiProperty({ type: [OrderProductDto] })
  products: OrderProductDto[];
}

export class TransactionHistoryItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  fees: number;

  @ApiProperty()
  netAmount: number;

  @ApiProperty()
  isPayout: boolean;

  @ApiProperty()
  payoutDate: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  orderId?: number;

  @ApiProperty({ nullable: true })
  associationName?: string;

  @ApiProperty({ type: OrderDetailsDto, nullable: true })
  orderDetails?: OrderDetailsDto;
} 