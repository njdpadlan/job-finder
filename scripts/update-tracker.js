const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const OUTPUT_PATH = path.resolve('output/job_tracker.xlsx');

const newJobs = [
  {
    dateFound: "2026-05-12",
    title: "Web Content Coordinator",
    company: "ECL Group of Companies",
    location: "Edmonton, AB",
    type: "Full-time",
    salary: "$50,000-$60,000/yr",
    score: 9,
    requiredSkills: "HTML, CSS, PHP, JavaScript, CMS, Google Analytics",
    skillGaps: "Google Analytics",
    url: "https://ca.indeed.com/viewjob?jk=700b437f6daddc9a"
  },
  {
    dateFound: "2026-05-12",
    title: "Junior Front-End Developer",
    company: "BlueDot",
    location: "Edmonton, AB (Remote-first)",
    type: "Full-time",
    salary: "$60,000-$100,000/yr",
    score: 9,
    requiredSkills: "TypeScript, React, CSS, accessibility (WCAG), 1-2 yrs",
    skillGaps: "TypeScript",
    url: "https://ca.linkedin.com/jobs/view/junior-front-end-developer-at-bluedot-4409437158"
  },
  {
    dateFound: "2026-05-12",
    title: "Frontend Developer",
    company: "YO IT Consulting",
    location: "Remote, Canada",
    type: "Part-time / Contract",
    salary: "Not listed",
    score: 9,
    requiredSkills: "JavaScript, TypeScript, React, responsive design",
    skillGaps: "TypeScript",
    url: "https://ca.linkedin.com/jobs/view/frontend-developer-remote-at-yo-it-consulting-4412420468"
  },
  {
    dateFound: "2026-05-12",
    title: "Website Designer",
    company: "Magnolias Consulting",
    location: "Edmonton, AB",
    type: "Full-time",
    salary: "Not listed",
    score: 9,
    requiredSkills: "HTML, CSS, WordPress, Adobe Suite, SEO, 2+ yrs",
    skillGaps: "Adobe Suite",
    url: "https://ca.indeed.com/viewjob?jk=e9e605cda40b6ce4"
  },
  {
    dateFound: "2026-05-12",
    title: "Web Programmer",
    company: "INNTECH FUTURE",
    location: "Beaumont, AB",
    type: "Full-time",
    salary: "$41/hr",
    score: 9,
    requiredSkills: "Web development, code writing/testing, <1 yr experience",
    skillGaps: "None specified",
    url: "https://ca.indeed.com/viewjob?jk=5a39708cdc330ef3"
  },
  {
    dateFound: "2026-05-12",
    title: "Front End Web Developer (TERM)",
    company: "KEEN Creative",
    location: "Edmonton, AB",
    type: "Contract (6 months)",
    salary: "Not listed",
    score: 9,
    requiredSkills: "HTML, CSS, JS, Sass, PHP, WordPress, React, Git, CMS",
    skillGaps: "AI automation tools (n8n, Zapier) - minor",
    url: "https://ca.indeed.com/viewjob?jk=4090d8320a86b4e1"
  },
  {
    dateFound: "2026-05-12",
    title: "Web Developer",
    company: "Har-Par Investments Ltd",
    location: "Edmonton, AB",
    type: "Full-time (32 hrs/week)",
    salary: "$40.70/hr",
    score: 8,
    requiredSkills: "HTML, CSS, JS, React, TypeScript, MySQL, ASP.NET, C#, Figma",
    skillGaps: "TypeScript, ASP.NET, C#",
    url: "https://ca.indeed.com/viewjob?jk=52253eaec9132863"
  },
  {
    dateFound: "2026-05-12",
    title: "Web Developer (React) - Remote",
    company: "Crossing Hurdles",
    location: "Remote, Canada",
    type: "Contract",
    salary: "$30-$100/hr",
    score: 8,
    requiredSkills: "React.js, JavaScript, REST APIs, responsive design",
    skillGaps: "None",
    url: "https://ca.linkedin.com/jobs/view/web-developer-react-remote-at-crossing-hurdles-4409264753"
  },
  {
    dateFound: "2026-05-12",
    title: "WordPress Developer",
    company: "CAYK Marketing",
    location: "Calgary, AB (in-person only)",
    type: "Full-time",
    salary: "$70,000-$75,000/yr",
    score: 8,
    requiredSkills: "PHP, HTML, CSS, JS, WordPress, Figma, responsive design",
    skillGaps: "Figma (minor); NOTE: Calgary in-person only",
    url: "https://ca.indeed.com/viewjob?jk=25ec225632fa80c1"
  },
  {
    dateFound: "2026-05-12",
    title: "Front-End Web Developer",
    company: "CODESK",
    location: "Edmonton, AB",
    type: "Full-time",
    salary: "$40.35/hr",
    score: 7,
    requiredSkills: "JavaScript, web frameworks, client-facing",
    skillGaps: "5+ years experience required",
    url: "https://ca.indeed.com/viewjob?jk=ec08d8ead7816ef5"
  }
];

