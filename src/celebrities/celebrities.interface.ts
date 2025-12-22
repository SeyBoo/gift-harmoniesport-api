import { Celebrity } from './entities/celebrity.entity';

export interface CelebrityData extends Celebrity {
  associationNames: string[];
  cards: {
    id: number;
    title: string;
    image: string;
    slug: string;
  }[];
}

export interface CelebrityMin {
  id: number;
  name: string;
  jobTitle: string;
  imageUrl: string;
  associations: number[];
}