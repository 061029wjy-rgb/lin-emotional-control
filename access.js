// Decide only how a beat already drawn might be perceived. Never decide the user's move.
const privateBeat = new Set(['hide','quietjoy']);
const apart = /(?:让我|我想|我需要|我要|想要|想|要)(?:自己|独自|一个人)(?:安静|静一静|静静|待|呆|待会|待一会)|(?:想要|要求|希望|让我|独自|保持|想|要)独处|(?:请勿|别|不要|不想被)打扰|不在(?:现场|场)|分处两地|相隔两地|(?:分处|分别在|身在|各在)(?:异地|不同(?:的)?城市)|远在另一(?:个|座)城|没有联络渠道|异地且|无法联系|(?:无法|不能)联络|leave me alone|no contact|not present|in different cities|wants? to be alone/iu;
const contact = /(?:我(?:正在|已经|又|便|走过去)?(?:递给|交给|叫住|拉住|拦住|追问|问(?:他|她|你)|跟上|走向|凑近|敲(?:了敲)?门|接过)|我(?:对|向|朝)(?:你|他|她).{0,8}(?:说|问|喊|招手)|你(?:愿意|觉得|能不能|要不要)|\bI (?:ask|hand|follow|call out to|approach|knock)\b)/iu;
export const opportunityHint='若现场已有 user 能察觉的动静、共同事务或联络渠道，让一个细节自然露出来。user 可以接，也可以错过；角色继续做自己的事。角色想独处就略过。不替 user 看见、开口或加入，不另造相遇、传话、邀请或选择题。';
export function accessFor({card,level,marks=[],userText='',sceneText='',rng}) {
    if (!level) return '';
    if (privateBeat.has(card?.id) || apart.test(userText) || apart.test(sceneText)) return 'private';
    if (contact.test(userText)) return 'engaged';
    if (marks[0] === 'open') return 'cooldown';
    if (!card) return 'space';
    // A private scene, natural interaction or untracked turn breaks the streak.
    let gap=0;
    for (const mark of marks) { if(mark!=='space' && mark!=='cooldown')break; if(++gap===5)break; }
    const scale=level/100, chance=Math.min(.85,scale*(.53+Math.max(0,gap-1)*.21));
    return rng()<chance?'open':'space';
}
