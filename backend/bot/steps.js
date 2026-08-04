/**
 * bot/steps.js
 * Atomic Playwright step functions for the Midap checklist automation.
 * Each function is self-contained and emits structured log events.
 */

const { log } = require('./session');

const LOGIN_URL = 'https://valeurfabtx.midap.in/login_form.php';
const DASHBOARD_URL = 'https://valeurfabtx.midap.in/index.php';

/**
 * Wait a given number of milliseconds.
 */
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture screenshot from page and return as base64 PNG string.
 */
async function captureScreenshot(page) {
    try {
        const buf = await page.screenshot({ type: 'png', fullPage: false });
        return buf.toString('base64');
    } catch (_) {
        return null;
    }
}

/**
 * STEP 1: Navigate to login page and authenticate.
 * @param {object} session - The active session object (from session.js)
 * @param {string} username
 * @param {string} password
 */
async function stepLogin(session, username, password) {
    const { page, id } = session;

    log(id, 'info', `Navigating to login page...`);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);

    log(id, 'info', `Entering credentials for ${username}...`);

    // Fill username — the site uses text input with no special ID, use type="text" first
    const usernameInput = page.locator('input[type="text"], input[name*="user"], input[placeholder*="user" i]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(username);

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(password);

    // Click login button
    const loginBtn = page.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("LOGIN"), a:has-text("Login")'
    ).first();
    await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
    await loginBtn.click();

    log(id, 'info', `Login submitted. Waiting 10 seconds for dashboard to load...`);
    await sleep(10000);

    // Confirm we left the login page
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
        let errText = '';
        try {
            const bodyText = await page.innerText('body');
            if (bodyText.includes('No user found')) {
                errText = 'No user found! (Check username prefix, e.g. VFP508)';
            } else if (bodyText.includes('Invalid') || bodyText.includes('Incorrect')) {
                errText = 'Invalid password / credentials!';
            } else {
                const errLocator = page.locator('.alert, .error, [class*="error"], [class*="danger"], font[color*="red"], span[style*="red"]').first();
                if (await errLocator.isVisible({ timeout: 500 }).catch(() => false)) {
                    errText = await errLocator.innerText().catch(() => '');
                }
            }
        } catch (_) {}
        throw new Error(`Login failed — still on login page. ${errText || 'Check credentials.'}`);
    }

    log(id, 'success', `Logged in successfully. Dashboard loaded.`);
}

/**
 * STEP 2: Scroll to the checklist section and collect all pending COMPLETE buttons.
 * Returns an array of element handles for each visible COMPLETE button.
 */
async function stepScanTasks(session) {
    const { page, id } = session;

    log(id, 'info', `Scanning checklist for pending tasks...`);

    // Scroll down to load lazy content
    await page.evaluate(() => {
        const height = document.body ? document.body.scrollHeight : (document.documentElement ? document.documentElement.scrollHeight : 0);
        window.scrollTo(0, height);
    });
    await sleep(1500);

    // Wait for the COMPLETE buttons to appear
    const btnLocator = page.locator(
        'td form input[type="button"][value="Complete"], td .btn-success:has-text("COMPLETE"), td a:has-text("COMPLETE"), td button:has-text("COMPLETE")'
    );

    // Give them up to 15 seconds to appear
    try {
        await btnLocator.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (_) {
        // No tasks visible — might be all done
    }

    const rawCount = await btnLocator.count();
    const taskCount = Math.ceil(rawCount / 2);
    log(id, 'info', `Found ${taskCount} pending task${taskCount !== 1 ? 's' : ''} (${rawCount} elements detected).`);
    return { count: rawCount, taskCount, btnLocator };
}

/**
 * STEP 3: Complete a single task — click its COMPLETE button, handle new tab,
 * click the final submit button, wait for confirmation, close tab, return.
 */
async function stepCompleteTask(session, taskBtn, taskIndex) {
    const { page, id, context } = session;

    // Try to extract task code for logging
    let taskCode = `Task #${taskIndex}`;
    try {
        const row = taskBtn.locator('xpath=ancestor::tr').first();
        const rowText = await row.innerText({ timeout: 1000 }).catch(() => '');
        const match = rowText.match(/CHK[A-Z0-9]+/i);
        if (match) taskCode = match[0];
    } catch (_) {}

    log(id, 'info', `Opening ${taskCode}...`);

    // Intercept new tab
    const newPagePromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);

    await taskBtn.scrollIntoViewIfNeeded();
    await taskBtn.click();

    let taskPage = await newPagePromise;

    if (taskPage) {
        log(id, 'info', `${taskCode} opened in new tab. Waiting 5 seconds...`);
        await taskPage.waitForLoadState('domcontentloaded').catch(() => {});
        await sleep(5000);
    } else {
        // May have navigated in-page
        taskPage = page;
        log(id, 'info', `${taskCode} loaded in same tab. Waiting 5 seconds...`);
        await sleep(5000);
    }

    // Find the final COMPLETE / Submit button on the task detail page
    log(id, 'info', `Looking for final COMPLETE button on ${taskCode}...`);
    const submitBtn = taskPage.locator(
        'input[type="submit"][name="complete"], input[type="submit"][value="Complete" i], input[type="submit"].btn-primary, button[type="submit"].btn-primary, input[id*="submit" i]'
    ).last();

    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.click();

    log(id, 'info', `Submitted ${taskCode}. Waiting for confirmation...`);

    // Wait for success message
    try {
        const successMsg = taskPage.locator(
            'text="The task has been marked as completed.", :has-text("marked as completed")'
        ).first();
        await successMsg.waitFor({ state: 'visible', timeout: 8000 });
        log(id, 'success', `✓ ${taskCode} marked as completed!`);
    } catch (_) {
        log(id, 'warn', `${taskCode} submitted but no confirmation message detected.`);
    }

    // Close new tab or navigate back
    if (taskPage !== page) {
        await taskPage.close().catch(() => {});
        log(id, 'info', `Closed task tab. Back on dashboard.`);
    } else {
        await page.goBack().catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
}

/**
 * STEP 4: Click the refresh icon next to "CHECKLIST TASKS" heading.
 * Falls back to page.reload() if the button can't be found.
 */
async function stepRefreshDashboard(session) {
    const { page, id } = session;

    log(id, 'info', `Refreshing checklist dashboard...`);

    // The refresh icon has name="index_refresh_button" or is an img inside a link
    const refreshBtn = page.locator(
        'input[name="index_refresh_button"], button[onclick*="refresh"], a[onclick*="refresh"], img[src*="Refresh"]'
    ).first();

    const found = await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (found) {
        await refreshBtn.click();
    } else {
        // Fallback: reload the page
        log(id, 'warn', `Refresh button not found — reloading page...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
    }

    await sleep(3000);
    log(id, 'info', `Dashboard refreshed.`);
}

module.exports = {
    sleep,
    captureScreenshot,
    stepLogin,
    stepScanTasks,
    stepCompleteTask,
    stepRefreshDashboard,
};
