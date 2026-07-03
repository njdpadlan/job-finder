/**
 * apply-job.js — Semi-automated job application via Playwright
 * Usage: node apply-job.js <jobUrl> <resumePath> <coverLetterPath> <portalType>
 *
 * Opens a visible browser, fills detectable fields, uploads resume/cover letter,
 * then hands control to the user to review and submit.
 *
 * Copy .env.example to .env and fill in your details before running.
 */

require('dotenv').config();

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const JOB_URL          = process.argv[2] || '';
const RESUME_PATH      = process.argv[3] ? path.resolve(process.argv[3]) : '';
const COVER_LETTER_PATH = process.argv[4] ? path.resolve(process.argv[4]) : '';
const PORTAL_TYPE      = (process.argv[5] || 'Generic').toLowerCase();

const EDGE_PROFILE_DIR = process.env.EDGE_PROFILE_DIR || '';

const CANDIDATE = {
  firstName:  process.env.CANDIDATE_FIRST_NAME  || '',
  lastName:   process.env.CANDIDATE_LAST_NAME   || '',
  fullName:   process.env.CANDIDATE_FULL_NAME   || '',
  email:      process.env.CANDIDATE_EMAIL       || '',
  phone:      process.env.CANDIDATE_PHONE       || '',
  phoneRaw:   process.env.CANDIDATE_PHONE_RAW   || '',
  city:       process.env.CANDIDATE_CITY        || '',
  province:   process.env.CANDIDATE_PROVINCE    || '',
  country:    process.env.CANDIDATE_COUNTRY     || '',
  postalCode: process.env.CANDIDATE_POSTAL_CODE || '',
  location:   process.env.CANDIDATE_LOCATION    || '',
  website:    process.env.CANDIDATE_WEBSITE     || '',
  linkedin:   process.env.CANDIDATE_LINKEDIN    || '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFill(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.count() > 0) {
      await el.fill(value);
      return true;
    }
  } catch (_) {}
  return false;
}

async function safeSelectOption(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.count() > 0) {
      await el.selectOption({ label: value }).catch(() =>
        el.selectOption({ value }).catch(() => {})
      );
      return true;
    }
  } catch (_) {}
  return false;
}

async function uploadFile(page, selector, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const el = page.locator(selector).first();
    if (await el.count() > 0) {
      await el.setInputFiles(filePath);
      console.log(`  📎 Uploaded: ${path.basename(filePath)}`);
      return true;
    }
  } catch (_) {}
  return false;
}

// ─── Generic field filling (works across most portals) ────────────────────────

async function fillCommonFields(page) {
  console.log('\n  Filling common fields...');

  const fieldMap = [
    // First / last name
    { selectors: ['input[name*="first" i]', 'input[id*="first" i]', 'input[placeholder*="first" i]'], value: CANDIDATE.firstName },
    { selectors: ['input[name*="last" i]', 'input[id*="last" i]', 'input[placeholder*="last" i]'], value: CANDIDATE.lastName },
    { selectors: ['input[name*="fullname" i]', 'input[name*="full_name" i]', 'input[id*="fullname" i]'], value: CANDIDATE.fullName },
    // Email
    { selectors: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]'], value: CANDIDATE.email },
    // Phone
    { selectors: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]', 'input[placeholder*="phone" i]'], value: CANDIDATE.phone },
    // Location
    { selectors: ['input[name*="city" i]', 'input[id*="city" i]', 'input[placeholder*="city" i]'], value: CANDIDATE.city },
    { selectors: ['input[name*="location" i]', 'input[id*="location" i]', 'input[placeholder*="location" i]'], value: CANDIDATE.location },
    { selectors: ['input[name*="postal" i]', 'input[name*="zip" i]', 'input[id*="postal" i]'], value: CANDIDATE.postalCode },
    // Website / portfolio
    { selectors: ['input[name*="website" i]', 'input[name*="portfolio" i]', 'input[id*="website" i]', 'input[placeholder*="website" i]', 'input[placeholder*="portfolio" i]'], value: CANDIDATE.website },
    // LinkedIn
    { selectors: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="linkedin" i]'], value: CANDIDATE.linkedin },
  ];

  for (const { selectors, value } of fieldMap) {
    if (!value) continue;
    for (const selector of selectors) {
      const filled = await safeFill(page, selector, value);
      if (filled) {
        console.log(`  ✅ Filled "${selector}" → "${value}"`);
        break;
      }
    }
  }
}

