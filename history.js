import {KEY, visible, hasStory} from './engine.js';
import {BY_ID} from './catalog.js';
// Local non-security fingerprints: no chat text is copied into the branch index.
const cache=new WeakMap(), ROOT='root';
function digest(s){let a=2166136261,b=5381;for(let i=0;i<s.length;i++){const v=s.charCodeAt(i);a=Math.imul(a^v,16777619);b=(Math.imul(b,33)^v)>>>0;}return (a>>>0).toString(36)+'.'+(b>>>0).toString(36)+'.'+s.length.toString(36);}
export function variant(m){return Number.isSafeInteger(m?.swipe_id)&&m.swipe_id>=0?m.swipe_id:0;}
function tag(m){const text=String(m?.mes??''),meta=JSON.stringify([!!m.is_user,!!m.is_system,m.original_avatar||m.name||'',variant(m)]),last=cache.get(m);if(last&&last.text===text&&last.meta===meta)return last.id;
    const id=digest(meta+'\n'+text);cache.set(m,{text,meta,id});return id;}
export function timeline(chat,until=chat.length){let id=ROOT;const rows=[];for(let i=0;i<Math.min(until,chat.length);i++){const msg=chat[i];if(!msg||typeof msg!=='object')continue;const parent=id;id=digest(parent+'/'+tag(msg));rows.push({index:i,id,parent,msg});}return {end:id,rows};}
export function room(ctx){return String(ctx?.chatId??ctx?.getCurrentChatId?.()??'');}
export function speaker(ctx){const card=ctx?.characters?.[ctx.characterId];if(!card)return null;const name=String(card.name||ctx.name2||'').trim();if(!name)return null;
    const avatar=card.avatar&&card.avatar!=='none'?String(card.avatar):'';if(ctx.groupId!=null&&ctx.groupId!==''&&!avatar)return null;
    return {name,avatar,key:avatar?'a:'+avatar:'n:'+name,group:ctx.groupId!=null&&ctx.groupId!=='',card};}
export function owns(actor,m){if(!actor||!m||m.is_user||m.is_system)return false;if(m.original_avatar)return actor.avatar===m.original_avatar;
    return !actor.group&&m.name===actor.name;}
export function records(ctx){const list=ctx?.chatMetadata?.[KEY]?.records;return Array.isArray(list)?list:[];}
export function put(ctx,r){if(!ctx?.chatMetadata||!r)return false;const all=records(ctx).filter(x=>x.anchor!==r.anchor);all.push(r);
    while(all.length>180){const i=all.findIndex(x=>!x.quote);all.splice(i<0?0:i,1);}ctx.chatMetadata[KEY]={version:1,records:all};return true;}
export function drop(ctx,anchor){if(ctx?.chatMetadata?.[KEY])ctx.chatMetadata[KEY].records=records(ctx).filter(r=>r.anchor!==anchor);}
export function branch(ctx,actor,until=ctx.chat.length){const run=timeline(ctx.chat,until),map=new Map(records(ctx).filter(r=>r&&r.owner===actor?.key).map(r=>[r.anchor,r]));const live=run.rows.flatMap(row=>{
    const rec=map.get(row.id);return rec&&owns(actor,row.msg)?[{...row,rec}]:[];
});const last=live.at(-1)?.rec;
    return {run,live,active:last?.active&&BY_ID[last.id]?.mood&&last.left>0?{id:last.id,left:last.left,level:last.level,voice:last.voice,phase:last.phase}:null,
        recent:live.slice(-5).reverse().map(x=>x.rec.id).filter(Boolean),confirmed:live.filter(x=>x.rec.quote).map(x=>({quote:x.rec.quote,private:x.rec.private}))};}
export function findEcho(body,card){if(!card)return '';const bits=visible(body).split(/(?<=[。！？!?；;])|\n+/u);for(let line of bits){line=line.trim();const match=card.trace.exec(line);if(!match)continue;
    const prior=line.slice(Math.max(0,match.index-9),match.index);if(/(?:没有|没在|不会|不是|并非|并未|不再|从不|并没有|不曾|never |didn.t )[^，。！？,;；]{0,2}$/iu.test(prior))continue;
    const start=Math.max(0,match.index-20);return [...line.slice(start)].slice(0,64).join('');}return '';}
// A sampled mood is the actor’s private performance state, never proof that an action took place.
const relief=/我(?:现在|已经|真的)?(?:不生气了|已经原谅你了|不再怪你了|不难过了)|我(?:真的)?放下这件事了|(?:i am|i’m|i'm) not (?:angry|upset) any ?more/i;
const sensitiveToRelief=new Set(['temper','grief','withdraw','grudge','contrary','resent']);
export function explicitlySettled(id,body){return sensitiveToRelief.has(id)&&relief.test(visible(body));}
export function receipt(plan,body,owner,anchor){if(!hasStory(body))return null;const hit=findEcho(body,plan.card), id=plan.card?.id||'';
    return {owner,anchor,id,level:plan.level,left:plan.left,active:!!(plan.card?.mood&&plan.left>0&&!explicitlySettled(id,body)&&(plan.carry||hit||plan.level>=60)),voice:plan.voice||null,phase:plan.phase||0,echo:hit,quote:'',private:true,carry:plan.carry};}
export function pin(ctx,row,quote,privateFlag,adopt){const t=String(quote??'').trim();if(!row||[...t].length<2||[...t].length>72||!hasStory(row.msg.mes)||!visible(row.msg.mes).includes(t))return false;
    const r={...row.rec,quote:t,private:!!privateFlag};if(adopt&&BY_ID[r.id]?.mood)r.active=true;return put(ctx,r);}
export function visibleRowQuote(m,quote){return !!quote&&visible(m?.mes).includes(quote);}
