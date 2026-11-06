 import { PrismaClient } from '@prisma/client'

/**
 * The single door to the database.
 *
 * One client for the whole app. In development Next.js reloads modules on every
 * change, so without the global below each reload would open another pool of
 * connections and the database would eventually refuse new ones.
 */

const globalForPrisma = globalThis as unknown as { billonPrisma?: PrismaClient }

export const prisma =
  globalForPrisma.billonPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.billonPrisma = prisma

export default prisma
