// =====================================================================================
// FILE: src/main/index.ts
// PURPOSE: This is the MAIN PROCESS of the Electron app. Think of it as the "backend"
//          that runs on your computer (not in the browser). It creates the desktop window,
//          manages the embedded browser view that shows the WorkAtAStartup website, and
//          runs the entire job-application automation loop using Playwright.
//
// HOW ELECTRON WORKS (for beginners):
//   Electron apps have TWO parts:
//     1. MAIN PROCESS (this file) — runs Node.js, can access the filesystem, create windows, etc.
//     2. RENDERER PROCESS (the React UI) — runs in a Chromium browser window, like a webpage.
//   They communicate via IPC (Inter-Process Communication) using ipcMain / ipcRenderer.
//
// WHAT THIS FILE DOES:
//   - Creates the desktop window with a sidebar (React UI) + embedded browser (WorkAtAStartup)
//   - Listens for IPC commands from the React UI (start, stop, pause, resume, save resume, etc.)
//   - When "start" is triggered, connects to the embedded browser via Playwright (CDP protocol)
//     and automatically browses companies, checks job relevance using AI, and fills applications
// =====================================================================================

// Import core Electron modules:
// - app: controls the application lifecycle (when it starts, quits, etc.)
// - BrowserWindow: creates and manages desktop windows
// - ipcMain: listens for messages sent from the renderer process (React UI)
// - BrowserView: embeds a secondary web page inside the main window (used to show WorkAtAStartup)
// - dialog: shows native OS dialogs (e.g., "Save As" file picker)
import { app, BrowserWindow, ipcMain, BrowserView, dialog } from 'electron'

// 'join' is a utility from Node.js 'path' module that joins folder/file path segments safely
// Example: join('/users', 'documents', 'file.txt') → '/users/documents/file.txt'
import { join } from 'path'

// electron-toolkit utilities:
// - electronApp: helper to set app user model ID (used by Windows taskbar grouping)
// - is: tells you if the app is running in development mode (is.dev) or production
import { electronApp, is } from '@electron-toolkit/utils'

// Import the application icon image. The '?asset' suffix is a Vite/electron-vite convention
// that tells the bundler to treat this as a static asset and return its file path at runtime.
import icon from '../../resources/icon.png?asset'

// Playwright is a browser automation library (like Puppeteer or Selenium).
// - chromium: used to connect to a running Chromium/Electron browser instance via CDP
// - Page: TypeScript type representing a single browser tab/page
import { chromium, Page } from 'playwright-core'

// Import our custom AI functions from the ollama module (see ./ollama.ts for details):
// - isJobTitleRelevant: quickly checks if a job title matches the user's profile (embedding comparison)
// - isJobRelevant: deeper check — compares full job description to user's profile
// - generateApplication: uses an LLM to write a personalized cover letter
// - getEmbedding: converts text into a numerical vector (embedding) for semantic comparison
// - generateJobPersona: uses an LLM to create a hypothetical "ideal job" from the user's resume
import {
  isJobTitleRelevant,
  isJobRelevant,
  generateApplication,
  getEmbedding,
  generateJobPersona
} from './ollama'

// PDFParse is a library that extracts text content from PDF files.
// Used to read the user's uploaded resume PDF and convert it to plain text.
import { PDFParse } from 'pdf-parse'

// Node.js filesystem utilities:
// - writeFileSync: writes data to a file on disk (blocks until done)
// - readFileSync: reads a file from disk into memory (blocks until done)
// - existsSync: checks if a file exists at a given path (returns true/false)
import { writeFileSync, readFileSync, existsSync } from 'fs'

// =====================================================================================
// REMOTE DEBUGGING PORT CONFIGURATION
// =====================================================================================
// Electron uses Chromium under the hood. By enabling the Chrome DevTools Protocol (CDP)
// on port 9222, we allow Playwright to connect to the BrowserView's web page and automate
// it (click buttons, fill forms, navigate, etc.) — just like a human would, but programmatically.
// This command-line switch must be set BEFORE the app is ready.
// Playwright connects to Electron's own BrowserView via this CDP port
app.commandLine.appendSwitch('remote-debugging-port', '9222')

// =====================================================================================
// GLOBAL STATE VARIABLES
// =====================================================================================

// mainWindow: the main desktop window that contains both the React sidebar and the BrowserView
let mainWindow: BrowserWindow

// view: the embedded browser panel on the right side that shows the WorkAtAStartup website
let view: BrowserView

// automationRunning: a flag that controls whether the automation loop is active.
// Set to true when the user clicks "Start", set to false when they click "Stop".
let automationRunning = false

// isPaused: a flag that controls whether the automation is temporarily paused.
// When paused, the loop keeps running but waits (sleeps) until resumed.
let isPaused = false

// =====================================================================================
// USER DATA TYPES AND FILE PATHS
// =====================================================================================

