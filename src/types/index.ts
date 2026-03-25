export type PricingModel = 'Free' | 'Freemium' | 'Paid';

export interface Tool {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  imageUrl: string;
  category: string;
  pricingModel: PricingModel;
  tags: string[];
}
