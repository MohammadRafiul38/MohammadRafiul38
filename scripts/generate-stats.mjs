import fs from 'node:fs/promises';
import path from 'node:path';

const OWNER = 'MohammadRafiul38';
const OUT = path.resolve('assets');
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) throw new Error('GITHUB_TOKEN is required');

const colors = {
  bg: '#0d1117',
  card: '#0d1117',
  border: '#263246',
  text: '#c9d1d9',
  muted: '#7f8ea3',
  blue: '#7aa2f7',
  pink: '#ff7ab2',
  purple: '#c05acb',
  track: '#161f2d'
};

const langColors = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
  Python: '#3572A5', React: '#61dafb', Kotlin: '#A97BFF', Java: '#b07219', C: '#555555',
  'C++': '#f34b7d', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584', PHP: '#4F5D95',
  Shell: '#89e051', Dart: '#00B4AB', Ruby: '#701516', Swift: '#F05138', Vue: '#41b883'
};

function esc(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
function fmt(n) {
  return Intl.NumberFormat('en', { notation: n >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
}
async function gql(query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${TOKEN}`, 'content-type': 'application/json', 'user-agent': 'MohammadRafiul38-profile-readme' },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) throw new Error(`GitHub GraphQL HTTP ${r.status}`);
  const data = await r.json();
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '));
  return data.data;
}

const now = new Date();
const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
const query = `query($login:String!, $from:DateTime!, $to:DateTime!) {
  user(login:$login) {
    repositories(first:100, ownerAffiliations:OWNER, privacy:PUBLIC) {
      totalCount
      nodes { name isFork isArchived stargazerCount forkCount }
    }
    followers { totalCount }
    following { totalCount }
    contributionsCollection(from:$from, to:$to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

const data = await gql(query, { login: OWNER, from: from.toISOString(), to: now.toISOString() });
const user = data.user;
const repos = user.repositories.nodes.filter(r => !r.isFork);
const stars = repos.reduce((a,r) => a + r.stargazerCount, 0);
const c = user.contributionsCollection;

// Language byte totals across owned non-fork repositories.
const languageTotals = {};
for (const repo of repos) {
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${encodeURIComponent(repo.name)}/languages`, {
      headers: { authorization: `bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'MohammadRafiul38-profile-readme' }
    });
    if (!r.ok) continue;
    const langs = await r.json();
    for (const [lang, bytes] of Object.entries(langs)) languageTotals[lang] = (languageTotals[lang] ?? 0) + bytes;
  } catch {}
}

const topLangs = Object.entries(languageTotals)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 6);
const totalLangBytes = topLangs.reduce((a,[,b]) => a+b, 0) || 1;

const statsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" role="img">
<rect x="1" y="1" width="758" height="298" rx="16" fill="${colors.card}" stroke="${colors.border}"/>
<text x="28" y="42" fill="${colors.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="18" font-weight="700">GitHub Statistics</text>
<text x="28" y="70" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="12">Last 12 months · generated from GitHub</text>
<line x1="28" y1="89" x2="500" y2="89" stroke="#202b3b"/>
${[['REPOSITORIES',repos.length,28,124],['STARS',stars,28,202],['COMMITS',c.totalCommitContributions,280,124],['PULL REQUESTS',c.totalPullRequestContributions,280,202]].map(([label,value,x,y]) => `<text x="${x}" y="${y}" fill="${label==='COMMITS'||label==='PULL REQUESTS'?colors.pink:colors.blue}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="14">${label}</text><text x="${x}" y="${y+34}" fill="${colors.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="24" font-weight="700">${esc(fmt(value))}</text>`).join('')}
<circle cx="640" cy="153" r="70" fill="none" stroke="#172131" stroke-width="12"/>
<circle cx="640" cy="153" r="70" fill="none" stroke="${colors.blue}" stroke-width="12" stroke-dasharray="185 255" transform="rotate(-90 640 153)"/>
<circle cx="640" cy="153" r="70" fill="none" stroke="${colors.pink}" stroke-width="12" stroke-dasharray="78 362" transform="rotate(30 640 153)"/>
<text x="640" y="149" text-anchor="middle" fill="${colors.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="24" font-weight="700">${esc(fmt(c.contributionCalendar.totalContributions))}</text>
<text x="640" y="173" text-anchor="middle" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">CONTRIBUTIONS</text>
</svg>`;

let y = 126;
const rows = topLangs.map(([lang,bytes],i) => {
  const pct = (bytes / totalLangBytes) * 100;
  const width = Math.max(8, pct * 4.9);
  const color = langColors[lang] ?? ['#7aa2f7','#c05acb','#ff7ab2','#56e39f'][i % 4];
  const row = `<circle cx="30" cy="${y-5}" r="5" fill="${color}"/><text x="46" y="${y}" fill="${colors.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="14">${esc(lang)}</text><text x="180" y="${y}" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="13">${pct.toFixed(1)}%</text><rect x="250" y="${y-12}" width="470" height="9" rx="4.5" fill="${colors.track}"/><rect x="250" y="${y-12}" width="${Math.min(470,width*4.4)}" height="9" rx="4.5" fill="${color}"/>`;
  y += 38;
  return row;
}).join('');
const languagesSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" role="img">
<rect x="1" y="1" width="758" height="298" rx="16" fill="${colors.card}" stroke="${colors.border}"/>
<text x="28" y="42" fill="${colors.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="18" font-weight="700">Top Languages</text>
<text x="28" y="70" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="12">Repository language bytes</text>
<line x1="28" y1="89" x2="732" y2="89" stroke="#202b3b"/>
${rows}
</svg>`;

const weeks = c.contributionCalendar.weeks.slice(-53);
const levelFill = { NONE:'#161f2d', FIRST_QUARTILE:'#14342f', SECOND_QUARTILE:'#1b644d', THIRD_QUARTILE:'#2aa56e', FOURTH_QUARTILE:'#56e39f' };
const cell=11, gap=3, x0=118, y0=80;
let rects='';
weeks.forEach((week, wi) => week.contributionDays.forEach((day, di) => {
  const x = x0 + wi*(cell+gap), yy = y0 + di*(cell+gap);
  rects += `<rect x="${x}" y="${yy}" width="${cell}" height="${cell}" rx="2" fill="${levelFill[day.contributionLevel] ?? levelFill.NONE}"/>`;
}));
const activitySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 240" role="img">
<rect x="1" y="1" width="1398" height="238" rx="16" fill="${colors.card}" stroke="${colors.border}"/>
<text x="28" y="42" fill="${colors.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="18" font-weight="700">GitHub Contribution Activity</text>
<text x="1368" y="42" text-anchor="end" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="12">Last 12 months</text>
<text x="28" y="96" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">Mon</text><text x="28" y="130" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">Wed</text><text x="28" y="164" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">Fri</text>
${rects}
<text x="1110" y="210" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="10">Less</text>
${Object.values(levelFill).map((col,i)=>`<rect x="${1150+i*22}" y="201" width="12" height="12" rx="2" fill="${col}"/>`).join('')}
<text x="1270" y="210" fill="${colors.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="10">More</text>
</svg>`;

await fs.writeFile(path.join(OUT,'stats.svg'), statsSvg);
await fs.writeFile(path.join(OUT,'languages.svg'), languagesSvg);
await fs.writeFile(path.join(OUT,'activity.svg'), activitySvg);
console.log(`Generated stats for ${OWNER}: ${repos.length} repos, ${stars} stars, ${c.totalCommitContributions} commits, ${topLangs.length} languages.`);
