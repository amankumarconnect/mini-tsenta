import { defineConfig } from '@prisma/config'
import dotenv from 'dotenv'

dotenv.config({ override: true })

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL
  }
})