// UserData defines the shape of the saved user profile object.
// - text: the raw text extracted from the user's resume PDF (used for generating cover letters)
// - embedding: a numerical vector representation of the user's "ideal job persona"
//              (used for cosine similarity matching against job titles and descriptions)
// - hasResume: a simple boolean flag indicating whether a resume has been uploaded
interface UserData {
  text: string
  embedding: number[]
  hasResume: boolean
}

// userDataPath: the file path where the user's profile data (text + embedding) is saved as JSON.
// app.getPath('userData') returns the OS-specific user data directory:
//   - Windows: C:\Users\<user>\AppData\Roaming\<appName>\
//   - macOS: ~/Library/Application Support/<appName>/
//   - Linux: ~/.config/<appName>/
const userDataPath = join(app.getPath('userData'), 'user-data.json')

// resumePath: the file path where the uploaded resume PDF is saved on disk.
// Stored alongside the user data in the same app data directory.
const resumePath = join(app.getPath('userData'), 'resume.pdf')

// userProfile: holds the loaded user profile in memory (or null if no profile exists yet).
// This is loaded from disk on startup and updated when the user uploads a new resume.
let userProfile: UserData | null = null

// =====================================================================================
// LOAD SAVED USER PROFILE ON STARTUP
// =====================================================================================
// When the app starts, try to load the previously saved user profile from disk.
// This way, the user doesn't have to re-upload their resume every time they open the app.
try {
  // Check if the user data file exists on disk before trying to read it
  if (existsSync(userDataPath)) {
    // Read the JSON file from disk and parse it into a JavaScript object (UserData type)
    userProfile = JSON.parse(readFileSync(userDataPath, 'utf-8'))
    // Log to the terminal (developer console) that loading was successful
    console.log('Loaded user profile from:', userDataPath)
  }
} catch (error) {
  // If anything goes wrong (file corrupted, JSON invalid, etc.), log the error
  // and continue with userProfile = null (the user will need to upload a resume again)
  console.error('Failed to load user data:', error)
}

