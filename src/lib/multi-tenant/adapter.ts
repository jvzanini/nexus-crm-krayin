import type {
  CompanyAdapter,
  CompanyRecord,
  CompanyCreateInput,
  CompanyUpdateInput,
  CompanyListParams,
  MembershipRecord,
  MembershipCreateInput,
  MembershipUpdateInput,
} from "@nexusai360/multi-tenant";
import { prisma } from "@/lib/prisma";

function mapCompany(raw: any): CompanyRecord {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    logoUrl: raw.logoUrl,
    features: (raw.features ?? {}) as Record<string, unknown>,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function mapMembership(raw: any): MembershipRecord {
  return {
    id: raw.id,
    userId: raw.userId,
    companyId: raw.companyId,
    role: raw.role,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export class PrismaCompanyAdapter implements CompanyAdapter {
  async findById(id: string): Promise<CompanyRecord | null> {
    const row = await prisma.company.findUnique({ where: { id } });
    return row ? mapCompany(row) : null;
  }

  async findBySlug(slug: string): Promise<CompanyRecord | null> {
    const row = await prisma.company.findFirst({ where: { slug } });
    return row ? mapCompany(row) : null;
  }

  async list(params: CompanyListParams): Promise<CompanyRecord[]> {
    const where: any = {};
    if (params.ids) where.id = { in: params.ids };
    if (!params.includeInactive) where.isActive = true;
    const rows = await prisma.company.findMany({ where });
    return rows.map(mapCompany);
  }

  async create(data: CompanyCreateInput): Promise<CompanyRecord> {
    const row = await prisma.company.create({
      data: {
        name: data.name,
        slug: data.slug,
        logoUrl: data.logoUrl ?? null,
        features: (data.features ?? {}) as any,
        isActive: data.isActive ?? true,
      },
    });
    return mapCompany(row);
  }

  async update(id: string, data: CompanyUpdateInput): Promise<CompanyRecord> {
    const row = await prisma.company.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.features !== undefined ? { features: data.features as any } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    return mapCompany(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.company.delete({ where: { id } });
  }

  async listMembershipsByUser(userId: string): Promise<MembershipRecord[]> {
    const rows = await prisma.userCompanyMembership.findMany({ where: { userId } });
    return rows.map(mapMembership);
  }

  async listMembershipsByCompany(companyId: string): Promise<MembershipRecord[]> {
    const rows = await prisma.userCompanyMembership.findMany({ where: { companyId } });
    return rows.map(mapMembership);
  }

  async findMembership(userId: string, companyId: string): Promise<MembershipRecord | null> {
    const row = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return row ? mapMembership(row) : null;
  }

  async createMembership(data: MembershipCreateInput): Promise<MembershipRecord> {
    const row = await prisma.userCompanyMembership.create({
      data: {
        userId: data.userId,
        companyId: data.companyId,
        role: data.role,
        isActive: data.isActive ?? true,
      },
    });
    return mapMembership(row);
  }

  async updateMembership(id: string, data: MembershipUpdateInput): Promise<MembershipRecord> {
    const row = await prisma.userCompanyMembership.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    return mapMembership(row);
  }

  async deleteMembership(id: string): Promise<void> {
    await prisma.userCompanyMembership.delete({ where: { id } });
  }
}

export const companyAdapter = new PrismaCompanyAdapter();
