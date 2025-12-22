export class CreateCardBulkDto {
  associationId: number;
  variant: string;
  'bundle-premium': number;
  'bundle-plus': number;
  'bundle-basic': number;
  'bundle-digital': number;
  playerFirstname: string;
  playerLastname: string;
  playerNumber: string;
  playerFaceUrl: string;
  seasonLabel: string;
  uploadSessionId: string;
}