// =====================================================================================
// FUNCTION: createWindow()
// PURPOSE: Creates the main application window with a split layout:
//          - Left side (450px): React UI control panel (shows logs, resume upload, start/stop buttons)
//          - Right side (remaining width): Live WorkAtAStartup website in a BrowserView
// =====================================================================================
function createWindow(): void {
  // Create the main Electron browser window with specific dimensions and options
  mainWindow = new BrowserWindow({
    width: 1200, // Initial window width in pixels
    height: 800, // Initial window height in pixels
    show: false, // Don't show the window immediately — wait until content is loaded (avoids white flash)
    autoHideMenuBar: true, // Hide the default menu bar (File, Edit, View, etc.) for a cleaner look
    icon, // Set the window icon to the imported icon.png file
    webPreferences: {
      // preload: path to the preload script that runs BEFORE the renderer (React) code.
      // The preload script sets up the secure bridge (contextBridge) between main and renderer.
      // __dirname is the directory of THIS file at runtime (after compilation).
      preload: join(__dirname, '../preload/index.js'),
      // sandbox: false allows the preload script to use Node.js APIs.
      // In sandboxed mode, preload scripts have limited capabilities.
      sandbox: false
    }
  })

  // Wait for the window content to be fully loaded, THEN show the window.
  // This prevents the user from seeing a blank white window while React is loading.
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Layout: left 450px = React control panel, right = live WorkAtAStartup browsing
  // Create a BrowserView — this is like an iframe but more powerful.
  // It embeds a completely separate web page (WorkAtAStartup) inside our Electron window.
  view = new BrowserView({
    webPreferences: {
      nodeIntegration: false, // Don't give the WorkAtAStartup website access to Node.js (security!)
      contextIsolation: true // Keep the website's JavaScript isolated from Electron's APIs (security!)
    }
  })
  // Attach the BrowserView to the main window so it appears inside it
  mainWindow.setBrowserView(view)

  // updateBounds: a helper function that recalculates and sets the BrowserView's position/size.
  // Called once initially, and again every time the user resizes the window.
  // This ensures the BrowserView always fills the right side of the window.
  const updateBounds = (): void => {
    // Get the current overall window dimensions (width and height in pixels)
    const { width, height } = mainWindow.getBounds()
    // The sidebar (React UI) takes up exactly 450 pixels on the left
    const sidebarWidth = 450
    // Position the BrowserView starting at x=450 (right after the sidebar),
    // and make it fill the remaining width and full height of the window
    view.setBounds({ x: sidebarWidth, y: 0, width: width - sidebarWidth, height: height })
  }

  // Re-layout the BrowserView whenever the window is resized by the user
  mainWindow.on('resize', updateBounds)
  // Also set the initial layout immediately when the window is first created
  updateBounds()

  // Load the WorkAtAStartup companies listing page into the BrowserView.
  // This is the page the automation will browse through to find jobs.
  view.webContents.loadURL('https://www.workatastartup.com/companies')

  // Load the React UI into the main window:
  // In DEVELOPMENT mode (is.dev is true), load from the Vite dev server URL for hot reload
  // In PRODUCTION mode, load the pre-built HTML file from disk
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// =====================================================================================
// FUNCTION: getFullUrl(partialUrl)
// PURPOSE: Converts a relative URL (e.g., "/companies/acme") into a full absolute URL
//          (e.g., "https://www.workatastartup.com/companies/acme").
//          If the URL already starts with "http", it's returned as-is (already absolute).
// PARAMETERS:
//   - partialUrl: a string that may be a relative path like "/companies/acme"
// RETURNS: a fully qualified URL string
// =====================================================================================
function getFullUrl(partialUrl: string): string {
  // If the URL already starts with "http" (i.e., it's already absolute), return it unchanged
  if (partialUrl.startsWith('http')) return partialUrl
  // Otherwise, prepend the WorkAtAStartup base domain to make it a full absolute URL
  return `https://www.workatastartup.com${partialUrl}`
}

// =====================================================================================
// FUNCTION: scrollAndHighlight(page, locator)
// PURPOSE: Smoothly scrolls the browser page so that a specific element is visible in the
//          center of the viewport. This makes the automation visually followable — the user
//          can watch in the BrowserView as the bot scrolls to each company/job link.
// PARAMETERS:
//   - page: the Playwright Page object (represents the active browser tab)
//   - locator: a Playwright Locator pointing to the target DOM element to scroll to
// RETURNS: a Promise that resolves once scrolling and the delay are complete
// =====================================================================================
async function scrollAndHighlight(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  // Run JavaScript inside the browser page to scroll the target element into view.
  // 'behavior: smooth' makes the scroll animation smooth instead of instant.
  // 'block: center' positions the element in the vertical center of the viewport.
  await locator.evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  // Wait 800ms to let the smooth scroll animation complete before continuing.
  // Without this delay, the next action might happen before the element is visible on screen.
  await page.waitForTimeout(800)
}

// =====================================================================================
// VISITED COMPANIES TRACKER
// =====================================================================================
// A Set (like a list with no duplicates) that keeps track of company URLs we've already
// visited during this session. This prevents the bot from re-visiting the same company
// page multiple times. Using a Set provides O(1) lookup time for checking membership.
const visitedCompanies = new Set<string>()

// =====================================================================================
// IPC HANDLER: 'start-automation'
// PURPOSE: This is the main automation handler. When the user clicks "Start Applying"
//          in the React UI, the renderer process sends a 'start-automation' IPC message,
//          and this handler runs the entire job-hunting automation loop.
//
// HIGH-LEVEL FLOW:
//   1. Connect to the embedded BrowserView via Playwright CDP
//   2. Loop: find companies on the list page → visit each company → check each job
//   3. For each job: check title relevance (AI) → check description relevance (AI) → generate & fill application
//   4. Continue until stopped by the user
//
// ipcMain.handle() is used (not .on()) because the renderer uses ipcRenderer.invoke()
// which expects a return value (Promise-based request/response pattern).
// =====================================================================================
ipcMain.handle('start-automation', async () => {
  // Guard: the user must have uploaded a resume before starting automation.
  // Without a resume, we can't generate embeddings or cover letters.
  if (!userProfile) {
    throw new Error('User profile not found. Please upload a resume first.')
  }
  // Set the automation flag to true — the while-loop below will keep running as long as this is true
  automationRunning = true

  // log(): a helper function that sends log messages from the main process to the React UI.
  // The React UI listens for 'log' events and displays them in the ActivityLog component.
  // PARAMETERS:
  //   - msg: the log message text to display in the UI
  //   - opts: optional metadata object with:
  //     - type: the category of the log ('info', 'success', 'error', 'skip', 'match') — affects styling
  //     - jobTitle: the job title associated with this log entry (if applicable)
  //     - matchScore: the AI similarity score (0-100) for display in the UI progress bar
  const log = (
    msg: string,
    opts?: {
      type?: 'info' | 'success' | 'error' | 'skip' | 'match'
      jobTitle?: string
      matchScore?: number
    }
  ): void => {
    // Send the log data to the renderer process via IPC.
    // mainWindow.webContents.send() pushes a message to the renderer's ipcRenderer.on('log') listener.
    mainWindow.webContents.send('log', {
      message: msg,
      type: opts?.type || 'info', // Default to 'info' type if none specified
      jobTitle: opts?.jobTitle, // Optional: the job title for contextual display
      matchScore: opts?.matchScore // Optional: the AI match score (0-100)
    })
  }

  // Notify the user that we're starting the connection process
  log('Connecting to browser...')

  try {
    // =====================================================================================
    // STEP 1: CONNECT TO THE BROWSERVIEW VIA PLAYWRIGHT CDP
    // =====================================================================================
    // Playwright connects to the Electron app's Chromium engine using Chrome DevTools Protocol.
    // Port 9222 was enabled at the top of this file with app.commandLine.appendSwitch().
    // This gives Playwright full programmatic control over the BrowserView's web page.
    const browser = await chromium.connectOverCDP('http://localhost:9222')

    // A browser has "contexts" which are like isolated browser profiles (separate cookies, storage).
    // The default context (index 0) is where our BrowserView's page lives.
    const contexts = browser.contexts()
    const defaultContext = contexts[0]

    // Find the specific page/tab that has the WorkAtAStartup website loaded.
    // There might be multiple pages open (main window + BrowserView), so we filter by URL.
    const page = defaultContext.pages().find((p) => p.url().includes('workatastartup.com'))
    // If no page is found with the WorkAtAStartup URL, throw an error
    if (!page) throw new Error('Please navigate to Work At A Startup first!')

    // Bring this page to the front (make it the active/focused tab) so the user can see the automation
    await page.bringToFront()
    // Let the user know the automation loop is starting
    log('Starting automation loop...')

    // =====================================================================================
    // STEP 2: MAIN AUTOMATION LOOP
    // =====================================================================================
    // This outer while-loop keeps the automation running until the user clicks "Stop".
    // Each iteration of this loop processes one batch of companies visible on the page.
    while (automationRunning) {
      // PAUSE CHECK: If the user clicked "Pause", enter a waiting loop.
      // Poll every 500ms until the user clicks "Resume" or "Stop".
      while (isPaused && automationRunning) {
        // Create a new Promise that resolves after 500ms — effectively a "sleep" function
        await new Promise((resolve) => setTimeout(resolve, 500))
        // If the user clicked "Stop" while we were paused, break out of the pause loop
        if (!automationRunning) break
      }
      // Double-check: if automation was stopped during the pause, exit the main loop too
      if (!automationRunning) break

      // Check if we're currently on the companies LIST page (not an individual company page).
      // The list page URL contains "/companies" but NOT "/companies/some-company-slug".
      const isListUrl = page.url().includes('/companies') && !page.url().includes('/companies/')

      // If we somehow navigated away from the list page, go back to it
      if (!isListUrl) {
        log('Not on list page. Navigating...')
        await page.goto('https://www.workatastartup.com/companies')
        // Wait 2 seconds for the page content to fully load (including JavaScript-rendered elements)
        await page.waitForTimeout(2000)
      }

      // Try to find company links on the page. If the page hasn't loaded yet,
      // wait up to 5 seconds for at least one company link (anchor tag) to appear.
      try {
        // CSS selector 'a[href^="/companies/"]' matches any <a> tag whose href starts with "/companies/"
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 5000 })
      } catch {
        // If no company links appeared within 5 seconds, the page might be empty or broken.
        // Reload the page and wait longer (10 seconds) for company links to appear.
        log('Page empty? Reloading list...')
        await page.reload()
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 10000 })
      }

      // =====================================================================================
      // STEP 3: EXTRACT COMPANY LINKS FROM THE CURRENT PAGE
      // =====================================================================================
      // Run JavaScript inside the browser page to collect all company links currently visible.
      // page.evaluate() executes the callback function in the BROWSER'S JavaScript context
      // (not Node.js), so we can access the DOM directly.
      const companiesOnScreen = await page.evaluate(() => {
        // Select all anchor (<a>) elements whose href attribute starts with "/companies/"
        const anchors = Array.from(document.querySelectorAll('a[href^="/companies/"]'))
        return (
          anchors
            // Extract the href attribute string from each anchor element
            .map((a) => a.getAttribute('href'))
            // Filter out unwanted links — we only want links TO company pages, not other types:
            .filter(
              (href): href is string =>
                href !== null && // Exclude null values (elements without an href)
                !href.includes('/jobs/') && // Exclude job-specific links (we want company-level links)
                !href.startsWith('http') && // Exclude absolute external URLs
                !href.includes('/website') && // Exclude links to company external websites
                !href.includes('/twitter') && // Exclude links to company Twitter profiles
                !href.includes('/linkedin') // Exclude links to company LinkedIn profiles
            )
            // Remove duplicate URLs — the same company may have multiple link elements on the page
            .filter((value, index, self) => self.indexOf(value) === index)
        )
      })

      // Filter out companies we've already visited in this session to avoid re-processing them.
      // visitedCompanies is a Set that stores all previously visited company URLs.
      const newCompanies = companiesOnScreen.filter((c) => !visitedCompanies.has(c))

      // Log how many new (unvisited) companies we found on the current page
      log(`Found ${newCompanies.length} new companies.`)

      // If we've already visited every company on screen, we need to scroll to load more
      // (the WorkAtAStartup site likely uses infinite scroll to load more companies)
      if (newCompanies.length === 0) {
        log('No new companies. Scrolling...')
        // Scroll down by 3000 pixels to trigger lazy-loading of more company entries
        await page.mouse.wheel(0, 3000)
        // Wait 3 seconds for new content to load after scrolling
        await page.waitForTimeout(3000)
        // 'continue' goes back to the top of the while loop to check for newly loaded companies
        continue
      }

      // =====================================================================================
      // STEP 4: VISIT EACH NEW COMPANY
      // =====================================================================================
      // Loop through each new company we haven't visited yet
      for (const relativeUrl of newCompanies) {
        // PAUSE CHECK: Same pause logic as the outer loop — allows the user to pause between companies
        while (isPaused && automationRunning) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        // If automation was stopped while paused, exit the company-processing loop
        if (!automationRunning) break

        // Mark this company as visited so we don't process it again in future loop iterations
        visitedCompanies.add(relativeUrl)

        // Build the full absolute URL for the company detail page
        const companyUrl = getFullUrl(relativeUrl)
        // Log which company we're about to check, showing just the slug (e.g., "acme-inc")
        log(`Checking company: ${relativeUrl.replace('/companies/', '')}`)

        // Find the company's link element on the page so we can scroll to it for visual feedback.
        // .first() gets the first matching element if there are multiple links to the same company.
        const companyLink = page.locator(`a[href="${relativeUrl}"]`).first()
        try {
          // Scroll to the company link so the user can see which company is being processed
          await scrollAndHighlight(page, companyLink)
        } catch {
          // Element may not be visible (e.g., removed from DOM by infinite scroll) — non-critical
        }
        // Save the current vertical scroll position on the list page.
        // We'll restore this exact position when we navigate BACK from the company's detail page.
        const listScrollY = await page.evaluate(() => window.scrollY)
        // Navigate to the company's detail page
        await page.goto(companyUrl)

        try {
          // Wait for the company page's HTML/DOM to finish loading
          await page.waitForLoadState('domcontentloaded')
          // Wait an additional 1.5 seconds for any JavaScript-rendered content to appear
          await page.waitForTimeout(1500)
        } catch {
          // If the page takes too long to load, skip this company and move to the next one
          log('Timeout loading company, skipping.', { type: 'skip' })
          continue
        }

        // =====================================================================================
        // STEP 5: FIND JOB POSTINGS ON THE COMPANY PAGE
        // =====================================================================================
        // Look for all anchor elements whose href contains "/jobs/" — these are individual job posting links.
        // .all() returns an array of all matching Locator elements.
        const jobLinks = await page.locator('a[href*="/jobs/"]').all()

        // Only process if the company actually has job listings on their page
        if (jobLinks.length > 0) {
          log(`Found ${jobLinks.length} job(s) at this company.`)

          // Loop through each job posting link found on the company page
          for (const jobLink of jobLinks) {
            // PAUSE CHECK: Allows the user to pause between individual job checks
            while (isPaused && automationRunning) {
              await new Promise((resolve) => setTimeout(resolve, 500))
            }
            // If automation was stopped while processing jobs, exit the job loop
            if (!automationRunning) break

            // Scroll to this specific job link so the user can see it in the BrowserView
            await scrollAndHighlight(page, jobLink)

            // Extract the visible text of the job link element (this is usually the job title)
            // .trim() removes any leading/trailing whitespace
            const jobTitle = (await jobLink.innerText()).trim()
            // Extract the href attribute (the relative or absolute URL to the job posting page)
            const rawJobHref = await jobLink.getAttribute('href')

            // Skip if the link doesn't have an href attribute (shouldn't happen, but defensive check)
            if (!rawJobHref) continue

            // Skip links that are clearly NOT real job titles:
            // - jobTitle.length < 5: too short to be a real job title (might be "See" or "View")
            // - The regex checks if the title starts with generic action words like "view", "apply",
            //   "see", "open" — these are navigation buttons, not actual job title text
            if (jobTitle.length < 5 || /^(view|apply|see|open)\s/i.test(jobTitle)) continue

            // =====================================================================================
            // STEP 6: AI-BASED JOB TITLE RELEVANCE CHECK (fast, embedding-based)
            // =====================================================================================
            // Before navigating to the full job page (which is slow and costs a page load),
            // do a quick check: compare the job title's embedding vector to the user's profile
            // embedding vector. This is a fast way to filter out obviously irrelevant jobs.
            log(`Checking title match...`, { jobTitle })
            // isJobTitleRelevant() computes cosine similarity between the title and user profile embeddings
            const titleResult = await isJobTitleRelevant(jobTitle, userProfile.embedding)
            // If the title similarity is below the threshold, skip this job entirely
            if (!titleResult.relevant) {
              log(`Title not relevant, skipping.`, {
                type: 'skip', // Show as "skipped" in the UI
                jobTitle,
                matchScore: titleResult.score // The similarity percentage (0-100)
              })
              continue // Move to the next job link
            }

            // The title looks promising — log it as a potential match with a green indicator
            log(`Title looks relevant!`, {
              type: 'match', // Show as "matched" in the UI (green styling)
              jobTitle,
              matchScore: titleResult.score
            })

            // Build the full URL for the individual job posting page
            const fullJobUrl = getFullUrl(rawJobHref)

            // Save the scroll position on the company page so we can restore it when we come back
            const companyScrollY = await page.evaluate(() => window.scrollY)

            // Navigate instead of clicking — links on this site open in new tabs
            // By using page.goto(), we stay in the same tab which is easier to automate
            await page.goto(fullJobUrl)
            // Wait 1.5 seconds for the job page to fully render
            await page.waitForTimeout(1500)

            try {
              // =====================================================================================
              // STEP 7: CHECK IF WE'VE ALREADY APPLIED TO THIS JOB
              // =====================================================================================
              // Look for text "Applied" on the page — WorkAtAStartup shows this label when
              // a user has already submitted an application for this job.
              const appliedBtn = page.getByText('Applied', { exact: true })
              // .count() returns the number of matching elements (0 means not found)
              if ((await appliedBtn.count()) > 0) {
                // We already applied to this job in a previous session, skip it
                log('Already applied, skipping.', { type: 'skip', jobTitle })
              } else {
                // =====================================================================================
                // STEP 8: AI-BASED FULL JOB DESCRIPTION RELEVANCE CHECK (thorough, embedding-based)
                // =====================================================================================
                // Extract the full text content of the job page (description, requirements, etc.)
                // This runs JavaScript in the browser to grab the text from the page
                const jobDescriptionText = await page.evaluate(() => {
                  // Try to get text from the <main> element first (the primary content area);
                  // fall back to the entire <body> if <main> doesn't exist on this page
                  const content = document.querySelector('main') || document.body
                  // .innerText returns the visible text content (excludes hidden elements, scripts, etc.)
                  return content.innerText
                })

                log('AI analyzing job description...', { jobTitle })
                // Compare the full job description's embedding to the user's profile embedding.
                // This is a more thorough relevance check than the title-only check above,
                // because it considers the entire job description, qualifications, and requirements.
                const fitResult = await isJobRelevant(jobDescriptionText, userProfile.embedding)

                // If the job description doesn't match well enough, skip this job
                if (!fitResult.relevant) {
                  log('Not a good fit, skipping.', {
                    type: 'skip',
                    jobTitle,
                    matchScore: fitResult.score
                  })
                } else {
                  // =====================================================================================
                  // STEP 9: GENERATE AND FILL THE APPLICATION
                  // =====================================================================================
                  // The job is a good match! Log it as a success and proceed to fill the application.
                  log('Good fit! Generating application...', {
                    type: 'success',
                    jobTitle,
                    matchScore: fitResult.score
                  })

                  // Look for an "Apply" button on the job page and click it to open the application form.
                  // getByText('Apply', { exact: true }) finds an element whose text is exactly "Apply".
                  // .first() gets the first match if there are multiple "Apply" buttons.
                  const applyBtn = page.getByText('Apply', { exact: true }).first()
                  // Only click if the Apply button is actually visible on the page
                  if (await applyBtn.isVisible()) {
                    // Scroll to the Apply button so the user can see it being clicked in the BrowserView
                    await scrollAndHighlight(page, applyBtn)
                    // Click the button to open/reveal the application form
                    await applyBtn.click()
                    // Wait 500ms for the application form to appear/animate in
                    await page.waitForTimeout(500)
                  }

                  // Look for a <textarea> element on the page — this is where the application text goes.
                  // .first() gets the first textarea if there are multiple on the page.
                  const textArea = page.locator('textarea').first()
                  // Only proceed if the textarea is visible (the form is open and ready)
                  if (await textArea.isVisible()) {
                    // Scroll to the textarea so the user can watch the cover letter being typed
                    await scrollAndHighlight(page, textArea)

                    // Use the LLM (Ollama) to generate a personalized cover letter
                    // based on the full job description and the user's resume text
                    const coverLetter = await generateApplication(
                      jobDescriptionText,
                      userProfile.text
                    )
                    // Log the length so the user knows the cover letter was generated
                    log(`Typing application (${coverLetter.length} chars)...`, { jobTitle })

                    // Type the cover letter into the textarea character by character.
                    // pressSequentially simulates individual keystrokes (like a human typing).
                    // - delay: 10 means 10 milliseconds between each keystroke
                    // - timeout: 60000 means abort if typing takes longer than 60 seconds
                    await textArea.pressSequentially(coverLetter, { delay: 10, timeout: 60000 })

                    // Submission disabled — remove this guard when ready to go live
                    // NOTE: The bot does NOT click the final "Submit" button — this is intentional
                    // for safety during testing. The application form is filled but not submitted.
                    log('Application filled! (Not submitted - testing mode)', {
                      type: 'success',
                      jobTitle
                    })
                  }
                }
              }
            } catch (e) {
              // If anything goes wrong while processing this specific job (e.g., page structure
              // changed, element not found, network error), log the error and continue to the next job.
              // Casting to Error type to safely access the .message property.
              log(`Error: ${(e as Error).message}`, { type: 'error', jobTitle })
            }

            // Navigate back from the job page to the company page using the browser's back button
            await page.goBack()
            // Wait 1 second for the company page to reload
            await page.waitForTimeout(1000)
            // Restore the scroll position on the company page to where we were before we left
            await page.evaluate((y) => window.scrollTo(0, y), companyScrollY)
          }
        }

        // =====================================================================================
        // STEP 10: RETURN TO THE COMPANY LIST
        // =====================================================================================
        // After processing all jobs at this company, navigate back to the companies list page
        log('Returning to list...')
        await page.goBack()

        try {
          // Wait for company links to appear on the list page (up to 3 seconds).
          // If they appear, restore the scroll position to where we were.
          await page.waitForSelector('a[href^="/companies/"]', { timeout: 3000 })
          // Restore the vertical scroll position on the list page to where it was before we left
          await page.evaluate((y) => window.scrollTo(0, y), listScrollY)
        } catch {
          // If the list page didn't render correctly (back-navigation can sometimes fail),
          // force a fresh navigation to the companies list page
          log('List failed to render. Forcing reload...')
          await page.goto('https://www.workatastartup.com/companies')
          // Wait for the page to fully load, including all network requests (images, API calls, etc.)
          await page.waitForLoadState('networkidle')
        }

        // Brief 1-second pause before processing the next company to avoid overwhelming the server
        await page.waitForTimeout(1000)
      }
    }

    // =====================================================================================
    // AUTOMATION FINISHED
    // =====================================================================================
    // The while loop ended — either the user clicked "Stop" or something else set automationRunning = false
    log('Automation stopped.')
    try {
      // Disconnect Playwright from the browser's CDP connection.
      // This doesn't close the BrowserView — it just releases Playwright's control over it.
      await browser.close()
    } catch {
      // CDP disconnection errors are expected — when the browser context or tab is already
      // closed, Playwright throws an error. This is normal and can be safely ignored.
    }
  } catch (error) {
    // If a critical error occurs anywhere in the automation (e.g., can't connect to CDP,
    // WorkAtAStartup page not found, unrecoverable error), log it to the developer console
    // and send it to the React UI so the user can see what went wrong
    console.error(error)
    mainWindow.webContents.send('log', {
      message: (error as Error).message,
      type: 'error'
    })
  }
})

