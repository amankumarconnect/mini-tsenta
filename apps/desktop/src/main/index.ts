import { app, BrowserWindow, ipcMain, BrowserView, dialog } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { chromium, Page } from "playwright-core";
// Local AI imports removed as logic has been moved to API
import { PDFParse } from "pdf-parse";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { api, setUserId } from "./api"; // Import API client and user ID setter.

// Playwright connects to Electron's own BrowserView via this CDP (Chrome DevTools Protocol) port.
// This allows the automation script to control the Electron window/view as if it were a browser tab.
app.commandLine.appendSwitch("remote-debugging-port", "9222");

let mainWindow: BrowserWindow; // Reference to the main application window.
let view: BrowserView; // Reference to the BrowserView that hosts the target website (WorkAtAStartup).
let automationRunning = false; // Flag to track if the automation loop is active.
let isPaused = false; // Flag to track if the automation is currently paused.

// Interface defining the user data stored locally.
interface UserData {
  text: string; // Raw text of the user's resume.
  embedding: number[]; // Vector embedding of the user's job persona.
  hasResume: boolean; // Boolean indicating if a resume is uploaded.
}

// Define paths for storing user data persistence.
const userDataPath = join(app.getPath("userData"), "user-data.json");
const resumePath = join(app.getPath("userData"), "resume.pdf");
let userProfile: UserData | null = null; // In-memory cache of the user profile.

// on module load, attempt to load existing user profile from disk.
try {
  if (existsSync(userDataPath)) {
    userProfile = JSON.parse(readFileSync(userDataPath, "utf-8"));
    console.log("Loaded user profile from:", userDataPath);
  }
} catch (error) {
  console.error("Failed to load user data:", error);
}

// Function to create the main application window.
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show immediately (wait for 'ready-to-show').
    autoHideMenuBar: true,
    icon, // App icon.
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"), // Load preload script.
      sandbox: false, // Disable sandbox for full Node.js access in preload.
    },
  });

  // Show window when content is ready to prevent flickering.
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  // Create a BrowserView for the automated browsing session.
  // Layout: left 450px = React control panel (Renderer), right = live WorkAtAStartup browsing (BrowserView).
  view = new BrowserView({
    webPreferences: {
      nodeIntegration: false, // Security: Disable Node integration in the external site.
      contextIsolation: true, // Security: Enable context isolation.
    },
  });
  mainWindow.setBrowserView(view); // Attach view to window.

  // Function to update the BrowserView bounds when the main window is resized.
  const updateBounds = (): void => {
    const { width, height } = mainWindow.getBounds();
    const sidebarWidth = 450; // Fixed width for the sidebar.
    view.setBounds({
      x: sidebarWidth, // Positioned to the right of the sidebar.
      y: 0,
      width: width - sidebarWidth, // Fill remaining width.
      height: height, // Fill full height.
    });
  };

  // Listen for resize events to adjust layout.
  mainWindow.on("resize", updateBounds);
  updateBounds(); // Initial layout.

  // Load the target website in the BrowserView.
  view.webContents.loadURL("https://www.workatastartup.com/companies");

  // Load the Renderer process (UI).
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]); // Load from dev server.
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html")); // Load from built files.
  }
}

// Helper to ensure URLs are absolute.
function getFullUrl(partialUrl: string): string {
  if (partialUrl.startsWith("http")) return partialUrl; // Already absolute.
  return `https://www.workatastartup.com${partialUrl}`; // Prepend base URL.
}

// Helper to scroll an element into view and highlight it (visual feedback).
async function scrollAndHighlight(
  page: Page,
  locator: ReturnType<Page["locator"]>,
): Promise<void> {
  await locator.evaluate((el) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" }); // Scroll to element.
  });
  await page.waitForTimeout(800); // Wait for scroll animation to settle.
}

