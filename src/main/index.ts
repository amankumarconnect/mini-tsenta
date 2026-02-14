import { app, BrowserWindow, ipcMain, BrowserView, dialog } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { chromium, Page } from 'playwright-core'
import {
  isJobTitleRelevant,
  isJobRelevant,
  generateApplication,
  getEmbedding,
  generateJobPersona
} from './ollama'
import { PDFParse } from 'pdf-parse'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import prisma from './db'

// Playwright connects to Electron's own BrowserView via this CDP port
app.commandLine.appendSwitch('remote-debugging-port', '9222')

let mainWindow: BrowserWindow
let view: BrowserView
let automationRunning = false
let isPaused = false

interface UserData {
  text: string
  embedding: number[]
  hasResume: boolean
}

const userDataPath = join(app.getPath('userData'), 'user-data.json')
const resumePath = join(app.getPath('userData'), 'resume.pdf')
let userProfile: UserData | null = null

try {
  if (existsSync(userDataPath)) {
    userProfile = JSON.parse(readFileSync(userDataPath, 'utf-8'))
    console.log('Loaded user profile from:', userDataPath)
  }
} catch (error) {
  console.error('Failed to load user data:', error)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Layout: left 450px = React control panel, right = live WorkAtAStartup browsing
  view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  mainWindow.setBrowserView(view)

  const updateBounds = (): void => {
    const { width, height } = mainWindow.getBounds()
    const sidebarWidth = 450
    view.setBounds({ x: sidebarWidth, y: 0, width: width - sidebarWidth, height: height })
  }

  mainWindow.on('resize', updateBounds)
  updateBounds()

  view.webContents.loadURL('https://www.workatastartup.com/companies')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getFullUrl(partialUrl: string): string {
  if (partialUrl.startsWith('http')) return partialUrl
  return `https://www.workatastartup.com${partialUrl}`
}

async function scrollAndHighlight(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  await locator.evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  await page.waitForTimeout(800)
}


// const visitedCompanies = new Set<string>() // Replaced by DB

ipcMain.handle('start-automation', async () => {
  if (!userProfile) {
    throw new Error('User profile not found. Please upload a resume first.')
  }
  automationRunning = true

  const log = (
    msg: string,
    opts?: {
      type?: 'info' | 'success' | 'error' | 'skip' | 'match'
      jobTitle?: string
      matchScore?: number
    }
  ): void => {
    mainWindow.webContents.send('log', {
      message: msg,
      type: opts?.type || 'info',
      jobTitle: opts?.jobTitle,
      matchScore: opts?.matchScore
    })
  }

  log('Connecting to browser...')

  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    const contexts = browser.contexts()
    const defaultContext = contexts[0]

    const page = defaultContext.pages().find((p) => p.url().includes('workatastartup.com'))
    if (!page) throw new Error('Please navigate to Work At A Startup first!')

    await page.bringToFront()
    log('Starting automation loop...')

    while (automationRunning) {
      while (isPaused && automationRunning) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (!automationRunning) break
      }
      if (!automationRunning) break

      const isListUrl = page.url().includes('/companies') && !page.url().includes('/companies/')

      if (!isListUrl) {
        log('Not on list page. Navigating...')
        await page.goto('https://www.workatastartup.com/companies')
        await page.waitForTimeout(2000)
      }

      try {
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 5000 })
      } catch {
        log('Page empty? Reloading list...')
        await page.reload()
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 10000 })
      }

      const companiesOnScreen = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href^="/companies/"]'))
        return anchors
          .map((a) => a.getAttribute('href'))
          .filter(
            (href): href is string =>
              href !== null &&
              !href.includes('/jobs/') &&
              !href.startsWith('http') &&
              !href.includes('/website') &&
              !href.includes('/twitter') &&
              !href.includes('/linkedin')
          )
          .filter((value, index, self) => self.indexOf(value) === index)
      })


      const newCompanies: string[] = []
      for (const c of companiesOnScreen) {
        const fullUrl = getFullUrl(c)
        const exists = await prisma.company.findUnique({ where: { url: fullUrl } })
        if (!exists) newCompanies.push(c)
      }

      log(`Found ${newCompanies.length} new companies.`)

      if (newCompanies.length === 0) {
        log('No new companies. Scrolling...')
        await page.mouse.wheel(0, 3000)
        await page.waitForTimeout(3000)
        continue
      }

      for (const relativeUrl of newCompanies) {
        while (isPaused && automationRunning) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        if (!automationRunning) break


        const fullCompanyUrl = getFullUrl(relativeUrl)
        try {
          await prisma.company.create({
            data: {
              url: fullCompanyUrl,
              name: relativeUrl.replace('/companies/', ''),
              status: 'visited'
            }
          })
        } catch (e) {
          console.error('Failed to save company to DB:', e)
        }

        const companyUrl = getFullUrl(relativeUrl)
        log(`Checking company: ${relativeUrl.replace('/companies/', '')}`)

        const companyLink = page.locator(`a[href="${relativeUrl}"]`).first()
        try {
          await scrollAndHighlight(page, companyLink)
        } catch {
          // Element may not be visible
        }
        const listScrollY = await page.evaluate(() => window.scrollY)
        await page.goto(companyUrl)

        try {
          await page.waitForLoadState('domcontentloaded')
          await page.waitForTimeout(1500)
        } catch {
          log('Timeout loading company, skipping.', { type: 'skip' })
          continue
        }

        const jobLinks = await page.locator('a[href*="/jobs/"]').all()

        if (jobLinks.length > 0) {
          log(`Found ${jobLinks.length} job(s) at this company.`)

          for (const jobLink of jobLinks) {
            while (isPaused && automationRunning) {
              await new Promise((resolve) => setTimeout(resolve, 500))
            }
            if (!automationRunning) break

            await scrollAndHighlight(page, jobLink)

            const jobTitle = (await jobLink.innerText()).trim()
            const rawJobHref = await jobLink.getAttribute('href')

            if (!rawJobHref) continue

            const fullJobUrl = getFullUrl(rawJobHref)

            const recordSkippedJob = async (
              jobTitle: string,
              companyName: string,
              jobUrl: string,
              reason: string
            ) => {
              try {
                // Check if it already exists to avoid unique constraint errors
                const exists = await prisma.application.findUnique({ where: { jobUrl } })
                if (exists) return

                await prisma.application.create({
                  data: {
                    jobTitle,
                    companyName,
                    jobUrl,
                    coverLetter: reason, // Store the reason in the cover letter field
                    status: 'skipped'
                  }
                })
              } catch (e) {
                console.error(`Failed to record skipped job: ${jobTitle}`, e)
              }
            }

            if (jobTitle.length < 5 || /^(view|apply|see|open)\s/i.test(jobTitle)) continue

            log(`Checking title match...`, { jobTitle })
            const titleResult = await isJobTitleRelevant(jobTitle, userProfile.embedding)
            if (!titleResult.relevant) {
              log(`Title not relevant, skipping.`, {
                type: 'skip',
                jobTitle,
                matchScore: titleResult.score
              })
              await recordSkippedJob(
                jobTitle,
                relativeUrl.replace('/companies/', ''),
                fullJobUrl,
                `Title mismatch (Score: ${titleResult.score})`
              )
              continue
            }

            log(`Title looks relevant!`, {
              type: 'match',
              jobTitle,
              matchScore: titleResult.score
            })

            // const fullJobUrl = getFullUrl(rawJobHref) // Alrdy computed above

            const companyScrollY = await page.evaluate(() => window.scrollY)

            // Navigate instead of clicking — links on this site open in new tabs
            await page.goto(fullJobUrl)
            await page.waitForTimeout(1500)

            try {
              const appliedBtn = page.getByText('Applied', { exact: true })
              if ((await appliedBtn.count()) > 0) {
                log('Already applied, skipping.', { type: 'skip', jobTitle })
                // Optional: record as 'applied' if not in DB?
                // For now, let's just record it as skipped/already-applied if we want visibility
                /*
                await recordSkippedJob(
                  jobTitle,
                  relativeUrl.replace('/companies/', ''),
                  fullJobUrl,
                  'Already applied on website'
                )
                */
              } else {
                const jobDescriptionText = await page.evaluate(() => {
                  const content = document.querySelector('main') || document.body
                  return content.innerText
                })

                log('AI analyzing job description...', { jobTitle })
                const fitResult = await isJobRelevant(jobDescriptionText, userProfile.embedding)

                if (!fitResult.relevant) {
                  log('Not a good fit, skipping.', {
                    type: 'skip',
                    jobTitle,
                    matchScore: fitResult.score
                  })
                  await recordSkippedJob(
                    jobTitle,
                    relativeUrl.replace('/companies/', ''),
                    fullJobUrl,
                    `Description mismatch (Score: ${fitResult.score})`
                  )
                } else {
                  log('Good fit! Generating application...', {
                    type: 'success',
                    jobTitle,
                    matchScore: fitResult.score
                  })

                  const applyBtn = page.getByText('Apply', { exact: true }).first()
                  if (await applyBtn.isVisible()) {
                    await scrollAndHighlight(page, applyBtn)
                    await applyBtn.click()
                    await page.waitForTimeout(500)
                  }

                  const textArea = page.locator('textarea').first()
                  if (await textArea.isVisible()) {
                    await scrollAndHighlight(page, textArea)

                    const coverLetter = await generateApplication(
                      jobDescriptionText,
                      userProfile.text
                    )
                    log(`Typing application (${coverLetter.length} chars)...`, { jobTitle })

                    await textArea.pressSequentially(coverLetter, { delay: 10, timeout: 60000 })

                    // Save application to DB
                    try {
                      await prisma.application.create({
                        data: {
                          jobTitle,
                          companyName: relativeUrl.replace('/companies/', ''),
                          jobUrl: fullJobUrl,
                          coverLetter,
                          status: 'submitted' // or 'drafted'
                        }
                      })
                      log('Application saved to database.', { type: 'success', jobTitle })
                    } catch (e) {
                      console.error('Failed to save application:', e)
                      log('Failed to save application to DB', { type: 'error', jobTitle })
                    }

                    // Submission disabled — remove this guard when ready to go live
                    log('Application filled! (Not submitted - testing mode)', {
                      type: 'success',
                      jobTitle
                    })
                  }
                }
              }
            } catch (e) {
              log(`Error: ${(e as Error).message}`, { type: 'error', jobTitle })
            }

            await page.goBack()
            await page.waitForTimeout(1000)
            await page.evaluate((y) => window.scrollTo(0, y), companyScrollY)
          }
        }

        log('Returning to list...')
        await page.goBack()

        try {
          await page.waitForSelector('a[href^="/companies/"]', { timeout: 3000 })
          await page.evaluate((y) => window.scrollTo(0, y), listScrollY)
        } catch {
          log('List failed to render. Forcing reload...')
          await page.goto('https://www.workatastartup.com/companies')
          await page.waitForLoadState('networkidle')
        }

        await page.waitForTimeout(1000)
      }
    }

    log('Automation stopped.')
    try {
      await browser.close()
    } catch {
      // CDP disconnection errors are expected
    }
  } catch (error) {
    console.error(error)
    mainWindow.webContents.send('log', {
      message: (error as Error).message,
      type: 'error'
    })
  }
})