// =====================================================================================
// IPC HANDLER: 'stop-automation'
// PURPOSE: Stops the automation loop and quits the entire application.
//          Called when the user clicks the "Stop" button in the React UI.
//          Uses ipcMain.on() (not .handle()) because it's a one-way "fire and forget"
//          message — the renderer doesn't need a return value.
// =====================================================================================
ipcMain.on('stop-automation', () => {
  // Set both flags to false to break out of ALL the automation while-loops
  automationRunning = false
  isPaused = false
  // Notify the React UI that we're shutting down
  mainWindow.webContents.send('log', {
    message: 'Stopping automation and closing app...',
    type: 'info'
  })
  // Wait 1 second (to let the log message arrive at the UI), then quit the entire Electron app
  setTimeout(() => {
    app.quit()
  }, 1000)
})

// =====================================================================================
// IPC HANDLER: 'pause-automation'
// PURPOSE: Pauses the automation loop without stopping it completely.
//          The automation will resume from exactly where it left off when "resume" is called.
//          Called when the user clicks the "Pause" button in the React UI.
// =====================================================================================
ipcMain.on('pause-automation', () => {
  // Only pause if automation is currently running (can't pause if it's not running)
  if (automationRunning) {
    // Set the pause flag — the while-loops in the automation handler check this flag
    // and enter a waiting state when isPaused is true
    isPaused = true
    // Notify the React UI that the automation is now paused
    mainWindow.webContents.send('log', {
      message: 'Automation PAUSED. Click "Continue" to resume.',
      type: 'info'
    })
  }
})

