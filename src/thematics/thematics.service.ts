import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Thematic } from './entities/thematic.entity';
import { SubThematic } from './entities/sub_thematic.entity';

@Injectable()
export class ThematicsService {
  constructor(
    @InjectRepository(Thematic)
    private readonly thematicRepository: Repository<Thematic>,
    @InjectRepository(SubThematic)
    private readonly subThematicRepository: Repository<SubThematic>,
  ) {}
  async findAll() {
    const thematics = await this.thematicRepository
      .createQueryBuilder('thematic')
      .leftJoin('thematic.users', 'user')
      .leftJoin('user.campaigns', 'campaign')
      .leftJoin('campaign.products', 'product')
      .select([
        'thematic.id',
        'thematic.name',
        'thematic.label',
        'thematic.multilingualName',
      ])
      .addSelect('COUNT(DISTINCT product.id)', 'cardCount')
      .groupBy('thematic.id')
      .getRawMany();

    return thematics.map((t) => ({
      id: t.thematic_id,
      name: t.thematic_name,
      label: t.thematic_label,
      multilingualName: t.thematic_multilingual_name,
      cardCount: parseInt(t.cardCount),
    }));
  }

  async findAllSubThematicsByThematicId(thematicId: number) {
    return await this.subThematicRepository.find({
      where: { thematic: { id: thematicId } },
    });
  }
}
