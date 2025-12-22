import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MassImportSession, MassImportStatus } from './entities/mass-import-session.entity';
import { MassImportItem, MassImportItemStatus } from './entities/mass-import-item.entity';
import { CreateMassImportSessionDto, PlayerCardItemDto } from './dto/create-mass-import-session.dto';
import { UpdateMassImportSessionDto } from './dto/update-mass-import-session.dto';

@Injectable()
export class MassImportService {
  constructor(
    @InjectRepository(MassImportSession)
    private readonly massImportSessionRepository: Repository<MassImportSession>,
    @InjectRepository(MassImportItem)
    private readonly massImportItemRepository: Repository<MassImportItem>,
  ) {}

  async createMassImportSession(
    userId: number,
    createMassImportSessionDto: CreateMassImportSessionDto,
  ): Promise<MassImportSession> {
    const { items, sessionName, description } = createMassImportSessionDto;

    const session = this.massImportSessionRepository.create({
      userId,
      sessionName: sessionName || `Mass Import ${new Date().toISOString()}`,
      description,
      totalItems: items.length,
      processedItems: 0,
      progressPercentage: 0,
      status: MassImportStatus.PENDING,
    });

    const savedSession = await this.massImportSessionRepository.save(session);

    const massImportItems = items.map((item: PlayerCardItemDto) =>
      this.massImportItemRepository.create({
        massImportSessionId: savedSession.id,
        index: item.index,
        firstName: item.firstName,
        lastName: item.lastName,
        playerNumber: item.playerNumber,
        playerFace: item.playerFace,
        season: item.season,
        variant: item.variant,
        imageUrl: item.imageUrl,
        imagePosition: item.imagePosition,
        imageScale: item.imageScale,
        imageRotation: item.imageRotation,
        cardDesign: item.cardDesign,
        textPosition: item.textPosition,
        firstNameSize: item.firstNameSize,
        lastNameSize: item.lastNameSize,
        textGap: item.textGap,
        aiCheck: item.aiCheck as any,
        status: item.status as MassImportItemStatus,
        reviewed: item.reviewed,
      }),
    );

    await this.massImportItemRepository.save(massImportItems);

    return this.findById(savedSession.id);
  }