async function uploadDocuments(page) {
  console.log('\n  Uploading documents...');

  // Resume — try common file input patterns
  const resumeUploaded = await uploadFile(page, 'input[type="file"][name*="resume" i]', RESUME_PATH)
    || await uploadFile(page, 'input[type="file"][id*="resume" i]', RESUME_PATH)
    || await uploadFile(page, 'input[type="file"][accept*="pdf" i]', RESUME_PATH)
    || await uploadFile(page, 'input[type="file"]', RESUME_PATH);

  if (!resumeUploaded) console.log('  ⚠️  Could not find resume upload field — please upload manually.');

  // Cover letter (file upload)
  if (COVER_LETTER_PATH && fs.existsSync(COVER_LETTER_PATH)) {
    const clUploaded = await uploadFile(page, 'input[type="file"][name*="cover" i]', COVER_LETTER_PATH)
      || await uploadFile(page, 'input[type="file"][id*="cover" i]', COVER_LETTER_PATH);

    if (!clUploaded) {
      // Try text area instead
      const textarea = page.locator('textarea[name*="cover" i], textarea[id*="cover" i], textarea[placeholder*="cover" i]').first();
      if (await textarea.count() > 0) {
        const text = fs.readFileSync(COVER_LETTER_PATH.replace('.pdf', '.md'), 'utf-8').replace(/^---[\s\S]*?---\n/, '').trim();
        await textarea.fill(text);
        console.log('  ✅ Pasted cover letter text into textarea');
      }
    }
  }
}

// ─── Portal handlers ──────────────────────────────────────────────────────────

async function applyIndeed(page) {
  console.log('\n📋 Indeed Apply flow');
  await page.waitForLoadState('domcontentloaded');

  // Click Apply / Apply now button
  const applyBtn = page.locator('button:has-text("Apply now"), a:has-text("Apply now"), button:has-text("Apply"), span:has-text("Apply now")').first();
  if (await applyBtn.count() > 0) {
    console.log('  Clicking Apply Now...');
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  await fillCommonFields(page);
  await uploadDocuments(page);
}

async function applyLinkedIn(page) {
  console.log('\n🔗 LinkedIn Easy Apply flow');
  await page.waitForLoadState('domcontentloaded');

  // Click Easy Apply button
  const easyApply = page.locator('button:has-text("Easy Apply")').first();
  if (await easyApply.count() > 0) {
    console.log('  Clicking Easy Apply...');
    await easyApply.click();
    await page.waitForTimeout(2000);
  }

  await fillCommonFields(page);
  await uploadDocuments(page);

  // Handle multi-step: click Next until Review/Submit appears — then STOP
  let steps = 0;
  while (steps < 10) {
    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="Next" i]').first();
    const reviewBtn = page.locator('button:has-text("Review"), button:has-text("Submit application")').first();

    if (await reviewBtn.count() > 0) {
      console.log('\n  ⏸️  Reached final review step — stopping before Submit.');
      break;
    }
    if (await nextBtn.count() > 0) {
      console.log(`  → Clicking Next (step ${steps + 1})...`);
      await nextBtn.click();
      await page.waitForTimeout(1500);
      await fillCommonFields(page);
      await uploadDocuments(page);
      steps++;
    } else {
      break;
    }
  }
}

async function applyBambooHR(page) {
  console.log('\n🌿 BambooHR application form');
  await page.waitForLoadState('domcontentloaded');
  await fillCommonFields(page);
  await uploadDocuments(page);
}

