import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { spawn } from 'child_process';

const ROOT = process.cwd();
const INBOX = path.join(ROOT, 'inbox');
const CONTENT = path.join(ROOT, 'content');

if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
if (!fs.existsSync(CONTENT)) fs.mkdirSync(CONTENT, { recursive: true });

const z = n => String(n).padStart(2,'0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
};
const slugify = s =>
  s.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0,80) || `post-${Date.now()}`;

function ensureFrontMatter(raw){
  if (/^---\s*[\r\n]/.test(raw)) return raw;
  const lines = raw.replace(/\r\n/g,'\n').split('\n');
  const title = (lines[0] || '제목 없음').trim();
  const body = lines.slice(1).join('\n').trim();
  const fm = [
    '---',
    `title: "${title.replace(/"/g,'\\"')}"`,
    `date: "${today()}"`,
    `tags: []`,
    `description: ""`,
    `slug: "${slugify(title)}"`,
    '---',
    '',
  ].join('\n');
  return fm + (body ? body + '\n' : '');
}

let building = false;
async function rebuild(){
  if (building) return;
  building = true;
  await new Promise((resolve) => {
    const p = spawn(process.execPath, ['tools/build.mjs'], { stdio: 'inherit' });
    p.on('exit', () => resolve());
  });
  building = false;
  console.log('✓ build 완료');
}

function consumeFile(fullpath){
  try{
    const raw = fs.readFileSync(fullpath, 'utf8');
    const withFM = ensureFrontMatter(raw);
    const m = withFM.match(/slug:\s*"(.*?)"/);
    const slug = m ? m[1] : slugify('post');
    const outName = `${today()}-${slug}.md`;
    const outPath = path.join(CONTENT, outName);
    fs.writeFileSync(outPath, withFM, 'utf8');
    console.log(`✓ inbox → content/${outName}`);

    const doneName = `_${Date.now()}_${path.basename(fullpath)}`;
    const donePath = path.join(path.dirname(fullpath), doneName);
    fs.renameSync(fullpath, donePath);
  }catch(e){
    console.error('✖ inbox 처리 실패:', e.message);
  }
}

console.log('👀 inbox 감시 시작:', INBOX);
const watcher = chokidar.watch(INBOX, {
  ignoreInitial: false,     // 시작 시 기존 파일도 처리하고 싶으면 false
  depth: 0,
  awaitWriteFinish: {       // 파일 저장 완료 기다림
    stabilityThreshold: 80, // 작게 잡아야 빠름
    pollInterval: 10
  },
  persistent: true
});

watcher
  .on('add', async (fp) => { consumeFile(fp); await rebuild(); })
  .on('change', async (fp) => { consumeFile(fp); await rebuild(); })
  .on('error', (e) => console.error('watch error:', e.message));
