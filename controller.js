import {DEFAULTS, MARK, config, targetName, outOfStory, hasStory, scene, roll, noteFor} from './engine.js';
import {BY_ID} from './catalog.js';
import {branch, timeline, room, speaker, owns, receipt, put, visibleRowQuote, explicitlySettled} from './history.js';

const types=new Set(['normal','swipe','regenerate','continue']), typeOf=x=>x==null||x===''?'normal':String(x).toLowerCase();
const last=(a,f)=>{for(let i=a.length-1;i>=0;i--)if(f(a[i]))return a[i];};
export function boundary(messages,note){if(!note||!Array.isArray(messages)||!messages.length)return messages;
    let at=0;while(at<messages.length&&messages[at]?.role==='system')at++;
    if(at===messages.length||messages.some(m=>m?.role==='system'&&typeof m.content==='string'&&m.content.startsWith(MARK)))return messages;
    return [...messages.slice(0,at),{role:'system',content:note},...messages.slice(at)];}
function toolOrSchema(req){if(req.json_schema||req.response_format&& !['text',undefined].includes(req.response_format.type)||
        req.tool_choice!=null&&!['none','auto'].includes(req.tool_choice)||req.function_call!=null&&!['none','auto'].includes(req.function_call)||Number(req.n)>1)return true;
    // A prior completed tool exchange is normal history. Skip an active tool result at the end.
    const m=req.messages.at(-1);return ['tool','function'].includes(m?.role)||!!m?.tool_calls?.length||!!m?.function_call;}
