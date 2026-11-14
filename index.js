import {KEY, BALANCED, STRONG, config} from './engine.js';
import {BY_ID} from './catalog.js';
import {connect} from './controller.js';
import {branch, speaker, pin, put, records} from './history.js';
const instance=Symbol.for('human-temper.extension.1');const ctx=()=>globalThis.SillyTavern.getContext();
let ctrl,el,appReady,selectedActor='',selectedAnchor='',controls={},statusNode,spoiler,actorSelect,entrySelect,quoteInput,excerpt,privateBox,ownerMood,journalMsg,memo='',noteBox;
function node(tag,text='',attrs={}){const n=document.createElement(tag);Object.assign(n,attrs);n.textContent=text;return n;}
function settings(){return config(ctx().extensionSettings?.[KEY]);}
function changed(patch){const c=ctx();if(!c.extensionSettings)return;const merged=config({...settings(),...patch});c.extensionSettings[KEY]=merged;c.saveSettingsDebounced?.();memo='';ctrl?.reset();sync();}
function button(label,fn){const n=node('button',label,{type:'button',className:'menu_button lhn-button'});n.addEventListener('click',fn);return n;}
function detail(title){const d=node('details');d.append(node('summary',title));return d;}
function option(value,label){const n=node('option',label);n.value=value;return n;}
function labeled(text,control){const lab=node('label','',{className:'lhn-labeled'});lab.append(node('span',text),control);return lab;}
function check(container,key,title,hint){const n=node('input','',{type:'checkbox',id:'lhn_'+key});const label=node('label','',{className:'lhn-check'});label.append(n,document.createTextNode(title));container.append(label);if(hint)container.append(node('p',hint,{className:'lhn-hint'}));n.onchange=()=>changed({[key]:n.checked});controls[key]={n};}
const sliders=[['intensity','情绪烈度','越高，越允许不理智与失态，情绪也持续更久。'],['dark','阴暗面放大','改变嫉妒、自利、记仇等动机的抽中权重；0 不再选这类动机。'],['unpredict','行为出格度','越高，越常出现有来由的意外反应和偏离 user 期待的选择。100 也须符合情境与人设；不用怪话凑意外，也不固定唱反调。'],['eventRate','生活插曲','控制琐事、周围动静和小机会；与脾气大小无关。'],['userAccess','user 参与便利度','越高，越容易发现并介入生活插曲或独立事务。0 不额外铺入口；100 也可不参与、也允许没有合适入口，事件照常推进。只手动调整；切换烈性/均衡会保留此值。']];
async function copyConfig(){const value=JSON.stringify(settings(),null,2);try{await navigator.clipboard.writeText(value);noteBox.textContent='配置已复制。';}catch{const box=node('textarea','',{readOnly:true,value});el.append(box);box.select();try{if(document.execCommand('copy')){box.remove();noteBox.textContent='配置已复制。';return;}}catch{}noteBox.textContent='请长按选中的配置文字复制。';}}
function availableActors(){const c=ctx(),live=speaker(c);if(c.groupId==null||c.groupId==='')return live?[live]:[];
    const group=c.groups?.find(g=>String(g.id)===String(c.groupId));const owners=new Set(records(c).map(r=>r?.owner));
    return (c.characters||[]).filter(ch=>ch?.avatar&&ch.avatar!=='none'&&(group?.members?.includes(ch.avatar)||owners.has('a:'+ch.avatar))).map(ch=>({key:'a:'+ch.avatar,name:ch.name,avatar:ch.avatar,group:true,card:ch}));}
