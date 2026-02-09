import { app, BrowserWindow, ipcMain, BrowserView } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { chromium, Page } from 'playwright-core'

// 1. Enable Debugging Port for Playwright
app.commandLine.appendSwitch('remote-debugging-port', '9222')

let mainWindow: BrowserWindow
let view: BrowserView
let automationRunning = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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
  const updateBounds = () => {
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

// Helper: AI Generation (Mock)
async function generateApplication(jobText: string, userProfile: string, apiKey: string) {
  // Mock return for testing
  return `Hi! I read your job description for ${jobText.slice(0, 20)}... and I think my skills in ${userProfile.slice(0, 20)}... are a great fit.`
}

// Helper: URL Cleaner
function getFullUrl(partialUrl: string): string {
  if (partialUrl.startsWith('http')) return partialUrl
  return `https://www.workatastartup.com${partialUrl}`
}

// Global set to remember visited companies
const visitedCompanies = new Set<string>()

ipcMain.handle('start-automation', async (event, { userProfile, apiKey }) => {
  automationRunning = true
  
  const log = (msg: string, page?: Page) => {
    const url = page ? page.url() : 'Init'
    // Cleaner log format
    const displayUrl = url.includes('workatastartup.com') 
        ? url.split('workatastartup.com')[1] 
        : 'External Site'
    mainWindow.webContents.send('log', `[${displayUrl}] ${msg}`)
  }

  log('Connecting to browser...')

  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    const contexts = browser.contexts()
    const defaultContext = contexts[0]

    // 1. Identify the active page
    let page = defaultContext.pages().find((p) => p.url().includes('workatastartup.com'))
    if (!page) throw new Error('Please navigate to Work At A Startup first!')

    await page.bringToFront()
    log('Starting Loop...', page)

    while (automationRunning) {
      // --- STEP 1: ENSURE WE ARE ON THE LIST ---
      const isListUrl = page.url().includes('/companies') && !page.url().includes('/companies/')
      
      if (!isListUrl) {
          log('Not on list page. Navigating...', page)
          await page.goto('https://www.workatastartup.com/companies')
          await page.waitForTimeout(2000)
      }

      // Wait for list to load
      try {
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 5000 })
      } catch (e) {
        log('Page empty? Reloading list...', page)
        await page.reload()
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 10000 })
      }

      // --- STEP 2: SCRAPE LINKS ---
      const companiesOnScreen = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href^="/companies/"]'))
        return (
          anchors
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
        )
      })

      const newCompanies = companiesOnScreen.filter((c) => !visitedCompanies.has(c))

      log(`Found ${newCompanies.length} new companies.`, page)

      if (newCompanies.length === 0) {
        log('No new companies. Scrolling...', page)
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
        log(`Checking: ${companyUrl}`, page)

        // Navigate
        await page.goto(companyUrl)
        
        try {
            await page.waitForLoadState('domcontentloaded')
            await page.waitForTimeout(1500) 
        } catch(e) {
            log('Timeout loading company, skipping.', page)
            continue
        }

        // FIND ENGINEERING JOBS
        // Sometimes jobs are 'a' tags with href containing /jobs/
        const jobLinks = await page.locator('a[href*="/jobs/"]').all()
        
        if (jobLinks.length > 0) {
          log(`Found ${jobLinks.length} jobs.`, page)

          for (const jobLink of jobLinks) {
            if (!automationRunning) break
            const jobTitle = await jobLink.innerText()

            if (jobTitle.match(/Software|Engineer|Developer|Backend|Frontend|Full Stack/i)) {
              
              const rawJobHref = await jobLink.getAttribute('href')
              
              if (rawJobHref) {
                const fullJobUrl = getFullUrl(rawJobHref)
                log(`>> Role: ${jobTitle}`, page)

                // Navigate to Job
                await page.goto(fullJobUrl)
                await page.waitForTimeout(1500)

                try {
                  // CHECK: Already Applied?
                  const appliedBtn = page.getByText('Applied', { exact: true })
                  if ((await appliedBtn.count()) > 0) {
                    log('Already applied.', page)
                  } else {
                    // APPLY FLOW
                    const applyBtn = page.getByText('Apply', { exact: true }).first()
                    if (await applyBtn.isVisible()) {
                      await applyBtn.click()
                      await page.waitForTimeout(500)
                    }

                    const textArea = page.locator('textarea').first()
                    if (await textArea.isVisible()) {
                      const coverLetter = `Hi! I am a software engineer... (AI for ${jobTitle})`
                      await textArea.pressSequentially(coverLetter, { delay: 50 })
                      log('Filled application.', page)
                      
                      // await page.getByRole('button', { name: 'Send Application' }).click()
                      // await page.waitForTimeout(1000)
                    }
                  }
                } catch (e: any) {
                  log(`Skipping job: ${e.message}`, page)
                }

                // Go back to Company Page
                await page.goBack()
                await page.waitForTimeout(1000)
              }
            }
          }
        }

        // --- STEP 4: RETURN TO LIST ---
        log('Returning to list...', page)
        await page.goBack()

        // Verify we actually made it back
        try {
            await page.waitForSelector('a[href^="/companies/"]', { timeout: 3000 })
        } catch (e) {
            log('List failed to render. Forcing reload...', page)
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
    } catch (e) {
        // Ignore disconnection errors
    }

  } catch (error: any) {
    console.error(error)
    mainWindow.webContents.send('log', `Error: ${error.message}`)
  }
})

ipcMain.on('stop-automation', () => {
  automationRunning = false
  mainWindow.webContents.send('log', 'Stopping automation...')
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lazymate')
  createWindow()
})