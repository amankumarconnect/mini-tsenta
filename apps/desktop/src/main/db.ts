import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL is missing from process.env!')
} else {
  console.log('✅ DATABASE_URL found:', connectionString.replace(/:[^:@]*@/, ':****@')) // Mask password
}
console.log('DB Connection String:', connectionString)
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export default prisma