// IPC Handler: Start the automation process.
ipcMain.handle("start-automation", async () => {
  if (!userProfile) {
    throw new Error("User profile not found. Please upload a resume first.");
  }
  automationRunning = true; // Set running flag.

  // Helper function to send logs to the Renderer process.
  const log = (
    msg: string,
    opts?: {
      type?: "info" | "success" | "error" | "skip" | "match";
      jobTitle?: string;
      matchScore?: number;
    },
  ): void => {
    console.log(
      `[AUTOMATION] ${msg} ${opts?.matchScore ? `(Score: ${opts.matchScore})` : ""}`,
    );
    // Send log event via IPC to the renderer window.
    mainWindow.webContents.send("log", {
      message: msg,
      type: opts?.type || "info",
      jobTitle: opts?.jobTitle,
      matchScore: opts?.matchScore,
    });
  };

  log("Connecting to browser...");

  try {
    // connect Playwright to the Electron process via the open CDP port.
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    const defaultContext = contexts[0]; // Get the main context.

    // Find the page in the BrowserView that matches the target URL.
    const page = defaultContext
      .pages()
      .find((p) => p.url().includes("workatastartup.com"));
    if (!page) throw new Error("Please navigate to Work At A Startup first!");

    await page.bringToFront(); // Ensure it's active.

    // Attempt to extract User ID from PostHog in localStorage.
    // This allows identifying the user session for the backend API.
    log("Checking for user session...");
    const userId = await page.evaluate(() => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes("_posthog")) {
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              if (parsed.$user_id) return parsed.$user_id as string;
            }
          }
        }
        return null;
      } catch {
        return null;
      }
    });

    if (userId) {
      log(`User identified: ${userId}`, { type: "success" });
      setUserId(userId); // Set the user ID in the API client.
    } else {
      log("Could not find User ID. Automation might fail or use shared data.", {
        type: "error",
      });
      // Optionally stop or proceed with warning. Currently proceeding.
    }

    log("Starting automation loop...");

    // Main automation loop.
    while (automationRunning) {
      // Check for pause state.
      while (isPaused && automationRunning) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Sleep while paused.
        if (!automationRunning) break; // Exit if stopped while paused.
      }
      if (!automationRunning) break; // Exit if stopped.

      // Check if current page is the companies list.
      const isListUrl =
        page.url().includes("/companies") &&
        !page.url().includes("/companies/");

      if (!isListUrl) {
        log("Not on list page. Navigating...");
        await page.goto("https://www.workatastartup.com/companies");
        await page.waitForTimeout(2000);
      }

      // Wait for company list items to load.
      try {
        await page.waitForSelector('a[href^="/companies/"]', { timeout: 5000 });
      } catch {
        log("Page empty? Reloading list...");
        await page.reload();
        await page.waitForSelector('a[href^="/companies/"]', {
          timeout: 10000,
        });
      }

      // Extract unique company links visible on screen.
      const companiesOnScreen = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll('a[href^="/companies/"]'),
        );
        return anchors
          .map((a) => a.getAttribute("href"))
          .filter(
            (href): href is string =>
              href !== null &&
              !href.includes("/jobs/") &&
              !href.startsWith("http") &&
              !href.includes("/website") &&
              !href.includes("/twitter") &&
              !href.includes("/linkedin"),
          )
          .filter((value, index, self) => self.indexOf(value) === index); // Deduplicate.
      });

      const newCompanies: string[] = [];
      // Filter out companies that have already been visited.
      for (const c of companiesOnScreen) {
        const fullUrl = getFullUrl(c);
        const exists = await api.checkCompanyExists(fullUrl);
        if (!exists) newCompanies.push(c);
      }

      log(`Found ${newCompanies.length} new companies.`);

      // If no new companies visible, scroll down to load more.
      if (newCompanies.length === 0) {
        log("No new companies. Scrolling...");
        await page.mouse.wheel(0, 3000); // Scroll down by 3000px.
        await page.waitForTimeout(3000); // Wait for lazy load.
        continue;
      }

      // Process each new company.
      for (const relativeUrl of newCompanies) {
        // Check pause state again inside loop.
        while (isPaused && automationRunning) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!automationRunning) break;

        const fullCompanyUrl = getFullUrl(relativeUrl);
        // Save company as 'visited' immediately to avoid re-processing on error.
        try {
          await api.createCompany({
            url: fullCompanyUrl,
            name: relativeUrl.replace("/companies/", ""),
            status: "visited",
          });
        } catch (e) {
          console.error("Failed to save company to DB:", e);
        }

        const companyUrl = getFullUrl(relativeUrl);
        log(`Checking company: ${relativeUrl.replace("/companies/", "")}`);

        // Highlight the company link before clicking.
        const companyLink = page.locator(`a[href="${relativeUrl}"]`).first();
        try {
          await scrollAndHighlight(page, companyLink);
        } catch {
          // Element may not be visible, simplify proceed.
        }
        const listScrollY = await page.evaluate(() => window.scrollY); // Remember scroll position.
        await page.goto(companyUrl); // Navigate to company detail page.

        try {
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(1500);
        } catch {
          log("Timeout loading company, skipping.", { type: "skip" });
          continue;
        }

        // Find all job links on the company page.
        const jobLinks = await page.locator('a[href*="/jobs/"]').all();

        if (jobLinks.length > 0) {
          log(`Found ${jobLinks.length} job(s) at this company.`);

          // Process each job.
          for (const jobLink of jobLinks) {
            while (isPaused && automationRunning) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            if (!automationRunning) break;

            await scrollAndHighlight(page, jobLink);

            const jobTitle = (await jobLink.innerText()).trim();
            const rawJobHref = await jobLink.getAttribute("href");

            if (!rawJobHref) continue;

            const fullJobUrl = getFullUrl(rawJobHref);

            // Helper to record a skipped job in the database for tracking.
            const recordSkippedJob = async (
              jobTitle: string,
              companyName: string,
              jobUrl: string,
              reason: string,
              matchScore?: number,
            ): Promise<void> => {
              try {
                // Check if it already exists to avoid unique constraint errors
                const exists = await api.checkApplicationExists(jobUrl);
                if (exists) return;

                await api.createApplication({
                  jobTitle,
                  companyName,
                  jobUrl,
                  coverLetter: reason,
                  status: "skipped", // Status is 'skipped'
                  matchScore,
                });
              } catch (e) {
                console.error(`Failed to record skipped job: ${jobTitle}`, e);
              }
            };

            // Basic filtering: skip short titles or action buttons labeled as titles.
            if (
              jobTitle.length < 5 ||
              /^(view|apply|see|open)\s/i.test(jobTitle)
            )
              continue;

            log(`Checking title match...`, { jobTitle });
            // Check title relevance using AI.
            const titleResult = await api.aiCheckJobRelevance(
              jobTitle,
              userProfile.embedding,
              "title",
            );
            if (!titleResult.relevant) {
              log(`Title not relevant, skipping.`, {
                type: "skip",
                jobTitle,
                matchScore: titleResult.score,
              });
              await recordSkippedJob(
                jobTitle,
                relativeUrl.replace("/companies/", ""),
                fullJobUrl,
                `Title mismatch (Score: ${titleResult.score})`,
                titleResult.score,
              );
              continue;
            }

            log(`Title looks relevant!`, {
              type: "match",
              jobTitle,
              matchScore: titleResult.score,
            });

            // const fullJobUrl = getFullUrl(rawJobHref) // Alrdy computed above

            const companyScrollY = await page.evaluate(() => window.scrollY); // Remember scroll.

            // Navigate to job detail page.
            // Navigate instead of clicking — links on this site often open in new tabs which complicates control.
            await page.goto(fullJobUrl);
            await page.waitForTimeout(1500);

            try {
              // Check if "Applied" button exists (meaning we already applied manually).
              const appliedBtn = page.getByText("Applied", { exact: true });
              if ((await appliedBtn.count()) > 0) {
                log("Already applied, skipping.", { type: "skip", jobTitle });
                // Logic to record already applied jobs is commented out below.
                /*
                await recordSkippedJob(
                  jobTitle,
                  relativeUrl.replace('/companies/', ''),
                  fullJobUrl,
                  'Already applied on website'
                )
                */
              } else {
                // Extract job description text.
                const jobDescriptionText = await page.evaluate(() => {
                  const content =
                    document.querySelector("main") || document.body;
                  return content.innerText;
                });

                log("AI analyzing job description...", { jobTitle });
                // Check description relevance using AI.
                const fitResult = await api.aiCheckJobRelevance(
                  jobDescriptionText,
                  userProfile.embedding,
                  "description",
                );

                if (!fitResult.relevant) {
                  log("Not a good fit, skipping.", {
                    type: "skip",
                    jobTitle,
                    matchScore: fitResult.score,
                  });
                  await recordSkippedJob(
                    jobTitle,
                    relativeUrl.replace("/companies/", ""),
                    fullJobUrl,
                    `Description mismatch (Score: ${fitResult.score})`,
                    fitResult.score,
                  );
                } else {
                  log("Good fit! Generating application...", {
                    type: "success",
                    jobTitle,
                    matchScore: fitResult.score,
                  });

                  // Job is a match. Try to find the 'Apply' button to open the form.
                  const applyBtn = page
                    .getByText("Apply", { exact: true })
                    .first();
                  if (await applyBtn.isVisible()) {
                    await scrollAndHighlight(page, applyBtn);
                    await applyBtn.click();
                    await page.waitForTimeout(500);
                  }

                  // Look for the textarea to paste the cover letter.
                  const textArea = page.locator("textarea").first();
                  if (await textArea.isVisible()) {
                    await scrollAndHighlight(page, textArea);

                    // Generate custom cover letter using AI.
                    const { coverLetter } = await api.aiGenerateApplication(
                      jobDescriptionText,
                      userProfile.text,
                    );
                    log(`Typing application (${coverLetter.length} chars)...`, {
                      jobTitle,
                    });

                    // Type the cover letter into the textarea.
                    await textArea.pressSequentially(coverLetter, {
                      delay: 10, // Human-like typing delay.
                      timeout: 60000,
                    });

                    // Save the successful application generation to DB.
                    try {
                      console.log("Attempting to save application:", {
                        jobTitle,
                        companyName: relativeUrl.replace("/companies/", ""),
                        jobUrl: fullJobUrl,
                        matchScore: fitResult.score,
                      });

                      const savedApp = await api.createApplication({
                        jobTitle,
                        companyName: relativeUrl.replace("/companies/", ""),
                        jobUrl: fullJobUrl,
                        coverLetter,
                        status: "submitted", // Marking as submitted (simulated).
                        matchScore: fitResult.score,
                      });
                      log("Application saved to database.", {
                        type: "success",
                        jobTitle,
                      });
                      console.log("Saved app ID:", savedApp.id);
                    } catch (e) {
                      console.error("Failed to save application:", e);
                      log(
                        `Failed to save application to DB: ${(e as Error).message}`,
                        {
                          type: "error",
                          jobTitle,
                        },
                      );
                    }

                    // Submission is intentionally disabled for safety in this demo.
                    // To enable, we would click the submit button here.
                    log("Application filled! (Not submitted - testing mode)", {
                      type: "success",
                      jobTitle,
                    });
                  }
                }
              }
            } catch (e) {
              log(`Error: ${(e as Error).message}`, {
                type: "error",
                jobTitle,
              });
            }

            await page.goBack(); // Go back to company page.
            await page.waitForTimeout(1000);
            await page.evaluate((y) => window.scrollTo(0, y), companyScrollY); // Restore scroll.
          }
        }

        log("Returning to list...");
        await page.goBack(); // Go back to companies list.

        // Restore list scroll position.
        try {
          await page.waitForSelector('a[href^="/companies/"]', {
            timeout: 3000,
          });
          await page.evaluate((y) => window.scrollTo(0, y), listScrollY);
        } catch {
          log("List failed to render. Forcing reload...");
          await page.goto("https://www.workatastartup.com/companies");
          await page.waitForLoadState("networkidle");
        }

        await page.waitForTimeout(1000);
      }
    }

    log("Automation stopped.");
    try {
      await browser.close(); // Close browser connection.
    } catch {
      // CDP disconnection errors are expected when shutting down.
    }
  } catch (error) {
    console.error(error);
    mainWindow.webContents.send("log", {
      message: (error as Error).message,
      type: "error",
    });
  }
});

