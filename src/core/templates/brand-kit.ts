import { randomUUID } from 'node:crypto'
import type { BrandKit, HostBridge } from '../types.ts'

export function createDefaultBrandKit(projectId: string, institutionName = ''): BrandKit {
  return {
    id: `brand-${randomUUID().slice(0, 8)}`,
    projectId,
    name: 'Kit de Marca Padrão',
    institutionName,
    department: '',
    footerText: '',
    signatureName: '',
    signatureRole: '',
    primaryColor: '#1E3A8A',
    secondaryColor: '#334155',
    accentColor: '#7C3AED',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    updatedAt: Date.now()
  }
}

export async function getBrandKitForProject(
  bridge: HostBridge,
  projectId: string
): Promise<BrandKit | null> {
  const rows = (await bridge.collections.list('brand_kits', {
    where: { projectId },
    limit: 1
  })) as BrandKit[]
  return rows[0] || null
}

export async function saveBrandKit(bridge: HostBridge, kit: BrandKit): Promise<BrandKit> {
  const updated: BrandKit = {
    ...kit,
    id: kit.id || `brand-${randomUUID().slice(0, 8)}`,
    updatedAt: Date.now()
  }
  await bridge.collections.upsert('brand_kits', updated as unknown as Record<string, unknown>)
  return updated
}