function chosenRow(){const c=ctx(),actors=availableActors(),a=actors.find(x=>x.key===selectedActor)||actors[0];if(!a||!Array.isArray(c.chat))return {rows:[],a};const rows=branch(c,a).live.slice(-180).reverse();return {a,rows,row:rows.find(r=>r.id===selectedAnchor)||rows[0]};}
function journal(force=false){if(!el||!spoiler?.open)return;const c=ctx(),actors=availableActors();if(!actors.some(a=>a.key===selectedActor))selectedActor=speaker(c)?.key||actors[0]?.key||'';
    actorSelect.replaceChildren(...actors.map(a=>option(a.key,a.name)));actorSelect.value=selectedActor;
    const {rows,row}=chosenRow();entrySelect.replaceChildren(...rows.map(x=>option(x.id,`第 ${x.index+1} 条 · ${BY_ID[x.rec.id]?.label||'留白'}${x.rec.quote?' · 已钉住':''}`)));
    selectedAnchor=row?.id||'';entrySelect.value=selectedAnchor;const token=JSON.stringify([c.chatId,selectedActor,selectedAnchor,row?.rec.quote,row?.rec.private,row?.rec.active,row?.rec.echo]);
    if(!force&&token===memo)return;memo=token;
    if(!row){excerpt.textContent='当前角色在这条聊天分支还没有演出记录。';quoteInput.value='';journalMsg.textContent='';return;}
    const r=row.rec;excerpt.textContent=r.echo?'字面线索：'+r.echo:'尚未匹配到字面线索。可从这条回复的正文复制一小句。';
    quoteInput.value=r.quote||r.echo||'';privateBox.checked=r.private!==false;ownerMood.checked=false;
    journalMsg.textContent=(r.active&&r.left>0?`当时的私下情绪：还有 ${r.left} 次该角色发言的余波。`:'这条记录没有待延续的情绪。')+(r.quote?' 本段已钉为原文记忆。':' 未确认任何长期事实。');}
async function persist(){const c=ctx();if(typeof c.saveMetadata==='function')await c.saveMetadata();else if(typeof c.saveChat==='function')await c.saveChat();else c.saveMetadataDebounced?.();}
async function action(op){const {row}=chosenRow();if(!row){journalMsg.textContent='当前没有可操作的角色回复。';return;}let ok=false;
    if(op==='replay'){journalMsg.textContent=ctrl?.armReplay(row)?'这次抽签已锁定。请用酒馆的滑动生成新候选或重新生成；点击这里不会发请求。':'请选择当前聊天末条有抽签的回复，并启用相应设置。';return;}
    if(op==='pin')ok=pin(ctx(),row,quoteInput.value,privateBox.checked,ownerMood.checked);if(op==='unpin')ok=put(ctx(),{...row.rec,quote:''});if(op==='end')ok=put(ctx(),{...row.rec,active:false,left:0});
    if(!ok){journalMsg.textContent='请选择这条可见正文里连续的 2–72 个字符；不能钉住推测或隐藏注释。';return;}
    journal(true);try{await persist();}catch{journalMsg.textContent+=' 本次写入未确认保存，请检查酒馆连接。';}}
