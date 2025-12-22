import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sponsor } from './entity/sponsors.entity';
import { SuccessResponse } from '../common/interfaces';
import { User } from '../users/entities/user.entity';
import { UploadService } from '../common/upload/upload.service';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepository: Repository<Sponsor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly uploadService: UploadService,
  ) {}

  async createSponsor(
    sponsor: Sponsor,
    userId: number,
    logo: Express.Multer.File,
  ): Promise<SuccessResponse<Sponsor>> {
    // First find the user
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['sponsors'], // Make sure to load the sponsors relation
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create and save the sponsor with user reference
    const createdSponsor = await this.sponsorRepository.save({
      ...sponsor,
      user: user, // Set the user relationship
    });

    // Upload the logo
    const logoUrl = await this.uploadService.uploadFile(logo.buffer, {
      ContentType: logo.mimetype,
      Key: `uploads/sponsors-logo/${user.id}-${createdSponsor.id}.png`,
    });

    // Update the logo URL
    await this.sponsorRepository.update(createdSponsor.id, {
      logo: logoUrl,
    });

    return {
      success: true,
      message: `Sponsor ${createdSponsor.id} created successfully`,
      data: { ...createdSponsor, user: null },
    };
  }

  async updateSponsor(
    id: number,
    sponsor: Sponsor,
    logo: Express.Multer.File | undefined,
    userId: number,
  ): Promise<SuccessResponse<Sponsor>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['sponsors'],
    });

    const updatedSponsor = await this.sponsorRepository.findOne({
      where: { id },
    });

    if (logo) {
      const newUrl = await this.uploadService.uploadFile(logo.buffer, {
        ContentType: logo.mimetype,
        Key: `uploads/sponsors-logo/${user.id}-${updatedSponsor.id}-${Date.now()}.png`,
      });

      await this.sponsorRepository.update(id, {
        logo: newUrl,
      });
    }

    await this.sponsorRepository.update(id, {
      ...sponsor,
    });

    return {
      success: true,
      message: `Sponsor ${id} updated successfully`,
      data: { ...updatedSponsor },
    };
  }

  async getSponsors(userId: number): Promise<SuccessResponse<Sponsor[]>> {
    const sponsors = await this.sponsorRepository.find({
      where: { user: { id: userId } },
    });

    return {
      success: true,
      message: 'Sponsors fetched successfully',
      data: sponsors,
    };
  }

  async deleteSponsor(
    id: number,
    userId: number,
  ): Promise<SuccessResponse<void>> {
    await this.sponsorRepository.delete(id);

    await this.uploadService.deleteFile(
      `uploads/sponsors-logo/${userId}-${id}.png`,
    );

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['sponsors'],
    });

    user.sponsors = user.sponsors.filter((sponsor) => sponsor.id !== id);
    await this.userRepository.save(user);

    return {
      success: true,
      message: `Sponsor ${id} deleted successfully`,
    };
  }
}
