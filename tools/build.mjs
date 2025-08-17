// tools/build.mjs
// MD → HTML 변환기 + posts.json 생성기 (의존성 없음)

import fs from 'fs';
import path from 'path';
const ROOT = process.cwd();
const SRC = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'posts');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const FM_BOUND = /^---\s*$/m;

// 아주 가벼운 마크다운 → HTML
function mdToHtml(md){
  // 인라인 변환: **굵게**, *기울임*, `코드`
  const inline = (t)=>
    t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  // 블록 변환
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;

  const flushP = (buf)=>{
    if (!buf.length) return;
    const txt = buf.join('\n').trim();
    if (txt) html += `<p>${inline(txt)}</p>\n`;
    buf.length = 0;
  };

  let pbuf = [];
  for (let i=0;i<lines.length;i++){
    const line = lines[i];

    // 제목
    if (/^#{1,6}\s+/.test(line)){
      flushP(pbuf);
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      const level = m[1].length;
      const text = inline(m[2].trim());
      if (inList){ html += '</ul>\n'; inList=false; }
      if (level === 1 || level === 2){
        // 글 본문 목차용으로 h2/h3만 쓰자
        html += `<h2 class="sec"><span class="badge-num">•</span> ${text}</h2>\n`;
      } else {
        html += `<h3>${text}</h3>\n`;
      }
      continue;
    }

    // 인용문
    if (/^\s*>\s?/.test(line)){
      flushP(pbuf);
      const q = inline(line.replace(/^\s*>\s?/, ''));
      if (inList){ html += '</ul>\n'; inList=false; }
      html += `<blockquote>${q}</blockquote>\n`;
      continue;
    }

    // 목록
    if (/^\s*[-*+]\s+/.test(line)){
      flushP(pbuf);
      if (!inList){ html += '<ul>\n'; inList = true; }
      const li = inline(line.replace(/^\s*[-*+]\s+/, ''));
      html += `<li>${li}</li>\n`;
      continue;
    } else {
      if (inList && line.trim()===''){ html += '</ul>\n'; inList=false; }
    }

    // 수평선
    if (/^---\s*$/.test(line)){
      flushP(pbuf);
      if (inList){ html += '</ul>\n'; inList=false; }
      html += '<hr />\n';
      continue;
    }

    // 빈 줄 → 문단 종료
    if (line.trim()===''){ flushP(pbuf); continue; }

    // 일반 문단
    pbuf.push(line);
  }
  flushP(pbuf);
  if (inList){ html += '</ul>\n'; inList=false; }

  return html.trim();
}

// Front Matter 파서 (YAML 최소치)
function parseFrontMatter(src){
  const txt = src.replace(/\r\n/g,'\n');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m){
    throw new Error('Front Matter가 없습니다. 맨 위에 --- 블록 필수.');
  }
  const fmRaw = m[1];
  const body = m[2];

  const meta = {};
  for (const line of fmRaw.split('\n')){
    if (!line.trim()) continue;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const k = kv[1];
    let v = kv[2].trim();

    // 배열
    if (v.startsWith('[') && v.endsWith(']')){
      try { meta[k] = JSON.parse(v.replace(/(\w+):/g,'"$1":')); continue; }
      catch { /* noop */ }
    }
    // 따옴표 문자열
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))){
      v = v.slice(1,-1);
    }
    meta[k] = v;
  }
  if (!meta.title) throw new Error('title 누락');
  if (!meta.date)  throw new Error('date 누락 (YYYY-MM-DD)');
  return { meta, body };
}

function slugify(s){
  return s.trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// 템플릿 래퍼
function wrapArticle(meta, bodyHtml){
  // h2.sec가 하나도 없으면 서문처럼 감싸기
  const ensured = /<h2\b/i.test(bodyHtml) ? bodyHtml :
    `<section id="s0"><h2 class="sec"><span class="badge-num">0</span> 서문</h2>\n<p class="lead">${bodyHtml}</p></section>`;

  return ensured;
}

function readAllMD(dir){
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.md'))
    .map(f => path.join(dir, f));
}

function main(){
  const files = readAllMD(SRC);
  if (!files.length){
    console.log('⚠️ content 폴더에 .md 파일이 없습니다.');
    return;
  }

  const catalog = [];

  for (const fp of files){
    const raw = fs.readFileSync(fp, 'utf8');
    let meta, mdBody;
    try{
      ({ meta, body: mdBody } = parseFrontMatter(raw));
    }catch(e){
      console.error(`✖ ${fp}: ${e.message}`);
      continue;
    }

    const slug = meta.slug && meta.slug.trim()
      ? meta.slug.trim()
      : (path.basename(fp).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/i,'') || slugify(meta.title));

    const html = mdToHtml(mdBody);
    const wrapped = wrapArticle(meta, html);

    const outfile = `${slug}.html`;
    const outpath = path.join(OUT, outfile);
    fs.writeFileSync(outpath, wrapped, 'utf8');

    catalog.push({
      title: meta.title,
      date: meta.date,
      tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? String(meta.tags).split(',').map(s=>s.trim()).filter(Boolean) : []),
      description: meta.description || '',
      slug,
      file: outfile,
      keywords: Array.isArray(meta.keywords) ? meta.keywords : []
    });

    console.log(`✓ ${path.basename(fp)} → posts/${outfile}`);
  }

  // 날짜 내림차순 정렬
  catalog.sort((a,b)=> new Date(b.date) - new Date(a.date));
  fs.writeFileSync(path.join(OUT, 'posts.json'), JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`✓ posts/posts.json 갱신 (${catalog.length}개)`);
}

main();
