// An angle changes HOW a feeling leaks out, never who the character is or what really happened.
export const VOICES=Object.freeze({
    direct:['让旁人清楚听见这份情绪，哪怕话说得不漂亮。','不争输赢了，情绪仍留在说话的快慢或用词里。','此刻无需再解释；给角色一个利落的实际动作。','如果值得，再开口；不把上回的话换词复述一遍。'],
    inward:['把最重的部分咽下去；旁人只能看见他愿意露的那一点。','让这份感觉改变一个小决定，表情甚至可以照旧。','手里照常做事；注意力悄悄偏了一下。','这次可以短短说出一部分，留着那些还不想讲的。'],
    sideways:['情绪从当前事务或现场的小事上侧漏，可以不直说。','让情绪影响这人先理哪一件事，不必再做同样的小动作。','顺着当前事务或已有牵挂转了话题，感受仍在；把新话题当真说。','这一次可以不表现给任何人看，不强加和解或反转。'],
    uneven:['第一反应比想好的话更快，不必替前后矛盾找一个漂亮理由。','可以做一件跟刚才口气不太一致的事，心情照旧。','过会儿才想起真正在意的部分，没必要立刻跟人解释。','让外在起伏平一些；收住声音不等于内心翻篇。'],
    occupied:['保留原本的生活节奏；这股感觉在忙别的事时也可以一直跟着。','不需要重启争论，情绪可以影响对寻常事情的耐心或兴致。','允许情绪绕开对方，去改变他自己下一步的打算。','眼下别的事更要紧，哪怕这份感觉仍没个结论。'],
});
export function chooseVoice(card,tags,rng){if(!card?.mood)return null;const choices=[['direct',tags.has('impatient')?5:1],['inward',tags.has('reserved')||tags.has('sensitive')?5:2],['sideways',tags.has('lively')?4:2],['uneven',tags.has('proud')?4:2],['occupied',tags.has('goal')?4:2]];let n=rng()*choices.reduce((a,x)=>a+x[1],0);for(const [key,w] of choices){n-=w;if(n<0)return key;}return 'inward';}
export function deliveryAngle(voice,phase){return VOICES[voice]?.[Math.max(0,Math.floor(phase||0))%4]||'';}
