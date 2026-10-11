import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),css=read('css/cut-paste.css');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const tags=[...html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)];
const voids=new Set(['input','img','hr','br','source','meta','link','wbr']);
test('redesigned collage studio keeps all original actions and unique IDs',()=>{
  assert.equal(new Set(ids).size,ids.length,'duplicate HTML IDs');
  for(const id of ['artwork','canvas-panel','view-collage','view-cuts','view-layout','export','credits-button',
    'new-baseline','lock-layer','shuffle-images','cut-mode','cut-style','cut-seed','layout-seed',
    'layer-list','layout-guide-name','layout-guide-meta','find-subjects','pick-subject',
    'search-form','query','provider','upload-input','pool','save-project','open-project'])
    assert.ok(ids.includes(id),'Missing action '+id);
  assert.match(html,/id="workbench"/);
  assert.match(html,/class="jump-to-desk" href="#workbench"/);
  assert.equal((html.match(/id="new-baseline"/g)||[]).length,1);
  assert.equal((html.match(/id="lock-layer"/g)||[]).length,1);
});
test('collage markup is balanced and its labels resolve',()=>{
  const stack=[];
  for(const m of tags){
    const t=m[1].toLowerCase(),token=m[0];
    if(voids.has(t)||token.endsWith('/>'))continue;
    if(token.startsWith('</'))assert.equal(stack.pop(),t,'Misnested HTML closing tag '+token);
    else stack.push(t);
  }
  assert.deepEqual(stack,[],'Unclosed HTML tags');
  for(const match of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g))
    assert.ok(ids.includes(match[1]),'Unresolved label target '+match[1]);
});
test('local paper assets exist and CSS offers keyboard and small-screen styling',()=>{
  assert.match(html,/<link rel="stylesheet" href="css\/cut-paste.css">/);
  assert.ok(existsSync(new URL('../css/paper-noise.svg',import.meta.url)));
  assert.match(css,/paper-noise\.svg/);
  assert.match(css,/:focus-visible/);
  assert.match(css, /max-width:740px/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.paper-wrap::before/);
});