// IPC Handler: Stop automation.
ipcMain.on("stop-automation", () => {
  automationRunning = false;
  isPaused = false;
  mainWindow.webContents.send("log", {
    message: "Stopping automation and closing app...",
    type: "info",
  });
  // Delay quit to allow UI to update.
  setTimeout(() => {
    app.quit();
  }, 1000);
});

// IPC Handler: Pause automation.
ipcMain.on("pause-automation", () => {
  if (automationRunning) {
    isPaused = true;
    mainWindow.webContents.send("log", {
      message: 'Automation PAUSED. Click "Continue" to resume.',
      type: "info",
    });
  }
});

// IPC Handler: Resume automation.
ipcMain.on("resume-automation", () => {
  if (automationRunning && isPaused) {
    isPaused = false;
    mainWindow.webContents.send("log", {
      message: "Automation RESUMED.",
      type: "info",
    });
  }
});

// IPC Handler: Process uploaded resume.
// Pipeline: PDF -> text -> AI (Generate Persona) -> AI (Embedding) -> Save.
ipcMain.handle("save-resume", async (_event, buffer: ArrayBuffer) => {
  try {
    writeFileSync(resumePath, Buffer.from(buffer)); // Save PDF to disk.

    // Parse PDF to text.
    const parser = new PDFParse({ data: Buffer.from(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text;

    console.log("Generating Target Job Persona from resume...");
    const { persona } = await api.aiGenerateJobPersona(text); // AI generates persona.
    console.log("Generated Persona:", persona);

    console.log("Generating embedding from persona...");
    const { embedding } = await api.aiGetEmbedding(persona); // Get embedding for persona.

    // Update user profile: uses original text for cover letters, but persona embedding for matching.
    userProfile = { text, embedding, hasResume: true };
    writeFileSync(userDataPath, JSON.stringify(userProfile)); // Save profile to disk.

    return true;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
});

// IPC Handler: Download existing resume.
ipcMain.handle("download-resume", async () => {
  if (!existsSync(resumePath)) {
    throw new Error("No resume found to download");
  }

  // Show save dialog to user.
  const { filePath } = await dialog.showSaveDialog({
    title: "Download Resume",
    defaultPath: "resume.pdf",
    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
  });

  if (filePath) {
    writeFileSync(filePath, readFileSync(resumePath)); // Copy file to user-selected path.
  }
});

// IPC Handler: Get current user profile status.
ipcMain.handle("get-user-profile", async () => {
  return userProfile ? { hasResume: userProfile.hasResume } : null;
});

// IPC Handler: Fetch application history.
ipcMain.handle("get-applications", async () => {
  try {
    return await api.getApplications();
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return [];
  }
});

// App ready event: Initialize app.
app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.mini-tsenta"); // Set App ID for notifications involved.
  createWindow(); // Create the main window.
});
