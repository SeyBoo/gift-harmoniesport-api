export type LegalType = 'privacy' | 'legal' | 'terms' | 'ethics' ;

export type LegalLanguage = 'fr' | 'en';


export interface Legal {
  id: number;
  content: string;
  language: LegalLanguage;
  type: LegalType;
} 