const HEADERS = [
  'Date Found', 'Job Title', 'Company', 'Location', 'Type',
  'Salary', 'Confidence Score', 'Required Skills', 'Skill Gaps',
  'Application URL', 'Status', 'Notes'
];

const COL_WIDTHS = [12, 35, 22, 25, 20, 18, 10, 48, 30, 55, 14, 20];

// Colors
const COLOR_GRAY  = 'FFD9D9D9'; // Not Applied
const COLOR_GREEN = 'FFB6D7A8'; // Applied

(async () => {
  const workbook = new ExcelJS.Workbook();
  const existingUrls = new Set();
  let worksheet;

  if (fs.existsSync(OUTPUT_PATH)) {
    await workbook.xlsx.readFile(OUTPUT_PATH);
    worksheet = workbook.getWorksheet('Jobs');
    // Collect existing URLs from column 10 (Application URL)
    worksheet.eachRow((row, i) => {
      if (i > 1 && row.getCell(10).value) existingUrls.add(row.getCell(10).value);
    });
  } else {
    worksheet = workbook.addWorksheet('Jobs');

    // Header row
    const headerRow = worksheet.addRow(HEADERS);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B72B8' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 20;
  }

  // Column widths
  COL_WIDTHS.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  let added = 0;
  for (const job of newJobs) {
    if (existingUrls.has(job.url)) continue;

    const row = worksheet.addRow([
      job.dateFound,
      job.title,
      job.company,
      job.location,
      job.type,
      job.salary || 'Not listed',
      job.score + '/10',
      job.requiredSkills,
      job.skillGaps || 'None',
      job.url,
      'Not Applied',
      ''
    ]);

    // Wrap text for long columns
    [8, 9, 10].forEach(c => { row.getCell(c).alignment = { wrapText: true }; });

    // Color the Status cell
    applyStatusColor(row.getCell(11), 'Not Applied');

    // Dropdown validation on Status cell
    row.getCell(11).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Not Applied,Applied"'],
      showErrorMessage: true,
      errorTitle: 'Invalid',
      error: 'Please select Not Applied or Applied'
    };

    added++;
  }

  // Re-apply colors + dropdowns to ALL existing status cells (in case of re-run)
  worksheet.eachRow((row, i) => {
    if (i < 2) return;
    const statusCell = row.getCell(11);
    const val = statusCell.value;
    if (val === 'Not Applied' || val === 'Applied') applyStatusColor(statusCell, val);
    statusCell.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Not Applied,Applied"']
    };
  });

  await workbook.xlsx.writeFile(OUTPUT_PATH);
  console.log(`✅ Tracker updated — ${added} new job(s) added. File: ${OUTPUT_PATH}`);
})();

function applyStatusColor(cell, status) {
  const color = status === 'Applied' ? COLOR_GREEN : COLOR_GRAY;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.font = { bold: status === 'Applied' };
}