async function applyGreenhouse(page) {
  console.log('\n🏢 Greenhouse application form');
  await page.waitForLoadState('domcontentloaded');
  await fillCommonFields(page);

  // Greenhouse-specific: first/last name fields
  await safeFill(page, '#first_name', CANDIDATE.firstName);
  await safeFill(page, '#last_name', CANDIDATE.lastName);
  await safeFill(page, '#email', CANDIDATE.email);
  await safeFill(page, '#phone', CANDIDATE.phone);

  // Resume upload
  await uploadFile(page, '#resume_input, input[id*="resume"]', RESUME_PATH)
    || await uploadFile(page, 'input[type="file"]', RESUME_PATH);

  // Cover letter upload
  if (COVER_LETTER_PATH) {
    await uploadFile(page, '#cover_letter_input, input[id*="cover"]', COVER_LETTER_PATH);
  }

  // Website/portfolio
  await safeFill(page, 'input[id*="website"]', CANDIDATE.website);
  await safeFill(page, 'input[id*="linkedin"]', CANDIDATE.linkedin);
}

async function applyLever(page) {
  console.log('\n⚙️ Lever application form');
  await page.waitForLoadState('domcontentloaded');

  await safeFill(page, 'input[name="name"]', CANDIDATE.fullName);
  await safeFill(page, 'input[name="email"]', CANDIDATE.email);
  await safeFill(page, 'input[name="phone"]', CANDIDATE.phone);
  await safeFill(page, 'input[name="urls[LinkedIn]"]', CANDIDATE.linkedin);
  await safeFill(page, 'input[name="urls[Portfolio]"]', CANDIDATE.website);

  await uploadFile(page, 'input[type="file"]', RESUME_PATH);
  if (COVER_LETTER_PATH) {
    const clInput = page.locator('input[type="file"]').nth(1);
    if (await clInput.count() > 0) await clInput.setInputFiles(COVER_LETTER_PATH);
  }
}

async function applyGeneric(page) {
  console.log('\n🌐 Generic application form (best-effort field detection)');
  await page.waitForLoadState('domcontentloaded');
  await fillCommonFields(page);
  await uploadDocuments(page);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  if (!JOB_URL) {
    console.error('❌ Usage: node apply-job.js <jobUrl> <resumePath> <coverLetterPath> <portalType>');
    process.exit(1);
  }

  console.log(`\n🚀 Starting application automation`);
  console.log(`   URL:    ${JOB_URL}`);
  console.log(`   Resume: ${RESUME_PATH}`);
  console.log(`   Portal: ${PORTAL_TYPE}`);

  // Use Edge profile for LinkedIn/Indeed (inherits login session)
  const useEdgeProfile = PORTAL_TYPE === 'linkedin' || PORTAL_TYPE === 'indeed';
  let browser, context, page;

  try {
    if (useEdgeProfile) {
      console.log('\n  Opening Edge with your existing profile (login session preserved)...');
      context = await chromium.launchPersistentContext(EDGE_PROFILE_DIR, {
        channel: 'msedge',
        headless: false,
        slowMo: 300,
        viewport: { width: 1280, height: 900 },
        args: ['--start-maximized'],
      });
      page = context.pages()[0] || await context.newPage();
    } else {
      browser = await chromium.launch({
        headless: false,
        slowMo: 300,
        args: ['--start-maximized'],
      });
      context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      page = await context.newPage();
    }

    console.log(`\n  Navigating to: ${JOB_URL}`);
    await page.goto(JOB_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Dispatch to portal handler
    switch (PORTAL_TYPE) {
      case 'linkedin':    await applyLinkedIn(page);  break;
      case 'indeed':      await applyIndeed(page);    break;
      case 'bamboohr':    await applyBambooHR(page);  break;
      case 'greenhouse':  await applyGreenhouse(page); break;
      case 'lever':       await applyLever(page);     break;
      default:            await applyGeneric(page);   break;
    }

    console.log('\n' + '─'.repeat(60));
    console.log('✅ FORM FILLING COMPLETE');
    console.log('─'.repeat(60));
    console.log('\nPlease review all fields in the browser window.');
    console.log('Answer any screening questions manually.');
    console.log('When you are satisfied, click SUBMIT in the browser.\n');
    console.log('Press Ctrl+C here when you are done.\n');

    // Keep alive until user presses Ctrl+C
    await new Promise(() => {});

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (err.message.includes('Target page, context or browser has been closed')) {
      console.log('  (Browser was closed by user — application process ended)');
    }
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
})();
