import { app, BrowserWindow, ipcMain, BrowserView } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { chromium, Page } from 'playwright-core'
import { isJobTitleRelevant, isJobRelevant, generateApplication, getEmbedding, generateJobPersona } from './ollama'
import { PDFParse } from 'pdf-parse'
import { writeFileSync, readFileSync, existsSync } from 'fs'

// 1. Enable Debugging Port for Playwright
app.commandLine.appendSwitch('remote-debugging-port', '9222')

let mainWindow: BrowserWindow
let view: BrowserView
let automationRunning = false

interface UserData {
  text: string
  embedding: number[]
}

const userDataPath = join(app.getPath('userData'), 'user-data.json')
let userProfile: UserData | null = null

// Load on startup
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

  // 2. Setup the "Right Side" BrowserView
  view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  mainWindow.setBrowserView(view)

  // Initial Layout (Right 60% of the screen)
  const updateBounds = (): void => {
    const { width, height } = mainWindow.getBounds()
    const sidebarWidth = 450
    view.setBounds({ x: sidebarWidth, y: 0, width: width - sidebarWidth, height: height })
  }

  mainWindow.on('resize', updateBounds)
  updateBounds()

  // Load YC initially
  view.webContents.loadURL('https://www.workatastartup.com/companies')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- AUTOMATION LOGIC ---

// Helper: URL Cleaner
function getFullUrl(partialUrl: string): string {
  if (partialUrl.startsWith('http')) return partialUrl
  return `https://www.workatastartup.com${partialUrl}`
}

// Helper: Scroll to an element smoothly, wait a beat so the user can track it
async function scrollAndHighlight(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  await locator.evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  // Wait for the smooth scroll animation to finish + a brief pause for visibility
  await page.waitForTimeout(800)
}

