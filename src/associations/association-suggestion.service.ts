import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OpenAI } from 'openai';
import { UploadService } from '../common/upload/upload.service';
import { ThematicList } from '../thematics/entities/thematic.entity';
import { TranslatorService } from '../common/translator/translator.service';

@Injectable()
export class AssociationSuggestionService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(AssociationSuggestionService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly uploadService: UploadService,
    private readonly translatorService: TranslatorService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  private async fetchFromOfficialAPI(associationName: string) {
    try {
      const response = await this.httpService.axiosRef.get(
        'https://journal-officiel-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/jo_associations/records',
        {
          params: {
            select: '*',
            where: `titre like "${associationName}"`,
            limit: 20,
          },
        },
      );

      if (response.data.results && response.data.results.length > 0) {
        const association = response.data.results[0];

        // Construct full address from available fields
        const address = [
          association.adresse_actuelle,
          association.codepostal_actuel,
          association.commune_actuelle,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          name: association.titre,
          address: address,
          description: association.objet,
          site_internet: association.siteweb || '',
          // Additional fields from the API
          reference: association.numero_rna || '',
          departement: association.departement_libelle,
          region: association.region_libelle,
          declaration_date: association.datedeclaration,
          geo_coordinates: association.geo_point
            ? {
                latitude: association.geo_point.lat,
                longitude: association.geo_point.lon,
              }
            : null,
          type: association.association_type_libelle,
        };
      }

      this.logger.warn(
        `No official data found for association: ${associationName}`,
      );
      return null;
    } catch (error) {
      this.logger.warn(`Could not fetch from official API: ${error.message}`, {
        error,
        associationName,
      });
      return null;
    }
  }

  private async translateDescriptions(descriptions: {
    description: string;
    fond_usage_description: string;
    shorten_description: string;
    mission_description: string;
  }) {
    const translatedData = {
      description: await this.translatorService.translateAll(
        descriptions.description,
      ),
      fond_usage_description: await this.translatorService.translateAll(
        descriptions.fond_usage_description,
      ),
      shorten_description: await this.translatorService.translateAll(
        descriptions.shorten_description,
      ),
      mission_description: await this.translatorService.translateAll(
        descriptions.mission_description,
      ),
    };

    return {
      description: translatedData.description,
      fond_usage_description: translatedData.fond_usage_description,
      shorten_description: translatedData.shorten_description,
      mission_description: translatedData.mission_description,
    };
  }

  private async findLogo(
    associationName: string,
    website: string,
  ): Promise<string> {
    try {
      // Ask OpenAI for potential logo sources
      const logoPrompt = `Find the most likely URL for the official logo of "${associationName}". 
      Their website is: ${website || 'unknown'}
      
      Consider these sources in order:
      1. Official website favicon or logo
      2. Social media profiles (Facebook, LinkedIn, Twitter)
      3. Press releases or news articles
      4. Official documents
      
      Return a JSON object with:
      {
        "logoUrl": "direct url to the logo image",
        "confidence": "high|medium|low",
        "source": "brief description of where this logo was found"
      }
      
      If no logo can be found with reasonable confidence, return null for logoUrl.`;

      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'system', content: logoPrompt }],
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
      });

      const logoInfo = JSON.parse(completion.choices[0].message.content);

      if (!logoInfo.logoUrl) {
        this.logger.warn(`No logo found for association: ${associationName}`);
        return null;
      }

      // Verify the logo URL is accessible and is an image
      try {
        const response = await this.httpService.axiosRef.head(logoInfo.logoUrl);
        const contentType = response.headers['content-type'];

        if (!contentType?.startsWith('image/')) {
          this.logger.warn(`Invalid content type for logo: ${contentType}`);
          return null;
        }

        // Try to get the actual image data
        const { data: logoBuffer, contentType: imageType } =
          await this.uploadService.getBufferFromUrl(logoInfo.logoUrl);

        if (!logoBuffer) {
          this.logger.warn(
            `Could not download logo from URL: ${logoInfo.logoUrl}`,
          );
          return null;
        }

        // Upload the logo to your storage
        const uploadedLogoUrl = await this.uploadService.uploadFile(
          logoBuffer,
          {
            ContentType: imageType,
            Key: `uploads/associations-logos/${Date.now()}-${associationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${imageType.split('/')[1]}`,
          },
          true,
        );

        this.logger.log(
          `Successfully processed logo for ${associationName} (${logoInfo.source})`,
        );
        return uploadedLogoUrl;
      } catch (error) {
        this.logger.error(
          `Error processing logo URL ${logoInfo.logoUrl}: ${error.message}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(`Error in findLogo: ${error.message}`);
      return null;
    }
  }

  private async enrichDataWithOpenAI(
    associationName: string,
    officialData: any,
  ) {
    const prompt = `You are an AI assistant helping to gather information about the association "${associationName}". 
    Please provide the following information in a JSON format:
    - name: Full name of the association
    - description: A detailed description of their activities (2-3 paragraphs)
    - fond_usage_description: Description of how they use their funds (1-2 paragraphs)
    - shorten_description: A brief summary of the association (1-2 sentences)
    - mission_description: Their main missions and objectives (1 paragraph)
    - thematic: Main theme from this list: ${Object.values(ThematicList).join(', ')}
    - address: Physical address if available
    - site_internet: Website URL if available
    - color_asso: The main brand color in hex format (e.g., "#FF0000")
    - contact_name: The name of the main contact person if available

    Use the following official data if available: ${JSON.stringify(officialData)}
    If any information is not available, make educated guesses based on the association's name and known activities.
    Return only the JSON object without any additional text.
    All descriptions should be in French.`;

    const completion = await this.openai.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
    });

    const enrichedData = JSON.parse(completion.choices[0].message.content);

    // Find and process the logo
    const logo = await this.findLogo(
      associationName,
      enrichedData.site_internet,
    );
    enrichedData.logo = logo;

    // Translate all description fields
    // const translatedDescriptions = await this.translateDescriptions({
    //   description: enrichedData.description,
    //   fond_usage_description: enrichedData.fond_usage_description,
    //   shorten_description: enrichedData.shorten_description,
    //   mission_description: enrichedData.mission_description,
    // });

    return enrichedData;
  }

  async suggestAssociationData(associationName: string) {
    try {
      const officialData = await this.fetchFromOfficialAPI(associationName);
      const enrichedData = await this.enrichDataWithOpenAI(
        associationName,
        officialData,
      );

      return enrichedData;
    } catch (error) {
      this.logger.error(`Error suggesting association data: ${error.message}`);
      throw error;
    }
  }
}
