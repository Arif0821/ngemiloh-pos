import { FeatureFlag } from '@prisma/client';

export const FLAG_REPOSITORY = Symbol('FLAG_REPOSITORY');

export interface IFlagRepository {
  findByName(name: string): Promise<FeatureFlag | null>;
  create(data: {
    name: string;
    description: string;
    is_enabled: boolean;
  }): Promise<FeatureFlag>;
  findAll(orderBy?: any): Promise<FeatureFlag[]>;
  update(
    name: string,
    data: { is_enabled: boolean; updated_by: string; updated_at: Date },
  ): Promise<FeatureFlag>;
}
