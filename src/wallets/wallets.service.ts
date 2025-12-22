import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { Wallet } from './entities/wallet.entity';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
 
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto');

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  create(createWalletDto: CreateWalletDto) {
    return this.walletRepository.insert(createWalletDto);
  }

  findAll() {
    return `This action returns all wallets`;
  }

  findOne(id: number) {
    return `This action returns a #${id} wallet`;
  }

  update(id: number) {
    return `This action updates a #${id} wallet`;
  }

  remove(id: number) {
    return `This action removes a #${id} wallet`;
  }

  encrypt(text: string, secretKey: string) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText, secretKey) {
    const decipher = crypto.createDecipher('aes-256-cbc', secretKey);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  generateWalletSecure() {
    const wallet = ethers.Wallet.createRandom();
    const secretKey = crypto.randomBytes(32).toString('hex');
    const privateKeySecure = this.encrypt(wallet.privateKey, secretKey);
    return {
      address: wallet.address,
      privateKey: privateKeySecure,
      secretKey: secretKey,
    };
  }
}
