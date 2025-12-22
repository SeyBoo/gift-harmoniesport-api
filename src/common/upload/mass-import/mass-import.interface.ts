export interface PlayerCardData {
  index: number;
  id: string;
  firstName: string;
  lastName: string;
  playerNumber: string;
  playerFace?: string;
  season: string;
  variant: { id: string; name: string };
  imageFile?: File;
  imageUrl: string;
  imagePosition: { x: number; y: number };
  imageScale: number;
  imageRotation: number;
  cardDesign: number;
  textPosition: { x: number; y: number };
  firstNameSize: number;
  lastNameSize: number;
  textGap: number;
  aiCheck?: {
    status: 'pending' | 'checking' | 'passed' | 'warning' | 'failed';
    message?: string;
    score?: number;
  };
  status: 'pending' | 'ready' | 'completed' | 'error';
  reviewed: boolean;
}

export interface MassImportSessionStats {
  total: number;
  pending: number;
  ready: number;
  completed: number;
  error: number;
}

export interface BulkUpdateRequest {
  itemIds: string[];
  status: 'pending' | 'ready' | 'completed' | 'error';
}