  async findAll(userId: number): Promise<MassImportSession[]> {
    return this.massImportSessionRepository.find({
      where: { userId },
      relations: ['massImportItems'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<MassImportSession> {
    const session = await this.massImportSessionRepository.findOne({
      where: { id },
      relations: ['massImportItems'],
    });

    if (!session) {
      throw new NotFoundException(`Mass import session with ID ${id} not found`);
    }

    return session;
  }

  async updateMassImportSession(
    id: string,
    updateMassImportSessionDto: UpdateMassImportSessionDto,
  ): Promise<MassImportSession> {
    const session = await this.findById(id);
    
    Object.assign(session, updateMassImportSessionDto);
    
    return this.massImportSessionRepository.save(session);
  }

  async deleteMassImportSession(id: string): Promise<void> {
    const session = await this.findById(id);
    
    // Delete all items associated with this session first
    await this.massImportItemRepository.delete({ massImportSessionId: id });
    
    // Then delete the session
    await this.massImportSessionRepository.remove(session);
  }

  async updateSessionProgress(sessionId: string): Promise<void> {
    const session = await this.findById(sessionId);
    
    const processedItems = await this.massImportItemRepository.count({
      where: {
        massImportSessionId: sessionId,
        status: MassImportItemStatus.COMPLETED,
      },
    });

    const progressPercentage = (processedItems / session.totalItems) * 100;
    
    await this.massImportSessionRepository.update(sessionId, {
      processedItems,
      progressPercentage,
      status: processedItems === session.totalItems ? MassImportStatus.COMPLETED : MassImportStatus.IN_PROGRESS,
    });
  }

  async updateItem(
    sessionId: string,
    itemId: string,
    updateData: any,
  ): Promise<MassImportItem> {
    const item = await this.massImportItemRepository.findOne({
      where: { id: itemId, massImportSessionId: sessionId },
    });

    if (!item) {
      throw new NotFoundException(`Mass import item with ID ${itemId} not found`);
    }

    Object.assign(item, updateData);
    const updatedItem = await this.massImportItemRepository.save(item);
    
    await this.updateSessionProgress(sessionId);
    
    return updatedItem;
  }

  async addItemsToSession(
    sessionId: string,
    items: PlayerCardItemDto[],
  ): Promise<MassImportSession> {
    const session = await this.findById(sessionId);
    
    const massImportItems = items.map((item: PlayerCardItemDto) =>
      this.massImportItemRepository.create({
        massImportSessionId: sessionId,
        index: item.index,
        firstName: item.firstName,
        lastName: item.lastName,
        playerNumber: item.playerNumber,
        playerFace: item.playerFace,
        season: item.season,
        variant: item.variant,
        imageUrl: item.imageUrl,
        imagePosition: item.imagePosition,
        imageScale: item.imageScale,
        imageRotation: item.imageRotation,
        cardDesign: item.cardDesign,
        textPosition: item.textPosition,
        firstNameSize: item.firstNameSize,
        lastNameSize: item.lastNameSize,
        textGap: item.textGap,
        aiCheck: item.aiCheck as any,
        status: item.status as MassImportItemStatus,
        reviewed: item.reviewed,
      }),
    );

    await this.massImportItemRepository.save(massImportItems);
    
    // Update session totals
    const newTotalItems = session.totalItems + items.length;
    await this.massImportSessionRepository.update(sessionId, {
      totalItems: newTotalItems,
    });
    
    return this.findById(sessionId);
  }

  async removeItemFromSession(
    sessionId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.massImportItemRepository.findOne({
      where: { id: itemId, massImportSessionId: sessionId },
    });

    if (!item) {
      throw new NotFoundException(`Mass import item with ID ${itemId} not found`);
    }

    await this.massImportItemRepository.remove(item);
    
    // Update session totals
    const session = await this.findById(sessionId);
    const newTotalItems = Math.max(0, session.totalItems - 1);
    await this.massImportSessionRepository.update(sessionId, {
      totalItems: newTotalItems,
    });
    
    await this.updateSessionProgress(sessionId);
  }

  async getSessionItems(sessionId: string): Promise<MassImportItem[]> {
    return this.massImportItemRepository.find({
      where: { massImportSessionId: sessionId },
      order: { index: 'ASC' },
    });
  }

  async getSessionStats(sessionId: string): Promise<{
    total: number;
    pending: number;
    ready: number;
    completed: number;
    error: number;
  }> {
    const items = await this.getSessionItems(sessionId);
    
    return {
      total: items.length,
      pending: items.filter(item => item.status === MassImportItemStatus.PENDING).length,
      ready: items.filter(item => item.status === MassImportItemStatus.READY).length,
      completed: items.filter(item => item.status === MassImportItemStatus.COMPLETED).length,
      error: items.filter(item => item.status === MassImportItemStatus.ERROR).length,
    };
  }

  async markItemAsReviewed(sessionId: string, itemId: string): Promise<MassImportItem> {
    const item = await this.massImportItemRepository.findOne({
      where: { id: itemId, massImportSessionId: sessionId },
    });

    if (!item) {
      throw new NotFoundException(`Mass import item with ID ${itemId} not found`);
    }

    item.reviewed = true;
    return this.massImportItemRepository.save(item);
  }

  async bulkUpdateItemStatus(
    sessionId: string,
    itemIds: string[],
    status: MassImportItemStatus,
  ): Promise<void> {
    await this.massImportItemRepository.update(
      { id: In(itemIds), massImportSessionId: sessionId },
      { status },
    );
    
    await this.updateSessionProgress(sessionId);
  }
}
