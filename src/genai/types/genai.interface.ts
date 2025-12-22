export interface MidjourneyApiResponse {
  id: string;
  prompt: string;
  results: null | string;
  user_created: string;
  date_created: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: null | number;
  url: null | string;
  error: null | string;
  upscaled_urls: null | string[];
  upscaled: string[];
  ref: string | null;
}