function mount(){if(el?.isConnected)return;const root=document.querySelector('#extensions_settings2')||document.querySelector('#extensions_settings');if(!root)return;
    controls={};el=detail('人性阴暗面/情绪/随机性放大');el.id='lhn-panel';const content=node('div','',{className:'lhn-body'});el.append(content);
    content.append(node('p','有的人只是想一个人坐会儿；有的人听懂了道歉，还在生气。',{className:'lhn-lead'}));
    check(content,'enabled','启用角色演出','');const modes=node('div','',{className:'lhn-actions'});modes.append(button('烈性 · 不讲理',()=>changed(STRONG)),button('切换均衡',()=>changed(BALANCED)));content.append(modes);
    content.append(node('p','初次安装默认烈性：烈度、阴暗、出格拉满，生活插曲降到 25；不必靠事故制造冲突。',{className:'lhn-hint'}));
    for(const [key,name,hint] of sliders){const n=node('input','',{type:'range',min:'0',max:'100',step:'1',id:'lhn_'+key}),out=node('output');out.htmlFor=n.id;
        const lab=node('label','',{className:'lhn-scale'});lab.htmlFor=n.id;lab.append(node('span',name),out);n.setAttribute('aria-label',name);content.append(lab,n,node('p',hint,{className:'lhn-hint'}));controls[key]={n,out};n.oninput=()=>{out.textContent=n.value;};n.onchange=()=>changed({[key]:+n.value});}
    check(content,'independent','自主目标','允许角色先办自己的事，或明确拒绝剧情中的请求。');check(content,'memory','跨回合情绪与分支记忆','只跟随当前选中的回复。强烈情绪可以没说出口；没写出来的事件不会自动变成事实。');
    const scope=node('select');scope.id='lhn_scope';scope.append(option('chat','所有聊天补全（含自定义渠道）'),option('targets','仅 Gemini 4 Argon / Carbon / Hydrogen 别名'));scope.onchange=()=>changed({scope:scope.value});controls.scope={n:scope};content.append(labeled('生效范围',scope));
    const line=node('div','',{className:'lhn-actions'});noteBox=node('span','',{className:'lhn-hint'});line.append(button('复制当前配置',copyConfig),noteBox);content.append(line);
    statusNode=node('p','',{className:'lhn-status'});statusNode.setAttribute('role','status');content.append(statusNode);
    spoiler=detail('查看本轮抽签和分支手记（含剧透）');spoiler.className='lhn-journal';content.append(spoiler);const inner=node('div','',{className:'lhn-inner'});spoiler.append(inner);
    const outcome=node('p','',{className:'lhn-outcome'});inner.append(outcome,node('p','抽到的念头属于角色。只有你钉住的正文原句会被长期引用；群聊按说话人隔离。',{className:'lhn-hint'}));
    actorSelect=node('select');entrySelect=node('select');inner.append(labeled('角色',actorSelect),labeled('当前分支的回复',entrySelect));actorSelect.onchange=()=>{selectedActor=actorSelect.value;selectedAnchor='';journal(true);};entrySelect.onchange=()=>{selectedAnchor=entrySelect.value;journal(true);};
    excerpt=node('p','',{className:'lhn-excerpt'});inner.append(excerpt);quoteInput=node('textarea','',{rows:2,placeholder:'粘贴这条正文里连续的 2–72 个字符'});inner.append(labeled('要记住的正文原句',quoteInput));privateBox=node('input','',{type:'checkbox',checked:true});ownerMood=node('input','',{type:'checkbox'});
    for(const [n,label] of [[privateBox,'标为本角色的私下线索'],[ownerMood,'我确认这份情绪已体现，承接剩余回合']]){const l=node('label','',{className:'lhn-check'});l.append(n,document.createTextNode(label));inner.append(l);}
    const acts=node('div','',{className:'lhn-actions'});acts.append(button('钉住原句',()=>action('pin')),button('取消钉住',()=>action('unpin')),button('结束这条情绪',()=>action('end')),button('下次重抽沿用这次落点',()=>action('replay')));inner.append(acts);
    journalMsg=node('p','',{className:'lhn-status'});inner.append(journalMsg);spoiler.ontoggle=()=>journal(true);root.append(el);sync();}
function sync(){if(!el)return;const s=settings();for(const [k,v] of Object.entries(controls)){if(v.n.type==='checkbox')v.n.checked=s[k];else v.n.value=s[k];if(v.out)v.out.textContent=String(s[k]);}
    const v=ctrl?.view();statusNode.textContent=s.enabled?(v?.status||'就绪。'):'已关闭；下次请求不注入。';const out=el.querySelector('.lhn-outcome');if(out)out.textContent=v?.lastPlan?(v.lastPlan.card?`本轮${v.lastPlan.carry?'承接':'抽中'}：${v.lastPlan.card.label}${v.lastPlan.card.mood?' · 烈度 '+v.lastPlan.level:''}`:'本轮未加随机动作。'):'等待本轮演出。';journal();}
export function onDisable(){ctrl?.dispose();ctrl=null;if(appReady){const {bus,event,fn}=appReady;(bus.removeListener||bus.off)?.call(bus,event,fn);appReady=null;}el?.remove();el=null;selectedActor='';selectedAnchor='';memo='';if(globalThis[instance]===onDisable)delete globalThis[instance];}
export function onEnable(){if(!globalThis.SillyTavern?.getContext)return;globalThis[instance]?.();globalThis[instance]=onDisable;const c=ctx();ctrl=connect({context:ctx,settings,update:sync});mount();if(c.eventTypes?.APP_READY){const fn=()=>{mount();sync();};appReady={bus:c.eventSource,event:c.eventTypes.APP_READY,fn};c.eventSource.on(appReady.event,fn);}}
onEnable();
