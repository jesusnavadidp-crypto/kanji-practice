const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = path.join(__dirname, '..');
let checks = 0;
const check = (name, fn) => { fn(); checks++; };
const storage = new Map();
const elements = new Map();
const element = () => ({ innerHTML: '', textContent: '', classList: { toggle() {}, contains() { return false; }, add() {}, remove() {} }, addEventListener() {}, querySelector() { return element(); }, querySelectorAll() { return []; } });
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelectorAll() { return []; } };
const ctx = vm.createContext({ window: {}, document, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) }, console });
const load = file => vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), ctx, { filename: file });
for (const file of ['data/kanji.js', 'data/rtk.js', 'data/jlpt.js', 'data/kanjidic.js', 'data/radicals.js', 'js/srs.js', 'js/state.js', 'js/ui.js', 'js/data.js', 'js/flashcard.js']) load(file);
const W = ctx.window, S = W.State;
const today = W.Srs.today();
check('Daily count includes only first-time kanji, with no toggle inflation', () => {
  S.setStudying('一', true, {isKanji:true}); S.setStudying('一', false); S.setStudying('一', true, {isKanji:true});
  S.setStudying('⺅', true); S.setStudying('丨', true, {isKanji:true});
  assert.equal(S.getDailyCount(), 1);
});
check('Existing v2 progress defaults safely and cannot become new activity', () => {
  S.replaceProgressBundle({version:2, chars:{'二':{studying:true,srs:{meaning:{level:4,due:today},writing:{level:2,due:today}}}}});
  assert.equal(S.getDailyCount(), 0); assert.equal(S.getDailyGoal(), 5); assert.equal(S.getThemePreset(),'single');
  S.setStudying('二', false); S.setStudying('二',true,{isKanji:true}); assert.equal(S.getDailyCount(),0);
  assert.equal(S.getSrs('二').meaning.level,4);
});
check('New settings/activity round trip; old weights are ignored', () => {
  S.setDailyGoal(8); S.setThemePreset('christmas'); S.setStudying('三',true,{isKanji:true});
  const bundle=JSON.parse(JSON.stringify(S.getProgressBundle())); bundle.practiceSettings={weights:{new:100}};
  S.replaceProgressBundle(bundle);
  assert.equal(S.getDailyGoal(),8); assert.equal(S.getDailyCount(),1); assert.equal(S.getThemePreset(),'christmas');
  assert.equal('practiceSettings' in S.getProgressBundle(),false);
  S.setThemeColor('#abcdef'); assert.equal(S.getThemePreset(),'single');
});
check('Local calendar rollover resets the displayed count', () => {
  const bundle=JSON.parse(JSON.stringify(S.getProgressBundle()));
  bundle.dailyActivity={'2000-01-01':['三']}; S.replaceProgressBundle(bundle); assert.equal(S.getDailyCount(),0);
});
check('Legacy conversion remains available internally', () => {
  const result=S.convertLegacyBundle({'一':3}); assert.equal(result.bundle.chars['一'].srs.meaning.level,4);
});
S.replaceProgressBundle({version:2,chars:{}});
const pool = ['一','二','三','四','五','六','七','八','九','十','百','千'];
for (const char of pool) S.setStudying(char,true,{isKanji:true});
let card;
W.Flashcard.render = (_, opts) => {card=opts;};
load('js/testView.js');
const dataset=W.Data.loadDataset();
W.TestView.renderTestView(dataset,()=>{});
check('Practice covers each eligible kanji once per cycle and separates cycle boundaries', () => {
  let previous;
  for (let round=0;round<20;round++) {
    const dealt=[];
    for(let i=0;i<pool.length;i++) {if(i===0 && previous) assert.notEqual(card.char,previous); dealt.push(card.char);previous=card.char;card.onAnswer(i%2===0);}
    assert.equal(new Set(dealt).size,pool.length);
  }
});
check('Practice answers never alter SRS or persisted progress', () => {
  const before=JSON.stringify(S.getProgressBundle());
  for(let i=0;i<100;i++) card.onAnswer(i%2===0);
  assert.equal(JSON.stringify(S.getProgressBundle()),before);
});
check('Excluding or disabling a current character skips without grading', () => {
  const excluded=card.char; const before=JSON.stringify(S.getSrs(excluded));
  S.setExcludedFromTests(excluded,true); W.TestView.refreshTestIfEmpty(); assert.notEqual(card.char,excluded);
  const disabled=card.char; S.setStudying(disabled,false); W.TestView.refreshTestIfEmpty(); assert.notEqual(card.char,disabled);
  for(let i=0;i<40;i++) {assert.notEqual(card.char,excluded);assert.notEqual(card.char,disabled);card.onAnswer(true);}
  assert.equal(JSON.stringify(S.getSrs(excluded)),before);
});
check('Gesture handler ignores component gestures, multi-touch and cancellation', () => {
  const events={}; let moved=0;
  W.Ui.onHorizontalSwipe({addEventListener:(name,fn)=>events[name]=fn},40,()=>moved++);
  const start=(blocked=false,touches=[{clientX:100,clientY:0}])=>events.touchstart({touches,target:{closest:()=>blocked}});
  const end=()=>events.touchend({touches:[],changedTouches:[{clientX:0,clientY:0}]});
  start(true);end();assert.equal(moved,0);start();end();assert.equal(moved,1);
  start();events.touchcancel();end();assert.equal(moved,1);
  start(false,[{clientX:100,clientY:0},{clientX:120,clientY:0}]);end();assert.equal(moved,1);
});
check('Progress uses bundled denominators and actual SRS levels for excluded kanji', () => {
  S.replaceProgressBundle({version:2,chars:{'一':{studying:true,excludedFromTests:true,srs:{meaning:{level:0,nextSrsReviewDate:today},writing:{level:0,nextSrsReviewDate:today}}}}});
  load('js/progressView.js'); W.ProgressView.init(dataset);
  const html=elements.get('progress-view').innerHTML;
  assert.match(html,/1 \/ 2200 studying/);assert.match(html,/1 \/ 79 studying/);assert.match(html,/Mature: 0 both tracks/);
});
check('Theme presets produce readable text and reset to a custom single color', () => {
  const values={}; document.documentElement={dataset:{},style:{setProperty:(key,value)=>values[key]=value,removeProperty:key=>delete values[key]}};
  load('js/theme.js');
  for(const preset of ['halloween','christmas']) {
    S.setThemePreset(preset); assert.equal(document.documentElement.dataset.theme,preset);
    for(const band of [1,2,3]) assert.ok(W.Theme.contrast(values[`--band-${band}-ink`],values[`--band-${band}-bg`])>=4.5);
  }
  S.setThemeColor('#2f78cf'); assert.equal(document.documentElement.dataset.theme,'single');assert.equal(Object.keys(values).length,0);
});
check('Configurations renders the new controls and omits obsolete options', () => {
  load('js/configView.js'); W.ConfigView.renderConfigView();
  const html=elements.get('config-view').innerHTML;
  assert.match(html,/daily-goal/);assert.match(html,/theme-preset/);
  assert.doesNotMatch(html,/weight-input|convert-input|Convert old progress/);
});
check('Full script-order startup, Progress navigation and goal completion work together', () => {
  const nodes=new Map();
  const node=(id='')=> {
    const classes=new Set(id==='detail-overlay' || (id.endsWith('-view') && id!=='radicals-view') ? ['hidden']:[]);
    const listeners={};
    return {innerHTML:'',value:'',textContent:'',dataset:{},listeners,
      classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name),toggle(name,on){const next=on===undefined?!classes.has(name):on;if(next)classes.add(name);else classes.delete(name);}},
      addEventListener:(event,fn)=>listeners[event]=fn,remove(){},setAttribute(){},getAttribute(){return 'false';},
      querySelector(selector){return get(`${id}:${selector}`);},querySelectorAll(){return [];}};
  };
  const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
  const local=new Map();
  const doc={getElementById:get,querySelector:selector=>get(selector),querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{},style:{setProperty(){},removeProperty(){}}}};
  const full=vm.createContext({window:{addEventListener(){}},document:doc,localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value)},setInterval(){},setTimeout(){},clearTimeout(){},console});
  const scripts=[...fs.readFileSync(path.join(base,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  for(const file of scripts) vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),full,{filename:file});
  get('progress-menu-btn').listeners.click();
  assert.equal(get('progress-view').classList.contains('hidden'),false);
  assert.equal(get('kanji-view').classList.contains('hidden'),true);
  assert.match(get('progress-view').innerHTML,/2200/);
  full.window.State.setDailyGoal(1);
  full.window.State.setStudying('一',true,{isKanji:true});
  assert.match(get('activated-badge').innerHTML,/1\/1/);
  assert.match(get('goal-celebration').textContent,/Daily goal complete/);
});

module.exports={checks};
if(require.main===module) console.log(`${checks} regression checks passed.`);
