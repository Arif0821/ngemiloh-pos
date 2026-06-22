import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AssignedOutlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_primary: boolean;
}

@Injectable()
export class OutletService {
  constructor(private readonly prisma: PrismaService) {}

  async get_assigned_outlets(user_id: string): Promise<AssignedOutlet[]> {
    const user_outlets = await this.prisma.userOutlet.findMany({
      where: {
        user_id,
        outlet: {
          is_active: true,
        },
      },
      include: {
        outlet: true,
      },
      orderBy: [
        { is_primary: 'desc' },
        { assigned_at: 'asc' },
      ],
    });

    return user_outlets.map((uo) => ({
      id: uo.outlet.id,
      name: uo.outlet.name,
      address: uo.outlet.address,
      phone: uo.outlet.phone,
      is_primary: uo.is_primary,
    }));
  }

  async get_default_outlet(user_id: string): Promise<string | null> {
    const primary = await this.prisma.userOutlet.findFirst({
      where: {
        user_id,
        is_primary: true,
        outlet: {
          is_active: true,
        },
      },
      include: {
        outlet: true,
      },
    });

    return primary?.outlet.id || null;
  }

  async validate_cashier_outlet(user_id: string, outlet_id: string): Promise<boolean> {
    const assignment = await this.prisma.userOutlet.findUnique({
      where: {
        user_id_outlet_id: {
          user_id,
          outlet_id,
        },
      },
      include: {
        outlet: true,
      },
    });

    return !!assignment && assignment.outlet.is_active;
  }

  async get_outlet_by_id(outlet_id: string) {
    return this.prisma.outlet.findUnique({
      where: { id: outlet_id },
    });
  }
}
