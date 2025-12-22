import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Legal } from './model/legal.entity';
import { LegalLanguage, LegalType } from './legal.types';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';

@Injectable()
export class LegalService {
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(Legal)
    private readonly legalRepository: Repository<Legal>,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async getLegal(type: LegalType, language: LegalLanguage) {
    return this.legalRepository.findOne({ where: { type, language } });
  }

  async prettifyWithGpt(rawText: string): Promise<string> {
    const prompt = `
You are a Markdown expert. Convert the following legal text into clean, well-structured Markdown. Use headings, lists, and formatting where appropriate. Do not invent content, just format what is present.

Text:
${rawText}
  `;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.2,
    });
    return response.choices[0].message?.content?.trim() ?? '';
  }

  async createLegal(type: LegalType, language: LegalLanguage, content: string) {
    return this.legalRepository.save({ type, language, content });
  }

  async updateLegal(id: number, content: string) {
    return this.legalRepository.update(id, { content });
  }

  async getAllLegalDocuments(): Promise<Legal[]> {
    return this.legalRepository.find();
  }

  async convertPdfToMarkdown(
    file: Express.Multer.File,
  ): Promise<{ markdown: string }> {
    const data = await pdfParse(file.buffer);

    const markdown = data.text
      .split(/\n{2,}/)
      .map((para) => (para.trim().length ? `\n${para}\n` : ''))
      .join('\n');

    const prettyMarkdown = await this.prettifyWithGpt(markdown);

    return { markdown: prettyMarkdown };
  }

  async translateWithGpt(
    content: string,
    targetLanguage: string,
  ): Promise<string> {
    const prompt = `Translate the following legal text to ${targetLanguage}. Preserve formatting and legal meaning.\n\nText:\n${content}`;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.2,
    });
    return response.choices[0].message?.content?.trim() ?? '';
  }
}