export function connect({context,settings=()=>DEFAULTS,rng,update=()=>{},autoBind=true}){
    let turn=null,pending=null,replay=null,closeTimer=null,status='就绪，等待聊天生成。',lastPlan=null,disposed=false;
    const bus=context().eventSource,ev=context().eventTypes||context().event_types||{},listeners=[];
    const refresh=()=>{try{update(status,lastPlan);}catch{/* panel must never block chat */}};
    function say(text,plan=null){status=text;lastPlan=plan;refresh();}
    function clear(){if(closeTimer!=null)clearTimeout(closeTimer);closeTimer=null;turn=null;pending=null;}
    function start(type,options={},dry=false){if(dry)return;const k=typeOf(type);if(!types.has(k)||options?.quiet_prompt||options?.quietToLoud||options?.quietImage||options?.signal?.aborted)return;clear();
        const ctx=context();if(!config(settings()).enabled||!room(ctx))return;
        if(replay){if(!['swipe','regenerate'].includes(k)||room(ctx)!==replay.room)replay=null;
            else if(ctx.chat?.length===replay.pos+1){const tail=ctx.chat[replay.pos],id=timeline(ctx.chat).end;
                // ST may preselect a not-yet-generated swipe index. The selected source or its placeholder is valid.
                const emptySlot=k==='swipe'&&Array.isArray(tail?.swipes)&&tail.swipe_id>=tail.swipes.length;
                if(id!==replay.anchor&&!emptySlot)replay=null;}}
        turn={k,room:room(ctx),refs:[],used:false,signal:options?.signal};}
    function assembled(data,dry=false){if(dry||!turn||turn.used||!Array.isArray(data?.prompt)||!data.prompt.length)return;turn.refs.push(new Set(data.prompt.filter(m=>m&&typeof m==='object')));if(turn.refs.length>4)turn.refs.shift();}
    function ready(req){const ctx=context(),s=config(settings());if(!turn||turn.used||!s.enabled||turn.signal?.aborted||room(ctx)!==turn.room||!Array.isArray(req?.messages)||!req.messages.length||turn.k!==typeOf(req.type))return;
        // ST filters into a new array but keeps the individual message objects; avoid borrowing a helper's request.
        if(!turn.refs.some(refs=>req.messages.some(m=>refs.has(m))))return;
        turn.used=true;const actor=speaker(ctx);
        if(!actor){say('跳过：尚未确定本轮发言角色。');return;}
        if(s.scope==='targets'&&!targetName(req.model)){say('跳过：不在所选 Gemini 4 别名范围。');return;}
        if(toolOrSchema(req)||!ctx.chat?.length||!req.messages.some(m=>m.role==='user')){say('跳过：工具、结构化、多候选或非聊天请求。');return;}
        const k=turn.k,replace=(k==='swipe'||k==='continue')&&ctx.chat.length>0&&!ctx.chat.at(-1).is_user&&!ctx.chat.at(-1).is_system;
        if(k==='continue'&&!replace){say('跳过：没有可续写的角色消息。');return;}
        const pos=ctx.chat.length-(replace?1:0), prior=ctx.chat.slice(0,pos);
        if(outOfStory(last(prior,m=>m?.is_user&&!m.is_system)?.mes)){say('跳过：最近用户消息以戏外、摘要或编辑指令开头。');return;}
        const mem=s.memory?branch(ctx,actor,k==='continue'?pos+1:pos):{confirmed:[],recent:[],active:null};
        let old=null,plan;
        if(k==='continue'){
            old=mem.live?.find(x=>x.index===pos)?.rec;
            if(!old||!owns(actor,ctx.chat[pos])){say('续写沿用现有正文，没有向这条回复重新掷骰。');return;}
            const c=BY_ID[old.id];const ok=c&&(c.group!=='agency'||s.independent)&&(!c.mood||s.intensity>0)&&(!['shadow','rupture'].includes(c.group)||s.dark>0);
            plan={card:ok?c:null,level:Math.min(old.level,s.intensity),left:old.left,carry:true,voice:old.voice,phase:old.phase};
        }else{
            const replayNow=replay;replay=null;
            const matched=s.memory&&replayNow&&['swipe','regenerate'].includes(k)&&replayNow.room===turn.room&&replayNow.owner===actor.key&&replayNow.pos===pos&&replayNow.parent===timeline(prior).end;
            plan=matched?{card:BY_ID[replayNow.rec.id],level:Math.min(replayNow.rec.level,s.intensity),left:replayNow.rec.left,carry:!!replayNow.rec.carry,voice:replayNow.rec.voice,phase:replayNow.rec.phase}:roll(s,scene(actor.card,prior),mem,rng);
        }
        const note=noteFor(plan,mem,s,actor), messages=boundary(req.messages,note);
        if(note&&messages===req.messages){say('本次已跳过，原请求未重复注入。');return;}
        // Commit the one write after planning. No fetch hooks, no retries, no token or sampling parameter changes.
        if(messages!==req.messages)req.messages=messages;
        pending={k,room:turn.room,actor,pos,stream:req.stream?ctx.streamingProcessor:null,parent:timeline(prior).end,old,plan,memory:s.memory,before:k==='continue'?String(ctx.chat[pos].mes):null};
        say(note?(k==='continue'?'续写沿用本条落点。':plan.carry?'延续已有情绪。':'已完成本轮抽样。'):'本轮留白，未添加演出提示。',plan);
    }
    function received(i,type){const p=pending,ctx=context();const k=typeOf(type);
        if(!p||!Number.isInteger(i)||p.pos!==i||room(ctx)!==p.room||!types.has(k)&&!['append','appendfinal'].includes(k))return;
        if((p.k==='continue')!==['continue','append','appendfinal'].includes(k))return;
        if(p.k==='swipe'&&!['normal','swipe'].includes(k)||p.k!=='swipe'&&k==='swipe')return;
        if(turn?.signal?.aborted||p.stream?.abortController?.signal?.aborted&&p.stream?.messageId===i){clear();say('已停止，本轮没有新增记忆。');return;}
        const m=ctx.chat[i];if(!owns(p.actor,m)||timeline(ctx.chat,i).end!==p.parent)return;
        if(!config(settings()).enabled||!config(settings()).memory||!p.memory){clear();say('本轮结束，没有写入记忆。',p.plan);return;}
        if(!hasStory(m.mes)||m.extra?.tool_invocations?.length||p.stream?.messageId===i&&p.stream?.toolCalls?.length){clear();say('未取得可用的角色正文，本轮不写记忆。');return;}
        if(p.k==='continue'&&(!String(m.mes).startsWith(p.before)||String(m.mes)===p.before)){clear();say('续写没有新增可核对的正文。');return;}
        const anchor=timeline(ctx.chat,i+1).end;let next=receipt(p.plan,m.mes,p.actor.key,anchor);
        if(p.old)next={...p.old,anchor,echo:next.echo||p.old.echo,active:!!(p.old.left>0&&!explicitlySettled(p.old.id,String(m.mes).slice(p.before.length))&&(p.old.active||next.active)),
            quote:visibleRowQuote(m,p.old.quote)?p.old.quote:''};
        clear();if(next&&put(ctx,next)){
            // MESSAGE_RECEIVED is inside ST's save path; metadata lives in this chat's save, not global localStorage.
            say(next.echo?'已找到可核对的正文片段；长期记忆需手动确认。':next.id?'已抽样；未找到字面印证，可手动选正文核对。':'本轮留白。',p.plan);
        }else say('本轮结束，当前聊天没有可保存的元数据。',p.plan);
    }
    function stop(){if(turn||pending){clear();say('已停止，本轮不生成新记忆。');}}
    function end(){if(!turn)return;if(!pending){clear();return;} // ST may unlock the UI just BEFORE MESSAGE_RECEIVED.
        const expected=turn;if(closeTimer!=null)clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(turn===expected){clear();say('生成已结束，未匹配到可保存的角色回复。');}},15000);closeTimer?.unref?.();}
    function changed(){clear();replay=null;say('已切换聊天，使用当前分支的记忆。');}
    function bind(key,fn){if(!ev[key]||!bus?.on)return;const safe=(...args)=>{if(disposed)return;try{return fn(...args);}catch{clear();say('本次跳过：宿主数据格式不匹配，未阻止生成。');}};bus.on(ev[key],safe);listeners.push([ev[key],safe]);}
    if(autoBind){bind('GENERATION_STARTED',start);bind('GENERATE_AFTER_DATA',assembled);bind('CHAT_COMPLETION_SETTINGS_READY',ready);bind('MESSAGE_RECEIVED',received);
        bind('GENERATION_STOPPED',stop);bind('GENERATION_ENDED',end);bind('CHAT_CHANGED',changed);
        for(const k of ['MESSAGE_SWIPED','MESSAGE_DELETED','MESSAGE_EDITED','MESSAGE_UPDATED'])bind(k,()=>{if(!turn)say('已按当前选中的聊天分支更新。');else refresh();});}
    function armReplay(row){const c=context(),s=config(settings());if(turn||!s.enabled||!s.memory||!room(c)||!row?.rec?.id||row.index!==c.chat?.length-1||row.id!==timeline(c.chat).end)return false;
        const card=BY_ID[row.rec.id];if(!card||card.mood&&s.intensity===0||['shadow','rupture'].includes(card.group)&&s.dark===0||card.group==='agency'&&!s.independent)return false;
        replay={room:room(c),anchor:row.id,owner:row.rec.owner,pos:row.index,parent:row.parent,rec:{...row.rec}};say('已锁定末条抽签；手动滑动生成新候选或重新生成时沿用一次。');return true;}
    return {armReplay,start,assembled,ready,received,stop,end,changed,view:()=>({status,lastPlan}),reset:()=>{clear();replay=null;say('设置已更新。');},dispose(){disposed=true;clear();replay=null;for(const [e,f]of listeners)(bus?.removeListener||bus?.off)?.call(bus,e,f);}};
}