ipcMain.on('stop-automation', () => {
  automationRunning = false
  isPaused = false
  mainWindow.webContents.send('log', {
    message: 'Stopping automation and closing app...',
    type: 'info'
  })
  setTimeout(() => {
    app.quit()
  }, 1000)
})

ipcMain.on('pause-automation', () => {
  if (automationRunning) {
    isPaused = true
    mainWindow.webContents.send('log', {
      message: 'Automation PAUSED. Click "Continue" to resume.',
      type: 'info'
    })
  }
})

ipcMain.on('resume-automation', () => {
  if (automationRunning && isPaused) {
    isPaused = false
    mainWindow.webContents.send('log', {
      message: 'Automation RESUMED.',
      type: 'info'
    })
  }
})

// Pipeline: PDF → text → LLM generates a "target job persona" → embedding for matching
ipcMain.handle('save-resume', async (_event, buffer: ArrayBuffer) => {
  try {
    writeFileSync(resumePath, Buffer.from(buffer))

    const parser = new PDFParse({ data: Buffer.from(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    const text = result.text

    console.log('Generating Target Job Persona from resume...')
    const persona = await generateJobPersona(text)
    console.log('Generated Persona:', persona)

    console.log('Generating embedding from persona...')
    const embedding = await getEmbedding(persona)

    // text = original resume (for cover letters), embedding = from persona (for matching)
    userProfile = { text, embedding, hasResume: true }
    writeFileSync(userDataPath, JSON.stringify(userProfile))

    return true
  } catch (error) {
    console.error('Error saving resume:', error)
    throw new Error('Failed to save resume')
  }
})

ipcMain.handle('download-resume', async () => {
  if (!existsSync(resumePath)) {
    throw new Error('No resume found to download')
  }

  const { filePath } = await dialog.showSaveDialog({
    title: 'Download Resume',
    defaultPath: 'resume.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  if (filePath) {
    writeFileSync(filePath, readFileSync(resumePath))
  }
})

ipcMain.handle('get-user-profile', async () => {
  return userProfile ? { hasResume: userProfile.hasResume } : null
})

ipcMain.handle('get-applications', async () => {
  try {
    return await prisma.application.findMany({
      orderBy: { appliedAt: 'desc' }
    })
  } catch (error) {
    console.error('Failed to fetch applications:', error)
    return []
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mini-tsenta')
  createWindow()
})
