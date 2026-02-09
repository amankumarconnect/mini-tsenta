// src/main/index.ts
import { app, shell, BrowserWindow, ipcMain, BrowserView } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { chromium } from 'playwright-core'
// import OpenAI from 'openai' // Ensure you have this or use a generic fetch

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
    // Sidebar is roughly 400px or 40%, adjust as needed
    const sidebarWidth = 450
    view.setBounds({ x: sidebarWidth, y: 0, width: width - sidebarWidth, height: height })
  }

  // Hook resize events to keep the split view correct
  mainWindow.on('resize', updateBounds)
  updateBounds()

  // Load Wellfound initially or blank
  view.webContents.loadURL('https://www.workatastartup.com/companies')

  // ... standard electron-vite loading code ...
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- AUTOMATION LOGIC ---

// Helper: AI Generation (Mock or Real)
async function generateApplication(jobText: string, userProfile: string, apiKey: string) {
  // If you have an OpenAI key:
  /*
  const openai = new OpenAI({ apiKey })
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: `Write a short, casual cover letter application note for this job: ${jobText}. My details: ${userProfile}. Keep it under 50 words.` }],
    model: 'gpt-4o',
  })
  return completion.choices[0].message.content
  */

  // Mock return for testing
  return `Hi! I read your job description for ${jobText.slice(0, 20)}... and I think my skills in ${userProfile.slice(0, 20)}... are a great fit.`
}

// src/main/index.ts (Automation Section)

ipcMain.handle('start-automation', async (event, { userProfile, apiKey }) => {
  automationRunning = true
  mainWindow.webContents.send('log', 'Connecting to browser...')

  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    const defaultContext = browser.contexts()[0]

    // 1. Find the Main List Page
    // NEW (Robust)
    // We just want to make sure we are on the YC domain and have 'companies' in the URL.
    // We don't care about the extra parameters.
    let mainPage = defaultContext
      .pages()
      .find((p) => p.url().includes('workatastartup.com/companies'))

    if (!mainPage) {
      // Fallback: If the user is on the root domain, they might be on the list too
      mainPage = defaultContext.pages().find((p) => p.url().includes('workatastartup.com'))
    }

    if (!mainPage) throw new Error('Could not find YC tab. Please open workatastartup.com first!')
    if (!mainPage) throw new Error('Please navigate to workatastartup.com/companies first!')

    mainWindow.webContents.send('log', 'Found YC List. Starting loop...')

    while (automationRunning) {
      // --- STEP 1: SCAN FOR COMPANIES ---
      // We look for company blocks. In YC, they are usually <div>s with a specific layout.
      // A generic strategy for YC list: Look for the "View Company" links or the company name headers.
      // Based on your recording, we are looking for the company links.

      // We get all company links currently visible
      const companyLinks = mainPage.locator('a[href^="/companies/"]:not([href*="jobs"])')
      const count = await companyLinks.count()

      mainWindow.webContents.send('log', `Found ${count} companies on screen.`)

      for (let i = 0; i < count; i++) {
        if (!automationRunning) break

        // --- STEP 2: OPEN COMPANY PROFILE ---
        // We must click and WAIT for the new tab (popup)
        const [companyPage] = await Promise.all([
          defaultContext.waitForEvent('page'), // Wait for new tab
          companyLinks.nth(i).click({ modifiers: ['Meta'] }) // Ctrl/Cmd+Click forces new tab if not default
        ])

        await companyPage.waitForLoadState('domcontentloaded')
        mainWindow.webContents.send('log', `Checking company...`)

        // --- STEP 3: FIND JOBS IN COMPANY PROFILE ---
        // Your recording shows: Click "Senior Backend..." -> Opens Page 2
        // We accept "Engineering" or "Developer" roles. Adjust filter as needed.
        const jobLinks = companyPage.locator('a', {
          hasText: /Software|Engineer|Developer|Full Stack|Backend|Frontend/i
        })

        if ((await jobLinks.count()) > 0) {
          // Just take the first matching job for now to keep it simple
          const jobName = await jobLinks.first().innerText()
          mainWindow.webContents.send('log', `Found job: ${jobName}`)

          // Click Job and Wait for Application Page (Page 2)
          // Note: Sometimes YC opens a modal, sometimes a new tab. Your script says new tab.
          // We use a try/catch because sometimes it might stay on the same page.
          try {
            const [applicationPage] = await Promise.all([
              defaultContext.waitForEvent('page', { timeout: 5000 }),
              jobLinks.first().click()
            ])

            await applicationPage.waitForLoadState('domcontentloaded')

            // --- STEP 4: APPLY ---
            // We are now on the application page.
            // 1. Click "Apply to..." button if it exists (sometimes it's direct)
            const applyBtn = applicationPage.getByText('Apply', { exact: true }).first()
            if (await applyBtn.isVisible()) {
              await applyBtn.click()
            }

            // 2. Fill the Textbox
            // Your recording used: getByRole('textbox', { name: 'Hi! My name...' })
            // This is risky because the placeholder changes.
            // BETTER SELECTOR: The main textarea usually has a specific type or is the only textarea.
            const noteInput = applicationPage.locator('textarea')

            if (await noteInput.isVisible()) {
              // Generate AI Text
              const jobDesc = await applicationPage.locator('body').innerText() // Simple grab of all text
              const coverLetter = await generateApplication(jobDesc, userProfile, apiKey)

              await noteInput.fill(coverLetter)
              mainWindow.webContents.send('log', `Wrote application for ${jobName}`)

              // 3. SUBMIT (Uncomment when ready)
              // await applicationPage.getByRole('button', { name: 'Send Application' }).click()
              mainWindow.webContents.send('log', `(Mock) Sent application!`)

              await applicationPage.waitForTimeout(1000)
            }

            // Close the Job Page
            await applicationPage.close()
          } catch (err) {
            // If no new page opened, maybe it was a modal or external link
            mainWindow.webContents.send(
              'log',
              `Could not open application page: ${err instanceof Error ? err.message : String(err)}`
            )
          }
        } else {
          mainWindow.webContents.send('log', `No matching engineering jobs found here.`)
        }

        // Close the Company Page to clean up
        await companyPage.close()

        // Small pause between companies
        await mainPage.waitForTimeout(1000)
      }

      // --- STEP 5: SCROLL FOR MORE ---
      mainWindow.webContents.send('log', 'Scrolling for more companies...')
      await mainPage.mouse.wheel(0, 3000) // Scroll down heavily
      await mainPage.waitForTimeout(3000) // Wait for lazy load
    }

    browser.close()
  } catch (error) {
    console.error(error)
    mainWindow.webContents.send(
      'log',
      `Error: ${error instanceof Error ? error.message : String(error)}`
    )
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