// =====================================================================================
// IPC HANDLER: 'resume-automation'
// PURPOSE: Resumes a previously paused automation loop. The automation continues
//          processing from exactly where it was paused.
//          Called when the user clicks the "Continue" button in the React UI.
// =====================================================================================
ipcMain.on('resume-automation', () => {
  // Only resume if automation is running AND currently paused (both conditions must be true)
  if (automationRunning && isPaused) {
    // Clear the pause flag — the waiting while-loops will detect this and continue processing
    isPaused = false
    // Notify the React UI that the automation has been resumed
    mainWindow.webContents.send('log', {
      message: 'Automation RESUMED.',
      type: 'info'
    })
  }
})

// =====================================================================================
// IPC HANDLER: 'save-resume'
// PURPOSE: Handles resume PDF upload from the React UI.
//          Processing pipeline: PDF file bytes → save PDF to disk → extract text from PDF
//          → LLM generates a "target job persona" from the text → convert persona to embedding
//          vector → save the text + embedding to disk as JSON
// PARAMETERS:
//   - _event: the IPC event object (unused, hence the underscore prefix convention)
//   - buffer: ArrayBuffer containing the raw bytes of the uploaded PDF file
// RETURNS: true on success, throws an Error on failure
// =====================================================================================
// Pipeline: PDF → text → LLM generates a "target job persona" → embedding for matching
ipcMain.handle('save-resume', async (_event, buffer: ArrayBuffer) => {
  try {
    // Save the raw PDF file to disk so the user can download it later.
    // Buffer.from(buffer) converts the ArrayBuffer to a Node.js Buffer for file writing.
    writeFileSync(resumePath, Buffer.from(buffer))

    // Parse the PDF to extract its text content.
    // PDFParse takes the raw PDF bytes and uses internal PDF parsing logic to extract readable text.
    const parser = new PDFParse({ data: Buffer.from(buffer) })
    // .getText() runs the extraction and returns an object containing the text
    const result = await parser.getText()
    // Clean up the parser resources (close file handles, free memory)
    await parser.destroy()
    // Get the extracted plain text string from the parse result
    const text = result.text

    // STEP 1: Generate a "Target Job Persona" from the resume text using an LLM.
    // WHY: Instead of embedding the raw resume (which contains noisy info like contact details,
    // dates, formatting artifacts), we ask an LLM to generate a hypothetical ideal job description.
    // This produces MUCH better semantic matches because we end up comparing
    // job-description-shaped text against actual job descriptions.
    console.log('Generating Target Job Persona from resume...')
    const persona = await generateJobPersona(text)
    console.log('Generated Persona:', persona)

    // STEP 2: Convert the persona text into a numerical embedding vector.
    // An embedding is an array of numbers (like [0.12, -0.34, 0.56, ...]) that captures
    // the semantic meaning of the text. Texts with similar meaning have similar embeddings.
    // This vector will be compared against job title/description embeddings using cosine similarity.
    console.log('Generating embedding from persona...')
    const embedding = await getEmbedding(persona)

    // text = original resume (for cover letters), embedding = from persona (for matching)
    // We save BOTH pieces: the original resume text (needed later to generate personalized
    // cover letters) and the persona-based embedding (needed to compare against job listings).
    userProfile = { text, embedding, hasResume: true }
    // Persist the user profile to disk as JSON so it survives app restarts.
    // JSON.stringify converts the JavaScript object to a JSON string for file storage.
    writeFileSync(userDataPath, JSON.stringify(userProfile))

    // Return true to indicate success — the React UI uses this to know the upload completed
    return true
  } catch (error) {
    // Log the error details to the developer console for debugging
    console.error('Error saving resume:', error)
    // Re-throw a new Error so the React UI's catch block can display an error message to the user
    throw new Error('Failed to save resume')
  }
})

