import fs from 'node:fs/promises';
import path from 'node:path';

const OWNER = process.env.GITHUB_OWNER || 'MohammadRafiul38';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = path.resolve('assets');

if (!TOKEN) throw new Error('GITHUB_TOKEN is required');

const C = {
  bg: '#0d1117',
  panel: '#11161d',
  border: '#242c37',
  text: '#e6edf3',
  muted: '#8b949e',
  blue: '#7aa2f7',
  purple: '#b388ff',
  pink: '#ff7ab2',
  red: '#ef6a8a',
  track: '#1a222c',
  grid0: '#161b22',
  grid1: '#30233b',
  grid2: '#5b3d70',
  grid3: '#8d5cab',
  grid4: '#c38bdc'
};

const FALLBACK_LANG_COLORS = ['#7aa2f7', '#b388ff', '#ff7ab2', '#ef6a8a', '#6fd6ff', '#9be37a'];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmt(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function compact(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function text(x, y, value, size, fill = C.text, weight = 400, anchor = 'start') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="${size}" font-weight="${weight}">${esc(value)}</text>`;
}

async function gql(query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MohammadRafiul38-profile-readme'
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`GitHub GraphQL HTTP ${response.status}: ${body?.message || 'request failed'}`);
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map(error => error.message).join('; '));
  }
  return body.data;
}

const now = new Date();
const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

const profileQuery = `
query($login: String!, $from: DateTime!, $to: DateTime!, $after: String) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(
      first: 100,
      after: $after,
      ownerAffiliations: OWNER,
      privacy: PUBLIC,
      isFork: false
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        stargazerCount
        isArchived
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges {
            size
            node { name color }
          }
        }
      }
    }
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
    }
  }
}`;

const yearCommitQuery = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
    }
  }
}`;

const repositories = [];
let after = null;
let firstPage;

while (true) {
  firstPage = await gql(profileQuery, {
    login: OWNER,
    from: from.toISOString(),
    to: now.toISOString(),
    after
  });

  const connection = firstPage.user.repositories;
  repositories.push(...connection.nodes.filter(Boolean));

  if (!connection.pageInfo.hasNextPage) break;
  after = connection.pageInfo.endCursor;
}

const user = firstPage.user;
const contributions = user.contributionsCollection;

// GitHub's profile contribution totals are time-window based.
// Sum the yearly contribution totals to get a genuine all-time commit count.
const accountYear = new Date(user.createdAt).getUTCFullYear();
const years = Array.from(
  { length: now.getUTCFullYear() - accountYear + 1 },
  (_, index) => accountYear + index
);
let allTimeCommits = 0;
let allTimePullRequests = 0;
let allTimeIssues = 0;

for (const year of years) {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
  const effectiveEnd = yearEnd > now ? now : yearEnd;

  const yearData = await gql(yearCommitQuery, {
    login: OWNER,
    from: yearStart.toISOString(),
    to: effectiveEnd.toISOString()
  });

  const yearContributions = yearData.user.contributionsCollection;
  allTimeCommits += yearContributions.totalCommitContributions;
  allTimePullRequests += yearContributions.totalPullRequestContributions;
  allTimeIssues += yearContributions.totalIssueContributions;
}
const publicRepos = repositories.length;
const stars = repositories.reduce((sum, repo) => sum + repo.stargazerCount, 0);

const languageTotals = new Map();
for (const repo of repositories) {
  for (const edge of repo.languages?.edges || []) {
    const name = edge.node.name;
    languageTotals.set(name, (languageTotals.get(name) || 0) + edge.size);
  }
}

const topLanguages = [...languageTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6);

const langTotal = topLanguages.reduce((sum, [, size]) => sum + size, 0) || 1;

const commonLanguageColors = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Python: '#3572A5',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Shell: '#89e051',
  Dart: '#00B4AB',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Vue: '#41b883'
};

const commonStats = [
  ['PUBLIC REPOS', compact(publicRepos), C.blue],
  ['STARS', compact(stars), C.purple],
  ['COMMITS · ALL TIME', compact(allTimeCommits), C.pink],
  ['FOLLOWERS', compact(user.followers.totalCount), C.red]
];

const statsSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="470" height="250" viewBox="0 0 470 250" role="img" aria-labelledby="title desc">
<title id="title">GitHub statistics for ${esc(OWNER)}</title>
<desc id="desc">All-time public repository, star, commit, and follower statistics generated from GitHub.</desc>
<rect x="1" y="1" width="468" height="248" rx="18" fill="${C.panel}" stroke="${C.border}"/>
${text(24, 32, 'GitHub Statistics', 16, C.text, 700)}
${text(24, 52, 'LIVE DATA · ALL TIME', 9, C.muted, 600)}
<line x1="26" y1="78" x2="444" y2="72" stroke="${C.border}"/>
${commonStats.map(([label, value, color], index) => {
  const positions = [[24, 110], [245, 110], [24, 170], [245, 170]][index];
  const [x, y] = positions;
  return `${text(x, y, label, 10, color, 700)}${text(x, y + 25, value, 25, C.text, 700)}`;
}).join('')}
${text(24, 232, `${fmt(allTimePullRequests)} pull requests · ${fmt(allTimeIssues)} issues`, 9, C.muted, 400)}
</svg>`;

const languagesRows = topLanguages.length
  ? topLanguages.map(([language, bytes], index) => {
      const percent = (bytes / langTotal) * 100;
      const color = commonLanguageColors[language] || FALLBACK_LANG_COLORS[index % FALLBACK_LANG_COLORS.length];
      return {
        language,
        percent,
        color
      };
    })
  : [{ language: 'No language data yet', percent: 0, color: C.muted }];

const languagesSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="470" height="250" viewBox="0 0 470 250" role="img" aria-labelledby="title desc">
<title id="title">Top languages for ${esc(OWNER)}</title>
<desc id="desc">Top languages calculated from language byte totals across public repositories.</desc>
<rect x="1" y="1" width="468" height="248" rx="18" fill="${C.panel}" stroke="${C.border}"/>
${text(24, 32, 'Top Languages', 16, C.text, 700)}
${text(24, 52, 'PUBLIC REPOSITORIES · BYTES', 9, C.muted, 600)}
<line x1="26" y1="78" x2="444" y2="72" stroke="${C.border}"/>
${languagesRows.map(({ language, percent, color }, index) => {
  const y = 92 + index * 24;
  const width = Math.max(0, Math.min(400, percent * 4.0));
  return `${text(24, y, language, 10, C.text, 600)}${text(130, y, `${percent.toFixed(1)}%`, 9, C.muted, 500)}<rect x="174" y="${y - 8}" width="270" height="7" rx="3.5" fill="${C.track}"/><rect x="174" y="${y - 8}" width="${Math.max(3, width * 0.675)}" height="7" rx="3.5" fill="${color}"/>`;
}).join('')}
</svg>`;

const weeks = contributions.contributionCalendar.weeks.slice(-53);
const levelColor = {
  NONE: C.grid0,
  FIRST_QUARTILE: C.grid1,
  SECOND_QUARTILE: C.grid2,
  THIRD_QUARTILE: C.grid3,
  FOURTH_QUARTILE: C.grid4
};

const cell = 10;
const gap = 3;
const gridX = 78;
const gridY = 78;
const headerMonths = [];
let lastMonth = '';
for (let wi = 0; wi < weeks.length; wi++) {
  const day = weeks[wi]?.contributionDays?.find(Boolean);
  if (!day) continue;
  const month = day.date.slice(0, 7);
  if (month !== lastMonth && wi > 0) {
    headerMonths.push({ wi, month });
    lastMonth = month;
  }
}

let cells = '';
weeks.forEach((week, wi) => {
  (week.contributionDays || []).forEach((day) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const weekday = date.getUTCDay();
    const x = gridX + wi * (cell + gap);
    const y = gridY + weekday * (cell + gap);
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${levelColor[day.contributionLevel] || C.grid0}"><title>${esc(day.date)}: ${fmt(day.contributionCount)} contributions</title></rect>`;
  });
});

const activitySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="980" height="218" viewBox="0 0 920 205" role="img" aria-labelledby="title desc">
<title id="title">GitHub contribution activity for ${esc(OWNER)}</title>
<desc id="desc">Real contribution calendar data from GitHub for the last 12 months.</desc>
<rect x="1" y="1" width="918" height="203" rx="18" fill="${C.panel}" stroke="${C.border}"/>
${text(24, 34, 'Contribution Activity', 16, C.text, 700)}
${text(896, 34, `${fmt(contributions.contributionCalendar.totalContributions)} contributions`, 10, C.muted, 600, 'end')}
${headerMonths.map(({ wi, month }) => text(gridX + wi * (cell + gap), 58, month.slice(0,4) === new Date().getUTCFullYear().toString() ? month.slice(5) : month, 9, C.muted, 500)).join('')}
${text(24, 96, 'Sun', 9, C.muted, 500)}
${text(24, 130, 'Tue', 9, C.muted, 500)}
${text(24, 164, 'Thu', 9, C.muted, 500)}
${cells}
${text(748, 194, 'Less', 9, C.muted, 500)}
${Object.values(levelColor).map((color, i) => `<rect x="778" y="185" width="10" height="10" rx="2" fill="${color}"/>`).join('')}
${text(898, 194, 'More', 9, C.muted, 500, 'end')}
</svg>`;


const overviewSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 310" role="img" aria-labelledby="title desc">
<title id="title">GitHub overview for ${esc(OWNER)}</title>
<desc id="desc">Live GitHub statistics and top programming languages for ${esc(OWNER)}.</desc>
<rect x="1" y="1" width="1118" height="308" rx="22" fill="${C.bg}" stroke="${C.border}"/>
<rect x="18" y="18" width="542" height="274" rx="18" fill="${C.panel}" stroke="${C.border}"/>
<rect x="578" y="18" width="524" height="274" rx="18" fill="${C.panel}" stroke="${C.border}"/>
${text(42, 54, 'GitHub Statistics', 18, C.text, 700)}
${text(42, 76, 'LIVE DATA · ALL TIME', 10, C.muted, 600)}
<line x1="42" y1="96" x2="536" y2="96" stroke="${C.border}"/>
${commonStats.map(([label, value, color], index) => {
  const positions = [[42, 140], [292, 140], [42, 212], [292, 212]][index];
  const [x, y] = positions;
  return `${text(x, y, label, 10, color, 700)}${text(x, y + 28, value, 29, C.text, 700)}`;
}).join('')}
${text(42, 270, `${fmt(allTimePullRequests)} pull requests · ${fmt(allTimeIssues)} issues`, 10, C.muted, 400)}
${text(602, 54, 'Top Languages', 18, C.text, 700)}
${text(602, 76, 'PUBLIC REPOSITORIES · BYTES', 10, C.muted, 600)}
<line x1="602" y1="96" x2="1076" y2="96" stroke="${C.border}"/>
${languagesRows.map(({ language, percent, color }, index) => {
  const y = 122 + index * 25;
  const width = Math.max(3, Math.min(292, percent * 2.92));
  return `${text(602, y, language, 11, C.text, 600)}${text(714, y, `${percent.toFixed(1)}%`, 10, C.muted, 500)}<rect x="786" y="${y - 9}" width="290" height="7" rx="3.5" fill="${C.track}"/><rect x="786" y="${y - 9}" width="${width}" height="7" rx="3.5" fill="${color}"/>`;
}).join('')}
</svg>`;

await fs.writeFile(path.join(OUT, 'overview.svg'), overviewSvg);
await fs.writeFile(path.join(OUT, 'activity.svg'), activitySvg);
await fs.writeFile(path.join(OUT, 'stats.svg'), statsSvg);
await fs.writeFile(path.join(OUT, 'languages.svg'), languagesSvg);
console.log(`Generated live profile cards for ${OWNER}: ${publicRepos} repositories, ${stars} stars, ${contributions.contributionCalendar.totalContributions} contributions.`);
