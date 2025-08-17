import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content');
if (!fs.existsSync(CONTENT)) fs.mkdirSync(CONTENT, { recursive: true });

const z = n => String(n).padStart(2,'0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; };
const slugify = s => s.trim().toLowerCase()
  .replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,80) || `post-${Date.now()}`;

const title = process.argv.slice(2).join(' ').trim();
if (!title){ console.error('사용법: node tools/newpost.mjs "제목"'); process.exit(1); }

const slug = slugify(title);
const fname = `${today()}-${slug}.md`;
const fpath = path.join(CONTENT, fname);

const md = `---
title: "${title.replace(/"/g,'\\"')}"
date: "${today()}"
tags: []
description: ""
slug: "${slug}"
---

# 서문
여기에 본문을 쓰면 됩니다.
`;

fs.writeFileSync(fpath, md, 'utf8');
console.log('✓ 새 글 생성:', `content/${fname}`);
