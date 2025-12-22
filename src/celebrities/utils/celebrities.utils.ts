import { Injectable } from '@nestjs/common';
import { CelebrityData, CelebrityMin } from '../celebrities.interface';
import { Celebrity } from '../entities/celebrity.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
@Injectable()
export class CelebritiesUtils {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async formatCelebrities(celebrities: Celebrity[]): Promise<CelebrityData[]> {
    const formattedCelebrities = [];
    for (const celebrity of celebrities) {
      formattedCelebrities.push(await this.formatCelebrity(celebrity));
    }
    return formattedCelebrities;
  }

  async formatCelebrityMin(
    celebrity: Celebrity,
    language: string,
  ): Promise<CelebrityMin> {
    if (celebrity.isDeleted || !celebrity.isConfirmed) {
      return null;
    }

    return {
      id: celebrity.id,
      name: celebrity.name,
      associations: celebrity.associations,
      jobTitle: celebrity.jobTitle[language],
      imageUrl: celebrity.imageUrl,
    };
  }

  async formatCelebritiesMin(
    celebrities: Celebrity[],
    language: string,
  ): Promise<CelebrityMin[]> {
    const formattedCelebrities = [];
    for (const celebrity of celebrities) {
      const formattedCelebrity = await this.formatCelebrityMin(celebrity, language);
      if (formattedCelebrity) {
        formattedCelebrities.push(formattedCelebrity);
      }
    }
    return formattedCelebrities;
  }

  async formatCelebrity(celebrity: Celebrity): Promise<CelebrityData> {
    const associations = await this.userRepository.find({
      where: { id: In(celebrity.associations) },
    });

    const products = await this.productRepository.find({
      where: { celebrity: { id: celebrity.id } },
    });

    return {
      ...celebrity,
      associationNames: associations.map(
        (association) => association.name_association,
      ),
      cards: products.map((product) => ({
        id: product.id,
        title: product.name,
        image: product.image,
        slug: product.slug,
      })),
    };
  }
}
