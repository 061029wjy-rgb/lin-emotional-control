import { CARDS, BY_ID } from './catalog.js';
import {chooseVoice,deliveryAngle} from './voice.js';
export const KEY='human_temper_v1';
export const MARK='〔人性阴暗面/情绪/随机性放大·角色演出〕';
export const BALANCED=Object.freeze({eventRate:65,unpredict:75,dark:75,intensity:82,independent:true,memory:true});
export const STRONG=Object.freeze({eventRate:25,unpredict:100,dark:100,intensity:100,independent:true,memory:true});
export const DEFAULTS=Object.freeze({enabled:true,scope:'chat',...STRONG});
export function config(source={}) {
    const out={...DEFAULTS}; for(const k of ['eventRate','unpredict','dark','intensity']){
        const n=source?.[k]; if(Number.isFinite(n))out[k]=Math.min(100,Math.max(0,Math.round(n)));
    }
    for(const k of ['enabled','independent','memory'])if(typeof source?.[k]==='boolean')out[k]=source[k];
    if(source?.scope==='targets')out.scope='targets';return out;
}
export function localRandom(){const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0]/4294967296;}
export function targetName(value){const m=String(value??'').match(/gemini[\s_.\/-]*4[\s_.\/-]*(hydrogen|hydrgon|carbon|argon)(?=$|[^a-z])/i);return m?(m[1].toLowerCase()==='hydrgon'?'hydrogen':m[1].toLowerCase()):'';}
// Filter saved reasoning, comments and common non-story components; unclosed blocks consume the remainder.
export function visible(value){
    return String(value??'').replace(/<!--[\s\S]*?(?:-->|$)/g,' ')
        .replace(/<(think(?:ing)?|reasoning|analysis|lin_cot|details|script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,' ')
        .replace(/<\/?[a-zA-Z][\w:-]*(?:\s[^>]*?)?\s*\/?>/g,' ').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
}
export function hasStory(value){const t=visible(value);if(!/[\p{L}\p{N}]/u.test(t))return false;
    if(/^(?:\[?empty\]?|generation (?:failed|stopped)|network error|(?:请求出错|生成失败)(?:[：:].*)?)$/i.test(t))return false;
    // A character may say no. Only exclude recognizable service refusals, never a generic apology or a refusal to help someone.
    const lead=t.replace(/^(?:很抱歉|抱歉|对不起|i(?:’m|'m| am) sorry|sorry)[，,。.!！\s]*/i,'');
    if(/^作为(?:一个|一名)?\s*(?:AI|语言模型|人工智能)/i.test(lead))return false;
    if(/^(?:我)?(?:无法|不能)(?:(?:帮助|协助|继续)?(?:生成|创作|提供)(?:此类|这类|该|这个|相关|所请求的|此内容)|(?:执行|满足|完成)(?:该|这类|此类|此|这个)(?:请求|指令)|帮助生成(?:[。.!！]|$))/.test(lead))return false;
    return !/^i (?:cannot|can[’']t|am unable to) (?:comply with (?:this|that|your) request|(?:generate|provide) (?:this|that|such) content|help (?:generate|create) (?:this|that|such) content)/i.test(lead);}
export function outOfStory(raw){const t=visible(raw).replace(/^\s*[#>*_\s]+/,'').trim();return /^(?:[\[【（(]?\s*(?:OOC\b|乙方视角切换为戏外|戏外|场外(?:讨论|提问|指令)|题外(?:提问|讨论)|跳出(?:剧情|角色)|暂停(?:剧情|扮演|故事)|停止(?:剧情|扮演)|仅摘要|(?:请\s*)?(?:总结|总结一下|概括|回顾|翻译|润色|分析|检查)(?:一下)?(?:以上|上文|聊天|剧情|对话|这段|刚才)|(?:请\s*)?(?:总结(?:一下)?|概括|摘要|翻译|润色)(?=[：:，,。.!！?？\s]|$)|(?:请\s*)?(?:只(?:做|写|要)|仅(?:做|写))摘要|(?:please\s+)?(?:summari[sz]e|translate)\b))|^\//i.test(t);}
const cueTests={
    proud:/自尊|爱面子|好强|要强|proud|pride/i, sensitive:/敏感|怕.{0,3}抛下|易受伤|不安|sensitive|insecure/i,
    impatient:/冲动|急性子|急躁|火爆|直率|impulsive|hot.tempered/i, reserved:/寡言|克制|内向|冷静|隐忍|reserved|stoic|quiet/i,
    stubborn:/固执|执拗|倔|要强|stubborn/i, lively:/活泼|爱笑|好奇|健谈|lively|playful/i, warm:/温柔|体贴|随和|善良|gentle|caring|kind\b/i,
    strain:/争执|吵架|吵了|责怪|逼问|责备|生气|发火|冲突|怪我|不耐烦|argument|angry|pressure/i,
    loss:/难过|伤心|失落|离开了|分别|伤心|难受|哭|失去|grie[fv]|sad|hurt/i, repair:/对不起|道歉|哄|原谅|安慰|是我的错|抱歉|sorry|apolog|comfort/i,
    breach:/失约|食言|背叛|瞒着|骗了|不守信|爽约|隐瞒|撒谎|失信|lied|betray|broke .*promise/i,
    goal:/答应过|承诺|约定|约好|要去|赴约|打算|计划|职责|赶时间|值班|下班|独立|promise|appointment|deadline|plan\b/i,
    comparison:/比我|夸他|夸她|比不上|更喜欢|偏心|嫉妒|妒忌|不如|比.{1,6}(?:强|好|优秀)|jealous|better than/i,
    exposure:/揭穿|戳穿|当众|丢脸|看穿|出丑|embarrass|exposed/i, secret:/秘密|瞒|保密|隐私|secret/i,
    tired:/疲惫|累了|困了|疲倦|熬夜|tired|exhaust/i, joy:/好消息|庆祝|高兴|开心|成功|笑了|glad|celebrat/i,
    busy:/人群|车站|市场|厨房|店里|咖啡馆|办公室|热闹|crowd|station|café/i, outdoors:/路上|街上|街边|窗外|门口|花园|公园|雨|street|garden|outside/i,
    night:/深夜|傍晚|清晨|夜里|黄昏|天亮|夜班|midnight|dusk|dawn/i,
};
const traits=new Set(['proud','sensitive','impatient','reserved','stubborn','lively','warm']);
export function scene(card, turns){
    const cardText=[card?.personality,card?.data?.personality,card?.description,card?.data?.description].filter(Boolean).join('\n').slice(0,7500);
    const recent=turns.filter(m=>!m.is_system).slice(-4).map(m=>visible(m.mes).slice(-720)).join('\n');
    const tags=new Set();for(const [k,r] of Object.entries(cueTests))if(r.test(traits.has(k)?cardText:recent))tags.add(k);
    const blocks=new Set();if(/(?:绝不|从不|不会|never |cannot )\s*(?:撒谎|说谎|隐瞒|lie\b|lies\b)/i.test(cardText))blocks.add('hide');
    if(/(?:绝不|从不|不会|never )\s*(?:失约|食言|背叛|breaks? (?:a |their )?promise)/i.test(cardText))blocks.add('breakfaith');
    if(/(?:绝不|从不|不会|never )\s*(?:迁怒|发脾气|loses? (?:their |his |her )?temper)/i.test(cardText))blocks.add('temper');
    if(/(?:被骂|挨骂|被讥讽|被骂时).{0,8}(?:不生气|不会生气|不动怒|不会动怒|不发火)/.test(cardText)&&/(?:骂|蠢货|白痴|废物|滚开)/.test(recent))for(const id of ['temper','resent','grudge','vanity','contrary','shame'])blocks.add(id);
    return {tags,blocks};
}
function pick(list,r){let n=r()*list.reduce((a,b)=>a+b[1],0);for(const [k,w] of list){n-=w;if(n<0)return k;}return list.at(-1)?.[0];}
function plain(){return {card:null,level:0,left:0,carry:false};}
const pct=n=>n/100;
export function roll(settings,context,mem={},rng=localRandom){
    const s=config(settings), e=pct(s.intensity),d=pct(s.dark),u=pct(s.unpredict),f=pct(s.eventRate), tags=context.tags;
    if(!s.enabled)return plain();
    const active=mem.active, previous=BY_ID[active?.id];
    const allowed=c=>!context.blocks.has(c.id)&&(c.group!=='shadow'&&c.group!=='rupture'||d>0)&&(c.group!=='agency'||s.independent);
    if(s.memory&&e>0&&active?.left>0&&previous?.mood&&allowed(previous)){
        return {card:previous,level:Math.min(active.level,s.intensity),left:active.left-1,carry:true,voice:active.voice,phase:(active.phase||0)+1};
    }
    const pressure=['strain','loss','breach','comparison','repair','exposure'].filter(k=>tags.has(k)).length;
    // Compete for ONE beat: max intensity raises emotion's odds, never raises the event channel's weight.
    const weights={idle:24-10*e-4*u, emotion: e*(15+30*e+Math.min(14,5*pressure)),shadow:e*d*d*(8+38*d+Math.min(22,7*pressure)),
        odd:u*u*24,event:f*19,agency:s.independent?u*16:0,rupture:0};
    if(tags.has('goal')&&tags.has('breach')&&d>=.85&&e>=.75&&!(mem.recent??[]).includes('breakfaith'))weights.rupture=1.65*d;
    if(e===0&&u===0&&f===0)return plain();
    const groups=Object.entries(weights).filter(([k,w])=>w>0&&(k==='idle'||CARDS.some(c=>c.group===k&&allowed(c))));
    const chosen=pick(groups,rng);if(chosen==='idle'||!chosen)return plain();
    const candidates=CARDS.filter(c=>c.group===chosen&&allowed(c)).map(c=>{
        const hits=c.cues.filter(k=>tags.has(k)).length, near=(mem.recent??[]).indexOf(c.id);
        return [c,c.weight*(1+hits*1.4)*(near===0?.12:near>0?.48:1)];
    });
    const card=pick(candidates,rng);if(!card)return plain();
    const level=card.mood?Math.round(s.intensity*(.64+.36*rng())):0;
    const left=card.mood&&s.memory?(s.intensity>=95?3+Math.floor(rng()*4):level>=55?1+Math.floor(rng()*3):0):0;
    return {card,level,left,carry:false,voice:chooseVoice(card,tags,rng),phase:0};
}
function inline(t,n){return [...String(t??'').replace(/[\r\n\u0000-\u001f]+/g,' ').trim()].slice(0,n).join('');}
export function noteFor(plan,mem,s,actor){
    const facts=s.memory?(mem.confirmed??[]).slice(-3):[];if(!plan.card&&!facts.length)return '';
    const lines=[MARK+` 只演当前说话的角色${actor?.name?'「'+inline(actor.name,32)+'」':''}。角色卡的明确底线、所知范围和已发生的事实优先；用户自己的言行由用户决定。`];
    if(plan.card){lines.push((plan.carry?'承接这个角色私下未过的情绪，不重演上轮动作，外在表现可以变：':'本轮落点：')+plan.card.direction);
        if(plan.card.mood){if(s.intensity>=95&&plan.level>=60)lines.push('情绪可以压过判断：明知不划算也可以照做，前后矛盾也不必当场圆回来。别为了顺从对方而立刻好转、道歉或让步。用这个人自己的方式失态。');
        else if(plan.level>=52)lines.push('让这份情绪实在地影响言行。可以听懂好意而不接受，情绪也不必当场化解。');
        else lines.push('分量轻些，落在一个自然的反应里，不必扩大。');}
        const angle=deliveryAngle(plan.voice,plan.phase);if(angle)lines.push(angle);
        if(s.independent)lines.push('这个人有自己的注意力、利益和时间，可以不配合剧情里对方的期待。');}
    for(const f of facts)lines.push(`本分支已确认原文${f.private?'（仅本角色作私下线索，别人未必知道）':'（沿用原有知情范围）'}：${JSON.stringify(inline(f.quote,72))}`);
    lines.push('融入原有正文与格式，无需复述本说明；戏外编辑要求照常执行。');return lines.join('\n');
}