// =====================================================================================
// IPC HANDLER: 'download-resume'
// PURPOSE: Allows the user to download their previously uploaded resume PDF file.
//          Opens a native OS "Save As" file dialog and copies the stored PDF to the
//          user's chosen location on their filesystem.
// =====================================================================================
ipcMain.handle('download-resume', async () => {
  // First check if a resume file actually exists on disk — if not, throw an error
  if (!existsSync(resumePath)) {
    throw new Error('No resume found to download')
  }

  // Show a native OS "Save As" dialog so the user can choose where to save the file.
  // dialog.showSaveDialog() returns an object with filePath (the chosen path, or undefined if cancelled)
  // - title: the text shown in the dialog's title bar
  // - defaultPath: the pre-filled filename suggestion
  // - filters: restricts the file type selector to show only PDF files
  const { filePath } = await dialog.showSaveDialog({
    title: 'Download Resume',
    defaultPath: 'resume.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  // If the user selected a save location (filePath is defined, i.e., they didn't click Cancel),
  // copy the resume from the app's internal data directory to the user's chosen location
  if (filePath) {
    // Read the PDF bytes from the stored location, then write them to the new destination
    writeFileSync(filePath, readFileSync(resumePath))
  }
})

// =====================================================================================
// IPC HANDLER: 'get-user-profile'
// PURPOSE: Returns the current user profile status to the React UI.
//          The React UI calls this on startup to check whether a resume has been uploaded,
//          so it can show either the "Upload Resume" view or the "Start Applying" view.
// RETURNS: An object with { hasResume: boolean } if a profile exists, or null if not.
//          Note: we intentionally don't return the full profile (with text/embedding) to
//          the renderer — only the boolean flag is needed for the UI.
// =====================================================================================
ipcMain.handle('get-user-profile', async () => {
  // If a user profile exists in memory, return just the hasResume flag
  // If no profile has been loaded/created, return null
  return userProfile ? { hasResume: userProfile.hasResume } : null
})

// =====================================================================================
// APP STARTUP — ENTRY POINT
// =====================================================================================
// app.whenReady() returns a Promise that resolves when Electron has finished its
// initialization process (creating the GPU process, setting up IPC channels, etc.).
// This is the application's entry point — once Electron is ready, we set up the app and create the window.
app.whenReady().then(() => {
  // Set the application's user model ID which is used by Windows to group windows in the taskbar.
  // This should match the ID defined in your app's build/package configuration.
  electronApp.setAppUserModelId('com.mini-tsenta')
  // Create the main application window with the split layout (React sidebar + BrowserView)
  createWindow()
})