// Global set to remember visited companies
const visitedCompanies = new Set<string>()

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

    // 1. Identify the active page
    const page = defaultContext.pages().find((p) => p.url().includes('workatastartup.com'))
    if (!page) throw new Error('Please navigate to Work At A Startup first!')

    await page.bringToFront()
    log('Starting automation loop...')

    while (automationRunning) {
      // --- STEP 1: ENSURE WE ARE ON THE LIST ---
      const isListUrl = page.url().includes('/companies') && !page.url().includes('/companies/')

      if (!isListUrl) {
        log('Not on list page. Navigating...')
        await page.goto('https://www.workatastartup.com/companies')
        await page.waitForTimeout(2000)
      }

      // Wait for list to load
      try {
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 5000 })
      } catch {
        log('Page empty? Reloading list...')
        await page.reload()
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 10000 })
      }

      // --- STEP 2: SCRAPE LINKS ---
      const companiesOnScreen = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href^="/companies/"]'))
        return anchors
          .map((a) => a.getAttribute('href'))
          .filter(
            (href): href is string =>
              href !== null &&
              !href.includes('/jobs/') &&
              !href.startsWith('http') && // Only take internal relative links
              !href.includes('/website') && // --- FIX: Exclude website links
              !href.includes('/twitter') &&
              !href.includes('/linkedin')
          )
          .filter((value, index, self) => self.indexOf(value) === index)
      })

      const newCompanies = companiesOnScreen.filter((c) => !visitedCompanies.has(c))

      log(`Found ${newCompanies.length} new companies.`)

      if (newCompanies.length === 0) {
        log('No new companies. Scrolling...')
        await page.mouse.wheel(0, 3000)
        await page.waitForTimeout(3000)
        continue
      }

      // --- STEP 3: PROCESS EACH COMPANY ---
      for (const relativeUrl of newCompanies) {
        if (!automationRunning) break

        visitedCompanies.add(relativeUrl)

        // Construct Company URL safely
        const companyUrl = getFullUrl(relativeUrl)
        log(`Checking company: ${relativeUrl.replace('/companies/', '')}`)

        // Scroll to the company link on the list page for visual feedback, then navigate
        const companyLink = page.locator(`a[href="${relativeUrl}"]`).first()
        try {
          await scrollAndHighlight(page, companyLink)
        } catch {
          // Element may not be visible, that's okay
        }
        // Save list scroll position
        const listScrollY = await page.evaluate(() => window.scrollY)
        await page.goto(companyUrl)

        try {
          await page.waitForLoadState('domcontentloaded')
          await page.waitForTimeout(1500)
        } catch {
          log('Timeout loading company, skipping.', { type: 'skip' })
          continue
        }

        // FIND ENGINEERING JOBS
        // Sometimes jobs are 'a' tags with href containing /jobs/
        const jobLinks = await page.locator('a[href*="/jobs/"]').all()

        if (jobLinks.length > 0) {
          log(`Found ${jobLinks.length} job(s) at this company.`)

          for (const jobLink of jobLinks) {
            if (!automationRunning) break

            // Scroll to the job link so the user can see it in the BrowserView
            await scrollAndHighlight(page, jobLink)

            const jobTitle = (await jobLink.innerText()).trim()
            const rawJobHref = await jobLink.getAttribute('href')

            if (!rawJobHref) continue

            // Skip generic links like "View job", "Apply", etc.
            if (jobTitle.length < 5 || /^(view|apply|see|open)\s/i.test(jobTitle)) continue

            // AI: Quick title check before navigating to save time
            log(`Checking title match...`, { jobTitle })
            const titleResult = await isJobTitleRelevant(jobTitle, userProfile.embedding)
            if (!titleResult.relevant) {
              log(`Title not relevant, skipping.`, {
                type: 'skip',
                jobTitle,
                matchScore: titleResult.score
              })
              continue
            }

            log(`Title looks relevant!`, {
              type: 'match',
              jobTitle,
              matchScore: titleResult.score
            })

            const fullJobUrl = getFullUrl(rawJobHref)

            // Save company page scroll position
            const companyScrollY = await page.evaluate(() => window.scrollY)

            // Navigate to the job page (don't click — links open in new tabs on this site)
            await page.goto(fullJobUrl)
            await page.waitForTimeout(1500)

            try {
              // CHECK: Already Applied?
              const appliedBtn = page.getByText('Applied', { exact: true })
              if ((await appliedBtn.count()) > 0) {
                log('Already applied, skipping.', { type: 'skip', jobTitle })
              } else {
                // GET JOB DESCRIPTION TEXT
                const jobDescriptionText = await page.evaluate(() => {
                  // Try to get the main job description content
                  const content = document.querySelector('main') || document.body
                  return content.innerText
                })

                // AI: CHECK IF JOB IS RELEVANT (deep check on full description)
                log('AI analyzing job description...', { jobTitle })
                const fitResult = await isJobRelevant(jobDescriptionText, userProfile.embedding)

                if (!fitResult.relevant) {
                  log('Not a good fit, skipping.', {
                    type: 'skip',
                    jobTitle,
                    matchScore: fitResult.score
                  })
                } else {
                  log('Good fit! Generating application...', {
                    type: 'success',
                    jobTitle,
                    matchScore: fitResult.score
                  })

                  // APPLY FLOW
                  const applyBtn = page.getByText('Apply', { exact: true }).first()
                  if (await applyBtn.isVisible()) {
                    await scrollAndHighlight(page, applyBtn)
                    await applyBtn.click()
                    await page.waitForTimeout(500)
                  }

                  const textArea = page.locator('textarea').first()
                  if (await textArea.isVisible()) {
                    // Scroll to the textarea so the user sees the application being typed
                    await scrollAndHighlight(page, textArea)

                    // AI: GENERATE APPLICATION
                    const coverLetter = await generateApplication(
                      jobDescriptionText,
                      userProfile.text
                    )
                    log(`Typing application (${coverLetter.length} chars)...`, { jobTitle })
                    
                    // Typing faster (10ms) and allowing more time (60s) to avoid timeouts
                    await textArea.pressSequentially(coverLetter, { delay: 10, timeout: 60000 })
                    
                    log('Application filled! (Not submitted - testing mode)', {
                      type: 'success',
                      jobTitle
                    })

                    // NOT SUBMITTING - Testing mode
                    // await page.getByRole('button', { name: 'Send Application' }).click()
                    // await page.waitForTimeout(1000)
                  }
                }
              }
            } catch (e) {
              log(`Error: ${(e as Error).message}`, { type: 'error', jobTitle })
            }

            // Go back to Company Page
            await page.goBack()
            await page.waitForTimeout(1000)
            // Restore company page scroll
            await page.evaluate((y) => window.scrollTo(0, y), companyScrollY)
          }
        }

        // --- STEP 4: RETURN TO LIST ---
        log('Returning to list...')
        await page.goBack()

        // Verify we actually made it back
        try {
          await page.waitForSelector('a[href^="/companies/"]', { timeout: 3000 })
          // Restore list scroll
          await page.evaluate((y) => window.scrollTo(0, y), listScrollY)
        } catch {
          log('List failed to render. Forcing reload...')
          await page.goto('https://www.workatastartup.com/companies')
          await page.waitForLoadState('networkidle')
        }

        await page.waitForTimeout(1000)
      }
    }

    // --- FIX: Disconnect safely ---
    log('Automation stopped.')
    try {
      await browser.close()
    } catch {
      // Ignore disconnection errors
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
  mainWindow.webContents.send('log', {
    message: 'Stopping automation and closing app...',
    type: 'info'
  })
  setTimeout(() => {
    app.quit()
  }, 1000)
})

ipcMain.handle('parse-resume', async (_event, buffer: ArrayBuffer) => {
  try {
    const parser = new PDFParse({ data: Buffer.from(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error('Failed to parse PDF')
  }
})

ipcMain.handle('save-user-profile', async (_event, text: string) => {
  try {
    // 1. Generate the "Target Job Persona" from the resume
    console.log('Generating Target Job Persona from resume...')
    const persona = await generateJobPersona(text)
    console.log('Generated Persona:', persona)

    // 2. Generate embedding from the PERSONA (not the raw resume)
    console.log('Generating embedding from persona...')
    const embedding = await getEmbedding(persona)

    // 3. Save the ORIGINAL text (for cover letters) and the NEW embedding
    userProfile = { text, embedding }
    writeFileSync(userDataPath, JSON.stringify(userProfile))
    return true
  } catch (error) {
    console.error('Error saving user profile:', error)
    throw error
  }
})

ipcMain.handle('get-user-profile', async () => {
  return userProfile?.text || null
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mini-tsenta')
  createWindow()
})
