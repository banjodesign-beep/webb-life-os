import React, { useState, useEffect, useCallback, useRef } from "react";
import { load, save } from "./lib/supabase.js";
import { resolveStreakAdvance, checkMilestone, accrueGraceToken } from "./lib/streakEngine.js";
import { CATEGORY_LABELS, GRACE_TOKENS_PER_WEEK, MILESTONE_BONUS_XP, generateMilestoneList } from "./config/meridianConfig.js";
import MilestoneJourney from "./components/MilestoneJourney.jsx";
import MilestoneSplash from "./components/MilestoneSplash.jsx";

// ── DATE HELPERS ──────────────────────────────────────────────────────
const localDate = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const todayKey  = () => localDate();
const weekKey   = () => { const d=new Date(),j=new Date(d.getFullYear(),0,1),w=Math.ceil((((d-j)/864e5)+j.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`; };
const monthKey  = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const yearKey   = () => `${new Date().getFullYear()}`;
const getModeForDate = (ds) => { const d=new Date(ds+"T12:00:00"); if(d.getDay()===0)return"sunday"; if(d.getDay()===6)return"saturday"; return"weekday"; };
const getDayKey = (ds, mode) => `cl-${mode}-${ds}`;
const formatDate = () => new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const formatShort = (iso) => new Date(iso.split("T")[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
const summerDaysLeft = () => { const n=new Date(),s=new Date(n.getFullYear(),5,21); if(n>s)s.setFullYear(s.getFullYear()+1); return Math.ceil((s-n)/864e5); };
const getPastDays = (n) => { const days=[]; for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(localDate(d));} return days; };
const getLevelInfo = (xp) => {
  const T=[{l:1,max:499,t:"Getting Started"},{l:2,max:999,t:"Building Rhythm"},{l:3,max:1999,t:"Gaining Momentum"},{l:4,max:3499,t:"In the Flow"},{l:5,max:5999,t:"Man After God\'s Heart"},{l:6,max:Infinity,t:"Legacy Builder"}];
  const tier=T.find(t=>xp<=t.max)||T[T.length-1]; const prev=T[T.indexOf(tier)-1],pm=prev?prev.max:-1;
  return {...tier,progress:tier.max===Infinity?100:Math.round(((xp-pm-1)/(tier.max-pm))*100)};
};
const getDailyScripture = () => {
  const SCRIPTURES=[
    {verse:"For I know the plans I have for you, declares the Lord — plans to prosper you and not to harm you, plans to give you hope and a future.",ref:"Jeremiah 29:11"},
    {verse:"I can do all this through him who gives me strength.",ref:"Philippians 4:13"},
    {verse:"The Lord is my shepherd, I lack nothing.",ref:"Psalm 23:1"},
    {verse:"Trust in the Lord with all your heart and lean not on your own understanding.",ref:"Proverbs 3:5"},
    {verse:"Be strong and courageous. Do not be afraid, for the Lord your God will be with you wherever you go.",ref:"Joshua 1:9"},
    {verse:"And we know that in all things God works for the good of those who love him.",ref:"Romans 8:28"},
    {verse:"Come to me, all you who are weary and burdened, and I will give you rest.",ref:"Matthew 11:28"},
    {verse:"He gives strength to the weary and increases the power of the weak.",ref:"Isaiah 40:29"},
    {verse:"The joy of the Lord is your strength.",ref:"Nehemiah 8:10"},
    {verse:"Cast all your anxiety on him because he cares for you.",ref:"1 Peter 5:7"},
    {verse:"Those who hope in the Lord will renew their strength. They will soar on wings like eagles.",ref:"Isaiah 40:31"},
    {verse:"Be still and know that I am God.",ref:"Psalm 46:10"},
    {verse:"The steadfast love of the Lord never ceases; his mercies never come to an end.",ref:"Lamentations 3:22-23"},
    {verse:"Whatever you do, work at it with all your heart, as working for the Lord.",ref:"Colossians 3:23"},
    {verse:"No, in all these things we are more than conquerors through him who loved us.",ref:"Romans 8:37"},
    {verse:"I praise you because I am fearfully and wonderfully made.",ref:"Psalm 139:14"},
    {verse:"Your word is a lamp for my feet, a light on my path.",ref:"Psalm 119:105"},
    {verse:"This is the day the Lord has made; let us rejoice and be glad in it.",ref:"Psalm 118:24"},
    {verse:"If God is for us, who can be against us?",ref:"Romans 8:31"},
    {verse:"My grace is sufficient for you, for my power is made perfect in weakness.",ref:"2 Corinthians 12:9"},
    {verse:"He who began a good work in you will carry it on to completion.",ref:"Philippians 1:6"},
    {verse:"Now to him who is able to do immeasurably more than all we ask or imagine.",ref:"Ephesians 3:20"},
    {verse:"God is our refuge and strength, an ever-present help in trouble.",ref:"Psalm 46:1"},
    {verse:"Delight yourself in the Lord and he will give you the desires of your heart.",ref:"Psalm 37:4"},
    {verse:"Surely goodness and love will follow me all the days of my life.",ref:"Psalm 23:6"},
    {verse:"The Lord your God is with you, the Mighty Warrior who saves.",ref:"Zephaniah 3:17"},
    {verse:"So do not fear, for I am with you; do not be dismayed, for I am your God.",ref:"Isaiah 41:10"},
    {verse:"Draw near to God and he will draw near to you.",ref:"James 4:8"},
  ];
  const start=new Date(new Date().getFullYear(),0,0);
  const day=Math.floor((new Date()-start)/864e5);
  return SCRIPTURES[day%SCRIPTURES.length];
};

// ── DEFAULT CHECKLISTS (Supabase-overridable) ─────────────────────────
const DEFAULT_LISTS = {
  weekday:[
    {id:"wd0",text:"30 min stillness",sub:"Prayer before the day opens.",xp:15,icon:"🕊️",cat:"spirit",w:"core"},
    {id:"wd1",text:"Morning anchor",sub:"Identity before activity.",xp:10,icon:"☀️",cat:"spirit",w:"bonus"},
    {id:"wd2",text:"No caffeine after 12pm",sub:"Slow metabolizer — protect sleep.",xp:5,icon:"☕",cat:"health",w:"bonus"},
    {id:"wd3",text:"Present with family",sub:"Eye contact. No phone at dinner.",xp:10,icon:"🏠",cat:"home",w:"core"},
    {id:"wd4",text:"Workout done",sub:"Strength, sprint, or movement.",xp:12,icon:"💪",cat:"health",w:"core"},
    {id:"wd5",text:"No decisions after 9pm",sub:"Hard problems get morning slots.",xp:5,icon:"🌙",cat:"work",w:"bonus"},
    {id:"wd6",text:"Hydration",sub:"Water before coffee. All day.",xp:5,icon:"💧",cat:"health",w:"bonus"},
  ],
  saturday:[
    {id:"sa0",text:"Family breakfast",sub:"Together. No phones.",xp:15,icon:"🍳",cat:"home",w:"core"},
    {id:"sa1",text:"River — connection time",sub:"Intentional. His world, his pace.",xp:15,icon:"⚽",cat:"home",w:"core"},
    {id:"sa2",text:"Annie — connection time",sub:"Her space, her interests.",xp:15,icon:"🎭",cat:"home",w:"core"},
    {id:"sa3",text:"Music practice",sub:"Bass, guitar, or piano. 30 min+. Shows on weeks without a lesson.",xp:12,icon:"🎸",cat:"music",w:"bonus"},
    {id:"sa4",text:"Movement / outdoors",sub:"Walk, hike, or workout.",xp:10,icon:"🌄",cat:"health",w:"core"},
    {id:"sa5",text:"Platform — 1 action",sub:"One thing toward the books or 151.",xp:10,icon:"✍️",cat:"work",w:"core"},
    {id:"sa6",text:"Jules — date or moment",sub:"Even 30 minutes. Just the two of you.",xp:15,icon:"💍",cat:"home",w:"core"},
  ],
  sunday:[
    {id:"su0",text:"Church",sub:"Show up. Be present.",xp:20,icon:"⛪",cat:"spirit",w:"core"},
    {id:"su1",text:"30 min stillness",sub:"Sabbath starts in the quiet.",xp:15,icon:"🕊️",cat:"spirit",w:"bonus"},
    {id:"su2",text:"Sabbath honored",sub:"Rest in God\'s sovereignty.",xp:20,icon:"🌿",cat:"spirit",w:"core"},
    {id:"su3",text:"Family time",sub:"No agenda. Just present.",xp:15,icon:"🏠",cat:"home",w:"core"},
  ],
  travel:[
    {id:"tr0",text:"Morning anchor",sub:"The compass doesn\'t change with timezone.",xp:12,icon:"🕊️",cat:"spirit",w:"bonus"},
    {id:"tr1",text:"30 min stillness",sub:"Especially on the road.",xp:10,icon:"☀️",cat:"spirit",w:"core"},
    {id:"tr2",text:"No caffeine after 12pm",sub:"Jet lag + slow metabolizer.",xp:5,icon:"☕",cat:"health",w:"bonus"},
    {id:"tr3",text:"Sleep kit deployed",sub:"Eye mask, earplugs, room dark.",xp:5,icon:"😴",cat:"health",w:"bonus"},
    {id:"tr4",text:"Called Jules and kids",sub:"Connection doesn\'t stop at the gate.",xp:10,icon:"📱",cat:"home",w:"core"},
    {id:"tr5",text:"20 min movement",sub:"Hotel gym or bodyweight.",xp:8,icon:"🏃",cat:"health",w:"core"},
    {id:"tr6",text:"Hydration — water first",sub:"Not just airport coffee.",xp:3,icon:"💧",cat:"health",w:"bonus"},
    {id:"tr7",text:"IJM intention set",sub:"Why am I here today?",xp:8,icon:"🎯",cat:"work",w:"bonus"},
    {id:"tr8",text:"Platform capture",sub:"What feeds the books or 151?",xp:10,icon:"✍️",cat:"work",w:"core"},
  ],
  weekly:[
    {id:"wk0",text:"Financial dashboard",sub:"Friday. 5 minutes.",xp:10,icon:"📊"},
    {id:"wk1",text:"River transport",sub:"Practices handled.",xp:10,icon:"⚽"},
    {id:"wk2",text:"Real connection — Jules",sub:"Not logistics. Actual presence.",xp:15,icon:"💍"},
    {id:"wk3",text:"Physical training 3x",sub:"Strength and sprint.",xp:15,icon:"🏋️"},
    {id:"wk4",text:"Music practice session",sub:"1 minimum. 3 is the target.",xp:12,icon:"🎸"},
  ],
  ijm:[
    {id:"i0",text:"Strategic thinking hour",sub:"Uninterrupted. Big picture only.",xp:20,icon:"🧠"},
    {id:"i1",text:"Team health pulse",sub:"How is my team? Am I leading well?",xp:15,icon:"👥"},
    {id:"i2",text:"Platform capture",sub:"What from IJM this week feeds the books?",xp:20,icon:"📚"},
    {id:"i3",text:"Global impact moment",sub:"One thing that reminded me why.",xp:10,icon:"🌍"},
  ],
  monthly:[
    {id:"m0",text:"Financial review — Jules",sub:"30 min. Both present.",xp:30,icon:"💼"},
    {id:"m1",text:"LinkedIn article",sub:"Test a book idea.",xp:40,icon:"📱"},
    {id:"m2",text:"Focused time — both kids",sub:"Annie + River. Intentional.",xp:25,icon:"👨‍👧‍👦"},
    {id:"m3",text:"Annie Boba date",sub:"Her space, her pace.",xp:20,icon:"🧋"},
    {id:"m4",text:"Parent contact — Australia",sub:"Call, video, or message.",xp:20,icon:"🌏"},
    {id:"m5",text:"Personal reflection",sub:"Am I moving toward 55?",xp:25,icon:"🪞"},
    {id:"m6",text:"Album session — 1hr min",sub:"Dedicated time on the record.",xp:35,icon:"🎵"},
    {id:"m7",text:"Something fun",sub:"Concert, event, experience.",xp:20,icon:"🎉"},
    {id:"m8",text:"Sabbath 1 of 3",sub:"Three per month minimum.",xp:25,icon:"🕊️"},
    {id:"m9",text:"Sabbath 2 of 3",sub:"Three per month minimum.",xp:25,icon:"🕊️"},
    {id:"m10",text:"Sabbath 3 of 3",sub:"Three per month minimum.",xp:25,icon:"🕊️"},
  ],
  annual:[
    {id:"a0",text:"Annual physical",sub:"Full bloodwork. Ferritin included.",xp:100,icon:"🩺"},
    {id:"a1",text:"Ferritin and iron checked",sub:"HFE variant. Rule it in or out.",xp:50,icon:"🔬"},
    {id:"a2",text:"Dental checkup",sub:"Twice yearly ideally.",xp:40,icon:"🦷"},
    {id:"a3",text:"Financial planner meeting",sub:"529, platform income, parents.",xp:75,icon:"🏦"},
    {id:"a4",text:"Estate/will reviewed",sub:"Jules knows where everything is.",xp:60,icon:"📋"},
    {id:"a5",text:"Goal architecture review",sub:"Full year. Reset the vision.",xp:75,icon:"🗺️"},
    {id:"a6",text:"Family adventure booked",sub:"Next year\'s trip decided by June.",xp:50,icon:"✈️"},
    {id:"a7",text:"Anniversary intentional",sub:"December 2. Not a calendar entry.",xp:60,icon:"💍"},
    {id:"a8",text:"Parent care plan reviewed",sub:"Australia. Aging considerations.",xp:50,icon:"🌏"},
  ],
  platform:[
    {id:"p0",text:"Recalibrated — chapter work",sub:"Draft, edit, or outline. Any movement counts.",xp:40,icon:"📖"},
    {id:"p1",text:"The Sequence — chapter or article",sub:"LinkedIn or manuscript progress.",xp:40,icon:"✍️"},
    {id:"p2",text:"One Five One — content or planning",sub:"Podcast, groundwork, or movement planning.",xp:35,icon:"🔥"},
    {id:"p3",text:"IJM strategic thinking hour",sub:"Uninterrupted. Big picture only.",xp:30,icon:"🧠"},
    {id:"p4",text:"IJM team health pulse",sub:"How is my team?",xp:20,icon:"👥"},
    {id:"p5",text:"Platform capture",sub:"What feeds the books or 151?",xp:25,icon:"🌍"},
    {id:"p6",text:"BenWebb.com or social content",sub:"Any public-facing platform action.",xp:30,icon:"📱"},
  ],
};

const DEFAULT_GOALS = [
  {id:"g0",domain:"family",title:"Annie\'s college pathway — depth over compliance",detail:"Theatre/Arts as spike.",target:"2029",progress:20},
  {id:"g1",domain:"family",title:"River\'s ceiling limited only by talent",detail:"Pride Club, BC, daily training.",target:"Ongoing",progress:35},
  {id:"g2",domain:"family",title:"Parents feel cared for",detail:"Conversation guide. Regular contact.",target:"2027",progress:15},
  {id:"g3",domain:"family",title:"20th anniversary marked",detail:"December 2, 2026.",target:"Dec 2026",progress:10},
  {id:"g4",domain:"platform",title:"The Sequence — manuscript complete",detail:"LinkedIn monthly. Ken Caldwell.",target:"Q1 2027",progress:20},
  {id:"g5",domain:"platform",title:"Recalibrated — publisher secured",detail:"Zondervan, IVP, WaterBrook.",target:"2027",progress:30},
  {id:"g6",domain:"platform",title:"BenWebb.com live",detail:"One home for all three projects.",target:"Q2 2026",progress:5},
  {id:"g7",domain:"financial",title:"529 accounts open — Annie and River",detail:"Colorado CollegeInvest.",target:"Q2 2026",progress:0},
  {id:"g8",domain:"financial",title:"Household dashboard Jules-managed",detail:"Five-tab Excel. Monthly rhythm.",target:"Q2 2026",progress:70},
  {id:"g9",domain:"health",title:"Strength/sprint as primary modality",detail:"3x per week minimum.",target:"Ongoing",progress:40},
  {id:"g10",domain:"health",title:"Sleep kit optimized for travel",detail:"Eye mask, earplugs. Every trip.",target:"Q2 2026",progress:50},
];

const DOMAIN_CFG = {
  family:{label:"Family",color:"#23B5D3"},
  platform:{label:"Platform",color:"#A2AEBB"},
  financial:{label:"Financial",color:"#75ABBC"},
  health:{label:"Health",color:"#1A8FA8"},
};

const ACHIEVEMENTS = [
  {id:"a0",icon:"🌱",title:"First Step",check:s=>s.totalDays>=1},
  {id:"a1",icon:"🔥",title:"7-Day Streak",check:s=>s.streak>=7},
  {id:"a2",icon:"⚡",title:"30-Day Streak",check:s=>s.streak>=30},
  {id:"a3",icon:"🕊️",title:"Sabbath Keeper",check:s=>s.sabbaths>=9},
  {id:"a4",icon:"🎯",title:"Goal Crusher",check:s=>s.goalsComplete>=1},
  {id:"a5",icon:"🎵",title:"In the Studio",check:s=>s.practiceSessions>=10},
  {id:"a6",icon:"👥",title:"Well Connected",check:s=>s.friendDinners>=6},
  {id:"a7",icon:"✈️",title:"Global Servant",check:s=>s.tripCount>=3},
  {id:"a8",icon:"👑",title:"1,000 Points",check:s=>s.totalXP>=1000},
  {id:"a9",icon:"🌍",title:"Legacy Builder",check:s=>s.totalXP>=2500},
];

const STAGE_PCT = {"Not Started":0,"Written":20,"Demo":40,"Recording":60,"Mixing":80,"Complete":100};

// ── CONFETTI + XP FLOAT ───────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({length:50},(_,i)=>({
    id:i,x:Math.random()*100,
    color:["#2563EB","#60A5FA","#34D399","#A78BFA","#FBBF24","#F472B6"][Math.floor(Math.random()*6)],
    size:Math.random()*8+4,delay:Math.random()*0.8,dur:Math.random()*1.5+1.5,
  }));
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1000,overflow:"hidden"}}>
      {pieces.map(p=>(
        <div key={p.id} style={{position:"absolute",top:"-20px",left:`${p.x}%`,width:p.size,height:p.size,background:p.color,borderRadius:Math.random()>0.5?"50%":"2px",animation:`confettiFall ${p.dur}s ${p.delay}s ease-in forwards`}}/>
      ))}
    </div>
  );
}
function XPFloat({amount,onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,1200);return()=>clearTimeout(t);},[]);
  return <div style={{position:"fixed",bottom:140,right:24,fontWeight:800,fontSize:18,color:"#2563EB",animation:"xpFloat 1.2s ease-out forwards",pointerEvents:"none",zIndex:500}}>+{amount} pts</div>;
}

// ── APP ICON ──────────────────────────────────────────────────────────
function AppIcon({size=32,style={}}) {
  return <img src="/app-icon.png" width={size} height={size} alt="Webb" style={{display:"block",borderRadius:size*0.22,objectFit:"cover",...style}}/>;
}

// ── SPLASH SCREEN ─────────────────────────────────────────────────────
function SplashScreen({onDone}) {
  const [phase, setPhase] = useState(0);
  const s = getDailyScripture();
  const today = new Date();
  const dow = today.getDay();
  const modeCode = dow===0?"SUN":dow===6?"SAT":"WD";
  const modeLabel = dow===0?"SABBATH":dow===6?"FAMILY DAY":today.toLocaleDateString("en-US",{weekday:"long"}).toUpperCase();
  const dateStr = today.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}).split("/").join(".");

  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),400);
    const t2=setTimeout(()=>setPhase(2),300);
    const t3=setTimeout(()=>setPhase(3),2600);
    const t4=setTimeout(()=>onDone(),3200);
    return()=>[t1,t2,t3,t4].forEach(clearTimeout);
  },[]);

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:999,
      background:"#071013",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:40,
      opacity:phase===3?0:1,
      transition:phase===3?"opacity 0.6s ease":"none",
    }}>
      {/* Horizontal rule */}
      <div style={{
        position:"absolute",top:"50%",left:0,right:0,height:"1px",
        background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.3),transparent)",
        opacity:phase>=1?1:0,transition:"opacity 0.8s ease",
      }}/>

      {/* Icon */}
      <div style={{
        marginBottom:32,zIndex:1,
        opacity:phase>=0?1:0,
        transform:phase>=0?"translateY(0)":"translateY(8px)",
        transition:"all 0.5s ease",
      }}>
        <AppIcon size={64} style={{
          boxShadow:"0 0 40px rgba(35,181,211,0.2)",
          borderRadius:14,
        }}/>
      </div>

      {/* MERIDIAN wordmark */}
      <div style={{
        fontSize:42,fontWeight:900,color:"#DFE0E2",
        letterSpacing:"0.28em",textTransform:"uppercase",
        marginBottom:8,zIndex:1,
        opacity:phase>=1?1:0,
        transform:phase>=1?"translateY(0)":"translateY(10px)",
        transition:"all 0.5s ease 0.1s",
      }}>MERIDIAN</div>

      {/* Coordinates line */}
      <div style={{
        display:"flex",alignItems:"center",gap:16,marginBottom:40,zIndex:1,
        opacity:phase>=1?1:0,
        transition:"opacity 0.5s ease 0.2s",
      }}>
        <div style={{height:"1px",width:32,background:"rgba(35,181,211,0.4)"}}/>
        <div style={{fontSize:10,fontWeight:800,color:"#23B5D3",letterSpacing:"0.2em"}}>{dateStr} · {modeLabel}</div>
        <div style={{height:"1px",width:32,background:"rgba(35,181,211,0.4)"}}/>
      </div>

      {/* Scripture */}
      <div style={{
        maxWidth:320,textAlign:"center",zIndex:1,
        opacity:phase>=2?1:0,
        transform:phase>=2?"translateY(0)":"translateY(8px)",
        transition:"all 0.5s ease 0.15s",
        borderTop:"1px solid rgba(255,255,255,0.06)",
        paddingTop:24,
      }}>
        <div style={{fontSize:13,fontStyle:"italic",color:"#4A5A62",lineHeight:1.7,marginBottom:10}}>
          "{s.verse.length>120?s.verse.slice(0,120)+"…":s.verse}"
        </div>
        <div style={{fontSize:9,fontWeight:800,color:"#23B5D3",letterSpacing:"0.18em",textTransform:"uppercase"}}>{s.ref}</div>
      </div>
    </div>
  );
}

// ── CHECK GROUP (outside App to prevent flicker) ──────────────────────
const CheckGroup = React.memo(function CheckGroup({items,state,onToggle,bouncing,travel}) {
  return (
    <div className="check-card">
      {items.map((item,idx)=>{
        const val=state[item.id]; const isDone=val?.checked; const isBounce=bouncing===item.id;
        const dc=travel?"done-travel":"done";
        return (
          <div key={item.id} className="c-row" style={{animationDelay:`${idx*0.035}s`}} onClick={()=>onToggle(item.id,item,state)}>
            <div className={`c-icon-bg ${isDone?dc:""}`}>{item.icon}</div>
            <div className={`c-circle ${isDone?dc:""} ${isBounce?"bounce":""}`}/>
            <div className="c-body">
              <div className={`c-main ${isDone?"done":""}`}>{item.text}</div>
              <div className="c-hint">{item.sub}</div>
              {isDone&&val.at&&<div className="c-ts">{new Date(val.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
            <div className={`c-xp ${isDone?"done":travel?"travel":""}`}>{isDone?"✓":`+${item.xp}`}</div>
          </div>
        );
      })}
    </div>
  );
});

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
@keyframes gradShift{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
@keyframes countUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes bounceCheck{0%{transform:scale(1);}30%{transform:scale(0.72);}60%{transform:scale(1.22);}80%{transform:scale(0.94);}100%{transform:scale(1);}}
@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1;}100%{transform:translateY(110vh) rotate(360deg);opacity:0;}}
@keyframes xpFloat{0%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-60px);}}
@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
@keyframes glow{0%,100%{opacity:0.4;}50%{opacity:0.9;}}
@keyframes slideIn{from{opacity:0;transform:translateX(-14px);}to{opacity:1;transform:translateX(0);}}
@keyframes iconPop{0%{transform:scale(0.4);opacity:0;}60%{transform:scale(1.1);}100%{transform:scale(1);opacity:1;}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body,html{
  background:#E8F4F8;
  background-image:
    linear-gradient(180deg,#FFFFFF 0%,#EAF4F8 40%,#C8DFE8 100%);
  background-attachment:fixed;
  color:#071013;
  font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
button,input,textarea,select{font-family:inherit;}
.app{min-height:100vh;display:flex;flex-direction:column;max-width:430px;margin:0 auto;background:transparent;}

/* HEADER */
.hdr{
  background:rgba(255,255,255,0.82);
  backdrop-filter:blur(32px) saturate(180%);
  -webkit-backdrop-filter:blur(32px) saturate(180%);
  border-bottom:1px solid rgba(35,181,211,0.12);
  padding:calc(14px + env(safe-area-inset-top)) 18px 14px;
  position:sticky;top:0;z-index:50;
}
.hdr-inner{display:flex;align-items:center;justify-content:space-between;position:relative;}
.hdr-left{display:flex;align-items:center;gap:10px;}
.hdr-eyebrow{font-size:9px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#23B5D3;margin-bottom:2px;}
.hdr-date{font-size:19px;font-weight:700;color:#071013;letter-spacing:-0.02em;line-height:1.1;}
.hdr-right{display:flex;align-items:center;gap:8px;}
.gear-btn{width:34px;height:34px;border-radius:8px;background:rgba(35,181,211,0.08);border:1px solid rgba(35,181,211,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;transition:all 0.2s;}

/* HERO — keeps dark for contrast and drama */
.hero{border-radius:20px;padding:24px 20px 20px;margin-bottom:12px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(7,16,19,0.15);}
.hero-home{background:linear-gradient(145deg,#071013,#0D2030,#0F2D3A,#0A2540);}
.hero-travel{background:linear-gradient(145deg,#071013,#0A2030,#0F2840,#0A2035);}
.hero-saturday{background:linear-gradient(145deg,#071013,#0D1F18,#102818,#0F3020);}
.hero-sunday{background:linear-gradient(145deg,#12080A,#1A0A10,#200E14,#180C12);}
.hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}
.hero::after{content:"";position:absolute;top:-60px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(35,181,211,0.12),transparent 70%);animation:glow 4s ease-in-out infinite;}

/* POINTS */
.pts-row{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:16px;position:relative;z-index:1;}
.pts-num{font-size:76px;font-weight:900;color:#FFFFFF;line-height:1;letter-spacing:-0.05em;animation:countUp 0.5s ease;}
.pts-label{font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;}
.pts-right{text-align:right;padding-bottom:6px;}
.pts-icon{font-size:36px;line-height:1;display:block;}
.pts-streak{font-size:10px;font-weight:700;color:#23B5D3;margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;}
.h-prog-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;position:relative;z-index:1;}
.h-prog-label{font-size:9px;font-weight:800;color:rgba(255,255,255,0.4);letter-spacing:0.16em;text-transform:uppercase;}
.h-prog-pct{font-size:15px;font-weight:800;color:#23B5D3;}
.h-track{height:2px;background:rgba(255,255,255,0.1);overflow:hidden;margin-bottom:18px;position:relative;z-index:1;}
.h-fill{height:100%;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.h-fill-home{background:linear-gradient(90deg,#23B5D3,#75ABBC);}
.h-fill-travel{background:linear-gradient(90deg,#23B5D3,#75ABBC);}
.h-fill-saturday{background:linear-gradient(90deg,#23B5D3,#A2AEBB);}
.h-fill-sunday{background:linear-gradient(90deg,#75ABBC,#A2AEBB);}
.h-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.06);position:relative;z-index:1;border-radius:2px;overflow:hidden;}
.h-stat{background:rgba(0,0,0,0.3);padding:12px 10px;}
.h-stat-val{font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;}
.h-stat-lbl{font-size:8px;font-weight:800;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.14em;margin-top:3px;}

/* MODE BADGE */
.mode-badge{border-radius:12px;padding:10px 15px;margin-bottom:12px;display:flex;align-items:center;gap:10px;}
.mode-badge-sun{background:rgba(117,171,188,0.15);border:1px solid rgba(117,171,188,0.25);}
.mode-badge-sat{background:rgba(35,181,211,0.1);border:1px solid rgba(35,181,211,0.2);}
.mode-badge-travel{background:rgba(35,181,211,0.1);border:1px solid rgba(35,181,211,0.2);}
.mb-text{font-size:13px;font-weight:800;color:#071013;letter-spacing:0.04em;text-transform:uppercase;}
.mb-sub{font-size:11px;color:#4A7080;margin-top:2px;}

/* XP CARD */
.xp-card{background:rgba(255,255,255,0.85);border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:14px 18px;margin-bottom:12px;box-shadow:0 2px 12px rgba(7,16,19,0.06);}
.xp-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.xp-level{font-size:12px;font-weight:800;color:#071013;letter-spacing:0.08em;text-transform:uppercase;}
.xp-pts{font-size:12px;font-weight:600;color:#7A9AAA;letter-spacing:0.04em;}
.xp-track{height:3px;background:rgba(35,181,211,0.12);border-radius:100px;overflow:hidden;}
.xp-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#23B5D3,#75ABBC);transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}

/* SCRIPTURE */
.scripture-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.15);border-radius:14px;padding:18px;margin-bottom:12px;box-shadow:0 2px 12px rgba(7,16,19,0.05);}
.scripture-verse{font-size:14px;font-weight:400;color:#2A4050;line-height:1.75;font-style:italic;}
.scripture-ref{font-size:9px;font-weight:800;color:#23B5D3;margin-top:10px;letter-spacing:0.16em;text-transform:uppercase;}

/* DATE STRIP */
.date-strip{display:flex;gap:5px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:none;}
.date-strip::-webkit-scrollbar{display:none;}
.day-chip{display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0;width:42px;}
.day-chip-inner{width:42px;height:58px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:1px solid rgba(35,181,211,0.15);transition:all 0.15s;background:rgba(255,255,255,0.7);}
.day-chip-inner.today{border-color:#23B5D3;background:#EAF7FB;}
.day-chip-inner.viewing{border-color:#75ABBC;background:#EAF2F6;}
.day-chip-dow{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#7A9AAA;}
.day-chip-num{font-size:16px;font-weight:800;color:#071013;line-height:1;}
.day-chip-inner.today .day-chip-dow{color:#23B5D3;}
.day-chip-inner.today .day-chip-num{color:#071013;}
.day-chip-inner.viewing .day-chip-num{color:#23B5D3;}
.day-dot{width:4px;height:4px;border-radius:50%;margin-top:1px;}

/* SECTION HEADERS */
.sec{margin:22px 0 10px;display:flex;align-items:center;justify-content:space-between;}
.sec-title{font-size:11px;font-weight:800;color:#071013;letter-spacing:0.18em;text-transform:uppercase;}
.sec-sub{font-size:11px;color:#7A9AAA;letter-spacing:0.04em;}
.sec-btn{font-size:11px;font-weight:800;color:#23B5D3;background:none;border:none;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;}

/* CHECK CARD */
.check-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 12px rgba(7,16,19,0.06);}
.c-row{display:flex;align-items:center;gap:13px;padding:14px 16px;border-bottom:1px solid rgba(35,181,211,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.1s;}
.c-row:last-child{border-bottom:none;}
.c-row:active{background:rgba(35,181,211,0.04);}
.c-icon-bg{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;background:rgba(35,181,211,0.08);transition:all 0.25s;}
.c-icon-bg.done{background:rgba(35,181,211,0.15);}
.c-icon-bg.done-travel{background:rgba(117,171,188,0.15);}
.c-circle{width:24px;height:24px;border-radius:6px;border:2px solid #A2AEBB;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:#FFFFFF;}
.c-circle.done{background:#23B5D3;border-color:#23B5D3;}
.c-circle.done-travel{background:#75ABBC;border-color:#75ABBC;}
.c-circle.bounce{animation:bounceCheck 0.4s ease;}
.c-circle.done::after,.c-circle.done-travel::after{content:"✓";color:#FFFFFF;font-size:13px;font-weight:900;}
.c-body{flex:1;min-width:0;}
.c-main{font-size:15px;font-weight:600;color:#071013;line-height:1.25;transition:color 0.2s;}
.c-main.done{color:#A2AEBB;text-decoration:line-through;text-decoration-color:rgba(162,174,187,0.5);}
.c-hint{font-size:12px;color:#7A9AAA;margin-top:2px;line-height:1.4;}
.c-ts{font-size:9px;color:#A2AEBB;margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;}
.c-xp{font-size:12px;font-weight:800;color:#23B5D3;min-width:32px;text-align:right;}
.c-xp.travel{color:#75ABBC;}
.c-xp.done{color:#DFE0E2;}

/* TRAVEL TOGGLE */
.travel-toggle{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;transition:all 0.2s;}
.travel-toggle.off{background:rgba(35,181,211,0.08);color:#4A7080;border:1px solid rgba(35,181,211,0.15);}
.travel-toggle.on{background:#23B5D3;color:#FFFFFF;}

/* MODALS */
.modal-overlay{position:fixed;inset:0;background:rgba(7,16,19,0.6);z-index:200;display:flex;align-items:flex-end;}
.modal-sheet{background:#F5FAFB;border-radius:20px 20px 0 0;padding:28px 22px calc(40px + env(safe-area-inset-bottom));width:100%;max-height:90vh;overflow-y:auto;border-top:1px solid rgba(35,181,211,0.15);}
.modal-title{font-size:20px;font-weight:800;color:#071013;margin-bottom:6px;}
.modal-sub{font-size:13px;color:#4A7080;margin-bottom:20px;}
.modal-input{width:100%;background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.2);border-radius:10px;padding:14px 16px;font-size:16px;font-weight:500;color:#071013;outline:none;transition:all 0.2s;margin-bottom:12px;}
.modal-input:focus{border-color:#23B5D3;box-shadow:0 0 0 3px rgba(35,181,211,0.1);}
.modal-input::placeholder{color:#A2AEBB;}
.modal-btn{width:100%;padding:16px;border:none;border-radius:10px;background:#23B5D3;color:#FFFFFF;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase;}
.modal-cancel{width:100%;padding:12px;border:none;background:transparent;color:#7A9AAA;font-size:13px;cursor:pointer;margin-top:8px;}

/* EDITOR */
.editor-overlay{position:fixed;inset:0;background:rgba(7,16,19,0.7);z-index:300;display:flex;flex-direction:column;}
.editor-sheet{flex:1;background:#F5FAFB;overflow-y:auto;margin-top:env(safe-area-inset-top);}
.editor-hdr{background:#FFFFFF;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(35,181,211,0.12);position:sticky;top:0;z-index:10;}
.editor-title{font-size:14px;font-weight:800;color:#071013;letter-spacing:0.12em;text-transform:uppercase;}
.editor-close{background:#23B5D3;border:none;border-radius:8px;padding:8px 18px;color:#FFFFFF;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;}
.editor-body{padding:16px;}
.editor-item{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:10px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(7,16,19,0.05);}
.editor-item-row{display:flex;align-items:center;gap:10px;}
.editor-icon-input{width:42px;height:42px;background:#F0F8FA;border:1px solid rgba(35,181,211,0.15);border-radius:8px;text-align:center;font-size:20px;cursor:pointer;flex-shrink:0;}
.editor-text-inputs{flex:1;}
.editor-field{width:100%;background:#F5FAFB;border:1px solid rgba(35,181,211,0.15);border-radius:6px;padding:7px 10px;font-size:13px;font-weight:600;color:#071013;outline:none;margin-bottom:5px;transition:all 0.2s;}
.editor-field:last-child{margin-bottom:0;}
.editor-field:focus{border-color:#23B5D3;background:#FFFFFF;}
.editor-field.small{font-size:12px;font-weight:400;color:#4A7080;}
.editor-field::placeholder{color:#A2AEBB;}
.editor-xp{width:52px;background:#EAF7FB;border:1px solid rgba(35,181,211,0.2);border-radius:6px;padding:6px 8px;font-size:12px;font-weight:800;color:#23B5D3;text-align:center;outline:none;}
.editor-del{background:none;border:none;color:#A2AEBB;font-size:18px;cursor:pointer;padding:4px;flex-shrink:0;}
.editor-add-btn{width:100%;padding:13px;background:transparent;border:1.5px dashed rgba(35,181,211,0.3);border-radius:10px;color:#23B5D3;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.12em;text-transform:uppercase;margin-top:4px;}

/* HISTORY */
.history-banner{background:#EAF7FB;border:1px solid rgba(35,181,211,0.2);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.history-banner-text{font-size:12px;font-weight:800;color:#0D6B85;letter-spacing:0.08em;text-transform:uppercase;}
.history-banner-btn{font-size:11px;font-weight:800;color:#23B5D3;background:none;border:none;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;}

/* YEARMAP */
.yearmap-overlay{position:fixed;inset:0;background:rgba(7,16,19,0.7);z-index:200;display:flex;align-items:flex-end;}
.yearmap-sheet{background:#F5FAFB;border-radius:20px 20px 0 0;padding:24px 20px calc(40px + env(safe-area-inset-bottom));width:100%;max-height:85vh;overflow-y:auto;}
.yearmap-cell{width:26px;height:26px;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;}

/* GOALS */
.g-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);margin-bottom:10px;}
.g-card.complete{opacity:0.45;}
.g-hdr{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px;}
.g-dot{width:7px;height:7px;border-radius:2px;flex-shrink:0;margin-top:7px;}
.g-title{font-size:15px;font-weight:700;color:#071013;line-height:1.3;flex:1;}
.g-done{width:26px;height:26px;border-radius:6px;border:2px solid #A2AEBB;background:#FFFFFF;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#A2AEBB;font-size:11px;font-weight:800;transition:all 0.2s;flex-shrink:0;}
.g-done.done{background:#23B5D3;border-color:#23B5D3;color:#FFFFFF;}
.g-detail{font-size:12px;color:#4A7080;margin-bottom:9px;line-height:1.5;}
.g-tag{display:inline-flex;font-size:9px;font-weight:800;padding:3px 9px;border-radius:4px;margin-bottom:12px;letter-spacing:0.1em;text-transform:uppercase;}
.g-prog-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.g-prog-track{flex:1;height:3px;background:rgba(35,181,211,0.12);border-radius:100px;overflow:hidden;}
.g-prog-fill{height:100%;border-radius:100px;transition:width 0.4s;}
.g-prog-pct{font-size:13px;font-weight:800;color:#071013;width:36px;text-align:right;}
.g-slider{width:100%;-webkit-appearance:none;height:3px;background:rgba(35,181,211,0.12);border-radius:100px;outline:none;cursor:pointer;margin-bottom:10px;}
.g-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:6px;background:#23B5D3;cursor:pointer;box-shadow:0 2px 8px rgba(35,181,211,0.3);}
.g-note{width:100%;background:#F5FAFB;border:1px solid rgba(35,181,211,0.15);border-radius:8px;padding:10px 12px;font-size:13px;color:#071013;outline:none;resize:none;transition:all 0.2s;line-height:1.5;}
.g-note::placeholder{color:#A2AEBB;}
.g-note:focus{border-color:#23B5D3;background:#FFFFFF;}

/* DOMAIN GRID */
.d-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
.d-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.d-icon{font-size:20px;margin-bottom:8px;}
.d-lbl{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:#7A9AAA;margin-bottom:6px;}
.d-pct{font-size:32px;font-weight:900;letter-spacing:-0.03em;line-height:1;margin-bottom:8px;}
.d-bar{height:3px;background:rgba(35,181,211,0.1);border-radius:100px;overflow:hidden;}
.d-fill{height:100%;border-radius:100px;transition:width 0.8s;}

/* STAT CARD */
.stat-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(7,16,19,0.05);margin-bottom:12px;}
.s-row{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.s-row:last-child{border-bottom:none;}
.s-lbl{font-size:14px;color:#071013;}
.s-val{font-size:14px;font-weight:800;color:#23B5D3;}

/* ACHIEVEMENTS */
.ach-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px;}
.ach-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.1);border-radius:10px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:5px;opacity:0.25;transition:all 0.3s;box-shadow:0 1px 4px rgba(7,16,19,0.04);}
.ach-card.unlocked{opacity:1;border-color:rgba(35,181,211,0.3);background:#EAF7FB;}
.ach-icon{font-size:22px;line-height:1;}
.ach-name{font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#7A9AAA;text-align:center;line-height:1.3;}

/* CHIPS */
.chips{display:flex;gap:6px;margin-bottom:13px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{padding:7px 14px;border-radius:6px;border:1px solid rgba(35,181,211,0.2);background:#FFFFFF;color:#4A7080;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;transition:all 0.2s;letter-spacing:0.08em;text-transform:uppercase;}
.chip.active{border-color:var(--cc);color:var(--cc);background:rgba(35,181,211,0.06);}

/* MUSIC */
.music-hero{background:linear-gradient(145deg,#071013,#0D2030,#0F2D3A);border-radius:18px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(7,16,19,0.2);}
.music-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}
.album-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.album-bar{height:4px;background:rgba(35,181,211,0.1);border-radius:100px;overflow:hidden;margin-bottom:8px;}
.album-fill{height:100%;background:linear-gradient(90deg,#23B5D3,#75ABBC);border-radius:100px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.prac-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;}
.prac-card{background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.15);border-radius:12px;padding:16px 10px;text-align:center;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(7,16,19,0.05);}
.prac-card.logged{background:#EAF7FB;border-color:#23B5D3;}
.prac-card:active{transform:scale(0.97);}
.track-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(7,16,19,0.05);margin-bottom:8px;}
.track-card.priority{border-left:3px solid #23B5D3;}
.track-hdr{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.track-title{font-size:14px;font-weight:700;color:#071013;flex:1;cursor:pointer;}
.stage-sel{-webkit-appearance:none;background:#EAF7FB;border:1px solid rgba(35,181,211,0.2);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;color:#0D6B85;cursor:pointer;outline:none;}
.stage-sel.complete{background:#E8F5E9;border-color:rgba(56,142,60,0.3);color:#2E7D32;}
.track-bar{height:2px;background:rgba(35,181,211,0.1);overflow:hidden;margin-bottom:8px;border-radius:100px;}
.track-fill{height:100%;background:linear-gradient(90deg,#23B5D3,#75ABBC);border-radius:100px;transition:width 0.5s;}
.track-note{width:100%;background:#F5FAFB;border:none;border-radius:6px;padding:8px 10px;font-size:12px;color:#4A7080;outline:none;resize:none;line-height:1.4;}
.track-note:focus{outline:1px solid rgba(35,181,211,0.3);background:#FFFFFF;}

/* JOURNAL */
.journal-input{width:100%;background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.15);border-radius:14px;padding:16px 18px;font-size:15px;color:#071013;outline:none;resize:none;transition:all 0.2s;line-height:1.7;box-shadow:0 2px 8px rgba(7,16,19,0.04);}
.journal-input::placeholder{color:#A2AEBB;line-height:1.7;}
.journal-input:focus{border-color:#23B5D3;box-shadow:0 0 0 3px rgba(35,181,211,0.1);}
.jcal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.jcal-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;color:#4A7080;background:rgba(255,255,255,0.7);}
.jcal-cell.empty{visibility:hidden;}
.jcal-cell.has-entry{background:#23B5D3;color:#FFFFFF;font-weight:800;}
.jcal-cell.today-cell{border:2px solid #23B5D3;color:#071013;font-weight:800;background:#FFFFFF;}
.jcal-cell.today-cell.has-entry{border:none;}
.jcal-cell.future{opacity:0.25;cursor:default;}
.jcal-cell:not(.has-entry):not(.future):not(.empty):hover{background:rgba(35,181,211,0.1);}

/* PLANNER */
.plan-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.plan-priority-row{display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.plan-priority-row:last-child{border-bottom:none;}
.plan-num{width:26px;height:26px;border-radius:6px;background:#23B5D3;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:12px;font-weight:900;flex-shrink:0;}
.plan-input{flex:1;border:none;outline:none;font-size:15px;font-weight:500;color:#071013;background:transparent;}
.plan-input::placeholder{color:#A2AEBB;}

/* PLATFORM */
.platform-hero{background:linear-gradient(145deg,#071013,#0D1520,#101828,#0A1535);border-radius:18px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(7,16,19,0.2);}
.platform-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}

/* FINANCIAL */
.fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
.fin-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.fin-edit{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}

/* FRIENDS */
.friend-list{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.friend-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.friend-row:last-child{border-bottom:none;}
.friend-av{width:36px;height:36px;border-radius:8px;background:#23B5D3;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:14px;font-weight:800;flex-shrink:0;}

/* VISION */
.vision-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:18px;box-shadow:0 2px 10px rgba(7,16,19,0.05);margin-bottom:10px;}
.quote-hero{background:linear-gradient(145deg,#071013,#0D2030,#0F2D3A);border-radius:18px;padding:24px;margin-bottom:12px;position:relative;box-shadow:0 8px 32px rgba(7,16,19,0.2);}
.quote-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}

/* TENET */
.tenet-row{display:flex;align-items:flex-start;gap:13px;padding:12px 0;border-bottom:1px solid rgba(35,181,211,0.08);}
.tenet-row:last-child{border-bottom:none;}
.tenet-s{font-size:18px;font-weight:900;color:#23B5D3;width:22px;flex-shrink:0;line-height:1.2;}

/* TODO */
.todo-input-row{display:flex;gap:8px;margin-bottom:10px;}
.todo-input{flex:1;background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.15);border-radius:10px;padding:12px 14px;font-size:15px;color:#071013;outline:none;transition:all 0.2s;box-shadow:0 2px 6px rgba(7,16,19,0.04);}
.todo-input::placeholder{color:#A2AEBB;}
.todo-input:focus{border-color:#23B5D3;}
.todo-add-btn{width:46px;height:46px;border-radius:10px;background:#23B5D3;border:none;color:#FFFFFF;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:300;box-shadow:0 4px 12px rgba(35,181,211,0.3);}
.todo-circle{width:22px;height:22px;border-radius:6px;border:2px solid #A2AEBB;flex-shrink:0;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;background:#FFFFFF;}
.todo-circle.done{background:#23B5D3;border-color:#23B5D3;}
.todo-circle.done::after{content:"✓";color:#FFFFFF;font-size:11px;font-weight:900;}
.todo-del{background:none;border:none;color:#A2AEBB;font-size:18px;cursor:pointer;padding:4px;}

/* FORMS */
.add-form{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:18px;margin-bottom:14px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.field{width:100%;background:#F5FAFB;border:1.5px solid rgba(35,181,211,0.15);border-radius:10px;padding:12px 14px;font-size:15px;color:#071013;outline:none;margin-bottom:8px;transition:all 0.2s;}
.field::placeholder{color:#A2AEBB;}
.field:focus{border-color:#23B5D3;background:#FFFFFF;box-shadow:0 0 0 3px rgba(35,181,211,0.08);}
select.field{-webkit-appearance:none;cursor:pointer;}
.btn-row{display:flex;gap:8px;}
.btn-p{flex:1;padding:13px;background:#23B5D3;border:none;border-radius:8px;color:#FFFFFF;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase;box-shadow:0 4px 12px rgba(35,181,211,0.25);}
.btn-s{flex:1;padding:13px;background:#F5FAFB;border:1px solid rgba(35,181,211,0.15);border-radius:8px;color:#4A7080;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.04em;}

/* BOTTOM NAV */
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(245,250,251,0.92);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-top:1px solid rgba(35,181,211,0.15);display:flex;z-index:50;padding:8px 0 calc(8px + env(safe-area-inset-bottom));box-shadow:0 -4px 20px rgba(7,16,19,0.08);}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 1px;cursor:pointer;border:none;background:transparent;color:#A2AEBB;transition:color 0.2s;}
.nav-btn.active{color:#23B5D3;}
.nav-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
.nav-lbl{font-size:7px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}

/* TOAST */
.toast{position:fixed;top:calc(80px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:#071013;border:1px solid rgba(35,181,211,0.3);border-radius:8px;padding:10px 20px;font-size:12px;font-weight:800;color:#23B5D3;z-index:300;white-space:nowrap;letter-spacing:0.08em;text-transform:uppercase;animation:fadeUp 0.3s ease;box-shadow:0 4px 20px rgba(7,16,19,0.3);}

/* FOOTER */
.col323-footer{text-align:center;padding:20px 20px 8px;}
.col323-verse{font-size:11px;font-style:italic;color:#7A9AAA;line-height:1.7;}
.col323-ref{font-size:9px;font-weight:800;color:#23B5D3;letter-spacing:0.14em;text-transform:uppercase;margin-top:5px;}

.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:#071013;}
.scroll{flex:1;overflow-y:auto;padding:14px 15px 110px;}
.r-tabs{display:flex;background:rgba(255,255,255,0.8);border:1px solid rgba(35,181,211,0.15);border-radius:10px;padding:4px;gap:3px;margin-bottom:14px;}
.r-tab{flex:1;padding:9px 4px;border:none;background:transparent;border-radius:7px;font-size:10px;font-weight:800;color:#7A9AAA;cursor:pointer;transition:all 0.2s;letter-spacing:0.1em;text-transform:uppercase;}
.r-tab.active{background:#23B5D3;color:#FFFFFF;box-shadow:0 2px 8px rgba(35,181,211,0.25);}
.prompt-card{background:#EAF7FB;border:1px solid rgba(35,181,211,0.2);border-radius:12px;padding:13px 15px;margin-bottom:12px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.15s;}
.prompt-card:active{transform:scale(0.99);}
.trip-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.trip-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.trip-row:last-child{border-bottom:none;}
/* CATEGORIES */
.cat-pills{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;scrollbar-width:none;}
.cat-pills::-webkit-scrollbar{display:none;}
.cat-pill{display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:100px;border:1.5px solid rgba(35,181,211,0.2);background:#FFFFFF;color:#4A7080;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;}
.cat-pill.active{border-color:#23B5D3;background:#EAF7FB;color:#071013;}
.cat-pill-count{background:#23B5D3;color:#FFFFFF;font-size:9px;font-weight:800;border-radius:100px;padding:1px 6px;min-width:16px;text-align:center;}
.cat-add-form{display:flex;gap:8px;margin-bottom:10px;align-items:center;}
.cat-name-input{flex:1;background:#FFFFFF;border:1.5px solid #23B5D3;border-radius:10px;padding:10px 14px;font-size:14px;color:#071013;outline:none;}
.cat-name-input::placeholder{color:#A2AEBB;}
.cat-add-confirm{padding:10px 16px;background:#23B5D3;border:none;border-radius:8px;color:#FFFFFF;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;letter-spacing:0.06em;text-transform:uppercase;}
.cat-add-cancel{padding:10px;background:none;border:none;color:#A2AEBB;font-size:16px;cursor:pointer;}
.cat-section{margin-bottom:4px;}
.cat-header{display:flex;align-items:center;gap:8px;padding:11px 16px;background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;cursor:pointer;transition:all 0.15s;box-shadow:0 1px 4px rgba(7,16,19,0.04);}
.cat-section:has(.check-card) .cat-header{border-radius:14px 14px 0 0;border-bottom:none;}
.cat-header:active{background:#F5FAFB;}
.cat-chevron{flex-shrink:0;transition:transform 0.2s ease;display:flex;align-items:center;}
.cat-header-name{font-size:13px;font-weight:700;color:#071013;letter-spacing:0.02em;}
.cat-rename-input{flex:1;border:none;border-bottom:2px solid #23B5D3;background:transparent;font-size:13px;font-weight:700;color:#071013;outline:none;padding-bottom:2px;}
.cat-collapsed-badge{font-size:10px;font-weight:700;color:#7A9AAA;background:rgba(35,181,211,0.08);padding:3px 8px;border-radius:100px;white-space:nowrap;}
.cat-clear-btn{font-size:10px;font-weight:800;color:#A2AEBB;background:none;border:none;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;}
.cat-del-btn{font-size:14px;color:#A2AEBB;background:none;border:none;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;}
.cat-del-btn:hover{color:#EF4444;}

`;


// ── MAIN APP ──────────────────────────────────────────────────────────
export default function App() {
  const [splashDone,  setSplashDone]  = useState(false);
  const [tab,         setTab]         = useState("today");
  const [rhythmTab,   setRhythmTab]   = useState("weekly");
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);
  const [toastKey,    setToastKey]    = useState(0);
  const [xpFloat,     setXpFloat]     = useState(null);
  const [showConfetti,setConfetti]    = useState(false);
  const [bouncing,    setBouncing]    = useState(null);
  const confettiShown                 = useRef(false);

  // Travel
  const [travelMode,  setTravelMode]  = useState(false);
  const [travelDest,  setTravelDest]  = useState("");
  const [showTM,      setShowTM]      = useState(false);
  const [tempDest,    setTempDest]    = useState("");
  const [tripLog,     setTripLog]     = useState([]);

  // History / date view
  const [viewDate,    setViewDate]    = useState(null);
  const [history,     setHistory]     = useState({});
  const [showYearMap, setShowYearMap] = useState(false);

  // Editor
  const [editorOpen,  setEditorOpen]  = useState(false);
  const [editorTab,   setEditorTab]   = useState("weekday");
  const [editLists,   setEditLists]   = useState(null);

  // Day states — keyed by getDayKey(date,mode)
  const [dayStates,   setDayStates]   = useState({});
  const [weeklyState, setWeeklyState] = useState({});
  const [monthlyState,setMonthlyState]= useState({});
  const [annualState, setAnnualState] = useState({});
  const [ijmState,    setIjmState]    = useState({});
  const [platState,   setPlatState]   = useState({});
  const [customLists, setCustomLists] = useState(null);

  // Goals / music / journal / planner
  const [goals,       setGoals]       = useState(DEFAULT_GOALS);
  const [tracks,      setTracks]      = useState([
    {id:"t0",title:"Track 01",stage:"Recording",priority:true,notes:""},
    {id:"t1",title:"Track 02",stage:"Demo",priority:false,notes:""},
    {id:"t2",title:"Track 03",stage:"Written",priority:false,notes:""},
    {id:"t3",title:"Track 04",stage:"Demo",priority:false,notes:""},
    {id:"t4",title:"Track 05",stage:"Written",priority:false,notes:""},
    {id:"t5",title:"Track 06",stage:"Written",priority:false,notes:""},
    {id:"t6",title:"Track 07",stage:"Not Started",priority:false,notes:""},
    {id:"t7",title:"Track 08",stage:"Not Started",priority:false,notes:""},
    {id:"t8",title:"Track 09",stage:"Not Started",priority:false,notes:""},
    {id:"t9",title:"Track 10",stage:"Not Started",priority:false,notes:""},
  ]);
  const [practiceLogs,setPracticeLogs]= useState({});
  const [activeInstr, setActiveInstr] = useState("Bass");
  const [churchRoster,setChurchRoster]= useState(false);
  const [journal,     setJournal]     = useState({});
  const [journalInput,setJournalInput]= useState("");
  const [jViewDate,   setJViewDate]   = useState(null);
  const [jMonth,      setJMonth]      = useState({y:new Date().getFullYear(),m:new Date().getMonth()+1});
  const [weekPlan,    setWeekPlan]    = useState({top3:["","",""],intention:"",gratitude:"",carryForward:""});
  const [planArchive, setPlanArchive] = useState({});
  const [viewPlanWeek,setViewPlanWeek]= useState(null);
  const [friendLog,   setFriendLog]   = useState([]);
  const [friendInput, setFriendInput] = useState({name:"",note:""});
  const [showFF,      setShowFF]      = useState(false);
  const [financials,  setFinancials]  = useState({debtStart:50000,debtCurrent:50000,savingsTarget:100000,savingsCurrent:0});
  const [showFinForm, setShowFinForm] = useState(false);
  const [todos,       setTodos]       = useState([]);
  const [todoInput,   setTodoInput]   = useState("");
  const [categories,  setCategories]  = useState([{id:"cat-default",name:"General",collapsed:false}]);
  const [activeCatId, setActiveCatId] = useState("cat-default");
  const [addingCat,   setAddingCat]   = useState(false);
  const [newCatName,  setNewCatName]  = useState("");
  const [editCatId,   setEditCatId]   = useState(null);
  const [totalXP,     setTotalXP]     = useState(0);
  const [streaks,     setStreaks]     = useState({current:0,longest:0,lastDate:null,totalDays:0,sabbaths:0,practiceSessions:0,friendDinners:0,tripCount:0});
  // ── Engagement layer: stakes streaks, grace tokens, rest day, lesson toggle, milestones ──
  const [healthStreak, setHealthStreak] = useState({current:0,longest:0,lastDate:null});
  const [graceTokens,  setGraceTokens]  = useState(0);
  const [graceAccruedWeek, setGraceAccruedWeek] = useState(null);
  const [restDayToday, setRestDayToday] = useState(false);
  const [lessonThisWeek, setLessonThisWeek] = useState(false);
  const [milestoneAck, setMilestoneAck] = useState({main:0,health:0}); // highest milestone day already shown
  const [milestoneQueue, setMilestoneQueue] = useState([]); // pending splash celebrations
  const [avatar,      setAvatar]      = useState(null);   // base64 data URL
  // Health
  const [proteinLog,  setProteinLog]  = useState([]);   // [{id,label,grams,at}] — today only
  const [workoutLog,  setWorkoutLog]  = useState({});   // {dateKey: {type,at}}
  const [proteinTarget] = useState(200);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarInputRef = useRef(null);
  const [unlockedAch, setUnlockedAch] = useState({});
  const [domainFilter,setDomainFilter]= useState("all");
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal,     setNewGoal]     = useState({title:"",detail:"",domain:"family",target:""});
  const [editingGoal, setEditingGoal] = useState(null);
  const [editGoalData,setEditGoalData]= useState({});

  const showToast = useCallback((msg) => {
    setToast(msg); setToastKey(k=>k+1);
    const t = setTimeout(()=>setToast(null),2700);
    return ()=>clearTimeout(t);
  },[]);

  // ── LOAD ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    async function loadAll() {
      const today = todayKey();
      const mode  = getModeForDate(today);
      const dkey  = getDayKey(today, mode);
      try {
        const results = await Promise.all([
          load(dkey), load(`cl-weekly-${weekKey()}`), load(`cl-monthly-${monthKey()}`),
          load(`cl-annual-${yearKey()}`), load(`cl-ijm-${weekKey()}`), load(`cl-platform-${monthKey()}`),
          load("wb-goals-v5"), load("wb-tracks-v3"), load(`wb-prac-${weekKey()}`),
          load(`wb-church-${weekKey()}`), load("wb-friends-v2"), load("wb-fin-v2"),
          load("wb-totalxp"), load("wb-streaks-v4"), load("wb-ach-v3"),
          load("wb-trips-v1"), load("wb-travel-mode"), load("wb-travel-dest"),
          load(`wb-journal-${yearKey()}`), load(`wb-weekplan-${weekKey()}`),
          load("wb-planarchive"), load("wb-todos-v1"), load("wb-custom-lists"),
          load(`wb-history-${yearKey()}`),
        ]);
        const [ds,ws,ms,as,ij,plt,g,tr,pl,cr,fl,fin,xp,s,ach,tl,tm,dest,jrnl,wp,pa,tod,cl,hist] = results;
        if(ds)  setDayStates(p=>({...p,[dkey]:ds}));
        if(ws)  setWeeklyState(ws); if(ms)  setMonthlyState(ms);
        if(as)  setAnnualState(as); if(ij)  setIjmState(ij);
        if(plt) setPlatState(plt);  if(g)   setGoals(g);
        if(tr)  setTracks(tr);      if(pl)  setPracticeLogs(pl);
        if(cr!==null) setChurchRoster(cr); if(fl) setFriendLog(fl);
        if(fin) setFinancials(fin); if(xp)  setTotalXP(xp);
        if(s)   setStreaks(s);      if(ach) setUnlockedAch(ach);
        if(tl)  setTripLog(tl);    if(tm)  setTravelMode(tm);
        if(dest)setTravelDest(dest);
        // If travel mode was active, also load the travel checklist for today
        if(tm) {
          const travelKey = getDayKey(today, "travel");
          const travelDs = await load(travelKey);
          if(travelDs) setDayStates(p=>({...p,[travelKey]:travelDs}));
        }
        if(jrnl){setJournal(jrnl);setJournalInput(jrnl[today]||"");}
        if(wp)  setWeekPlan(wp);   if(pa)  setPlanArchive(pa);
        if(tod) setTodos(tod);     if(cl)  setCustomLists(cl);
        if(hist)setHistory(hist);
        const av = await load("wb-avatar"); if(av) setAvatar(av);
        const cats = await load("wb-categories-v1");
        const proteinData = await load(`wb-protein-${todayKey()}`); if(proteinData) setProteinLog(proteinData);
        const workoutData = await load(`wb-workouts-${weekKey()}`); if(workoutData) setWorkoutLog(workoutData);
        if(cats && cats.length>0) setCategories(cats);

        // ── Engagement layer ──
        const hs = await load("wb-health-streak"); if(hs) setHealthStreak(hs);
        const mAck = await load("wb-milestone-ack"); if(mAck) setMilestoneAck(mAck);
        const restDay = await load(`wb-restday-${today}`); if(restDay) setRestDayToday(true);
        const lesson = await load(`wb-lesson-${weekKey()}`); if(lesson) setLessonThisWeek(true);

        // Weekly grace-token accrual — grant +1 the first time this week is seen.
        let tokens = (await load("wb-grace-tokens")) || 0;
        const accruedWeek = await load("wb-grace-week");
        if(accruedWeek !== weekKey()){
          tokens = accrueGraceToken(tokens, GRACE_TOKENS_PER_WEEK);
          await save("wb-grace-tokens", tokens);
          await save("wb-grace-week", weekKey());
        }
        setGraceTokens(tokens);
        setGraceAccruedWeek(weekKey());
      } catch(e){console.error("Load error:",e);}
      setLoading(false);
    }
    loadAll();
  },[]);

  // ── DERIVED STATE ────────────────────────────────────────────────────
  const today     = todayKey();
  const todayMode = travelMode ? "travel" : getModeForDate(today);
  const dkey      = getDayKey(today, todayMode);
  const lists     = customLists || DEFAULT_LISTS;
  const todayItemsRaw = lists[todayMode] || lists.weekday;
  // Saturday's music-practice item is a lesson-off-week bonus opportunity —
  // hidden entirely on weeks where the lesson toggle is on.
  const todayItems = todayItemsRaw.filter(i=>!(i.cat==="music"&&lessonThisWeek));
  const todayState= dayStates[dkey] || {};
  const coreItems = todayItems.filter(i=>i.w==="core"||!i.w); // items with no weight tag default to core (safety net for custom/edited items)
  const coreDone  = (state)=>coreItems.every(i=>state[i.id]?.checked);
  const healthCoreItems = coreItems.filter(i=>i.cat==="health");
  const healthCoreDone  = (state)=>healthCoreItems.length===0||healthCoreItems.every(i=>state[i.id]?.checked);

  const todayPts  = todayItems.reduce((s,i)=>s+(todayState[i.id]?.checked?i.xp:0),0);
  const todayMax  = todayItems.reduce((s,i)=>s+i.xp,0);
  const todayPct  = todayMax>0?Math.round(todayPts/todayMax*100):0;

  const weeklyItems= lists.weekly||DEFAULT_LISTS.weekly;
  const weeklyMax  = weeklyItems.reduce((s,i)=>s+i.xp,0);
  const weeklyPts  = weeklyItems.reduce((s,i)=>s+(weeklyState[i.id]?.checked?i.xp:0),0);
  const weeklyPct  = weeklyMax>0?Math.round(weeklyPts/weeklyMax*100):0;
  const platItems  = lists.platform||DEFAULT_LISTS.platform;
  const completedTracks = tracks.filter(t=>t.stage==="Complete").length;
  const albumProgress   = Math.round(tracks.reduce((s,t)=>s+(STAGE_PCT[t.stage]||0),0)/tracks.length);
  const goalsComplete   = goals.filter(g=>g.completed).length;
  const debtPct  = financials.debtStart>0?Math.round(((financials.debtStart-financials.debtCurrent)/financials.debtStart)*100):0;
  const savPct   = financials.savingsTarget>0?Math.min(100,Math.round((financials.savingsCurrent/financials.savingsTarget)*100)):0;
  const domainProgress = Object.keys(DOMAIN_CFG).reduce((acc,d)=>{
    const dg=goals.filter(g=>g.domain===d); acc[d]=dg.length?Math.round(dg.reduce((s,g)=>s+(g.progress||0),0)/dg.length):0; return acc;
  },{});
  const stats = {totalXP,streak:streaks.current,totalDays:streaks.totalDays||0,sabbaths:streaks.sabbaths||0,goalsComplete,practiceSessions:streaks.practiceSessions||0,friendDinners:streaks.friendDinners||0,tripCount:streaks.tripCount||0};
  const levelInfo = getLevelInfo(totalXP);
  const scripture = getDailyScripture();
  const wkSessions = Object.keys(practiceLogs).length;
  const filteredGoals = domainFilter==="all"?goals:goals.filter(g=>g.domain===domainFilter);
  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const pastDays = getPastDays(30).reverse();

  // Achievements
  useEffect(()=>{
    if(loading)return;
    const nu={...unlockedAch};let changed=false;
    ACHIEVEMENTS.forEach(a=>{if(!nu[a.id]&&a.check(stats)){nu[a.id]=true;changed=true;showToast(`🏆 ${a.title} unlocked!`);}});
    if(changed){setUnlockedAch(nu);save("wb-ach-v3",nu);}
  },[totalXP,streaks.current,goalsComplete]);

  // Confetti
  useEffect(()=>{
    if(todayPct===100&&!confettiShown.current){confettiShown.current=true;setConfetti(true);setTimeout(()=>setConfetti(false),3500);}
    if(todayPct<100)confettiShown.current=false;
  },[todayPct]);

  // ── WRITE HISTORY ────────────────────────────────────────────────────
  const writeHistory = useCallback(async(dateStr,newState,items)=>{
    const pts=items.reduce((s,i)=>s+(newState[i.id]?.checked?i.xp:0),0);
    const maxPts=items.reduce((s,i)=>s+i.xp,0);
    const pct=maxPts>0?Math.round(pts/maxPts*100):0;
    setHistory(p=>{const nh={...p,[dateStr]:{pts,maxPts,pct,at:new Date().toISOString()}};save(`wb-history-${yearKey()}`,nh);return nh;});
  },[]);

  // ── TOGGLE HANDLER ───────────────────────────────────────────────────
  const handleToggle = useCallback(async(itemId,item,_state)=>{
    const isPast = viewDate && viewDate!==today;
    const dateForOp = isPast?viewDate:today;
    const modeForOp = isPast?getModeForDate(dateForOp):todayMode;
    const key = getDayKey(dateForOp,modeForOp);
    const curState = dayStates[key]||{};
    const nowChecked = !curState[itemId]?.checked;
    const ns = {...curState,[itemId]:{checked:nowChecked,at:new Date().toISOString()}};
    setDayStates(p=>({...p,[key]:ns}));
    await save(key,ns);
    const items = lists[modeForOp]||lists.weekday;
    await writeHistory(dateForOp,ns,items);
    const nxp = Math.max(0,totalXP+(nowChecked?item.xp:-item.xp));
    setTotalXP(nxp); await save("wb-totalxp",nxp);
    if(nowChecked){setBouncing(itemId);setTimeout(()=>setBouncing(null),450);setXpFloat(item.xp);setTimeout(()=>setXpFloat(null),1300);}
    // Stakes streaks — core tasks only (bonus tasks never gate a streak).
    // Only evaluated for today, not past-day edits.
    if(!isPast){
      const coreSatisfied = coreDone(ns);
      const healthSatisfied = healthCoreDone(ns);
      let tokensLeft = graceTokens;
      let runningXP = nxp;
      const newMilestones = [];

      // Main streak
      const mainAdvance = resolveStreakAdvance({streak:streaks,today,coreSatisfied,isRestDay:restDayToday,availableTokens:tokensLeft});
      if(mainAdvance){
        tokensLeft -= mainAdvance.tokensSpent;
        const sabbBonus = modeForOp==="sunday"?1:0;
        const nst = {...streaks,...mainAdvance.streak,totalDays:(streaks.totalDays||0)+1,sabbaths:(streaks.sabbaths||0)+sabbBonus};
        setStreaks(nst); await save("wb-streaks-v4",nst);
        const bonus = 50 + mainAdvance.streak.current*10;
        runningXP = runningXP + bonus; setTotalXP(runningXP); await save("wb-totalxp",runningXP);
        showToast(`${mainAdvance.streak.current>1?`🔥 ${mainAdvance.streak.current}-day streak!`:"🏆 Day complete!"} +${bonus} bonus pts`);
        const ms = checkMilestone(streaks.current, mainAdvance.streak.current, milestoneAck.main);
        if(ms) newMilestones.push({...ms,streakId:"main",streakLabel:"Main streak"});
      }

      // Health streak (shares the same grace-token pool)
      const healthAdvance = resolveStreakAdvance({streak:healthStreak,today,coreSatisfied:healthSatisfied,isRestDay:restDayToday,availableTokens:tokensLeft});
      if(healthAdvance){
        tokensLeft -= healthAdvance.tokensSpent;
        setHealthStreak(healthAdvance.streak); await save("wb-health-streak",healthAdvance.streak);
        const ms = checkMilestone(healthStreak.current, healthAdvance.streak.current, milestoneAck.health);
        if(ms) newMilestones.push({...ms,streakId:"health",streakLabel:"Health streak"});
      }

      if(tokensLeft!==graceTokens){ setGraceTokens(tokensLeft); await save("wb-grace-tokens",tokensLeft); }

      if(newMilestones.length>0){
        const nextAck = {...milestoneAck};
        newMilestones.forEach(m=>{ nextAck[m.streakId] = m.day; });
        setMilestoneAck(nextAck); await save("wb-milestone-ack",nextAck);
        setMilestoneQueue(q=>[...q,...newMilestones]);
      }
    }
  },[viewDate,today,todayMode,totalXP,streaks,healthStreak,graceTokens,restDayToday,milestoneAck,dayStates,lists,travelMode,writeHistory,coreDone,healthCoreDone]);

  // ── REST DAY TOGGLE ──────────────────────────────────────────────────
  // Preserves both stakes streaks outright, for free (no grace token spent),
  // without requiring any core task to be completed. Resets automatically
  // each day since it's stored under a day-keyed save key.
  const toggleRestDay = useCallback(async()=>{
    const next = !restDayToday;
    setRestDayToday(next);
    await save(`wb-restday-${today}`, next);
    if(next){
      const mainAdvance = resolveStreakAdvance({streak:streaks,today,coreSatisfied:false,isRestDay:true,availableTokens:graceTokens});
      if(mainAdvance){ setStreaks(s=>({...s,...mainAdvance.streak})); await save("wb-streaks-v4",{...streaks,...mainAdvance.streak}); }
      const healthAdvance = resolveStreakAdvance({streak:healthStreak,today,coreSatisfied:false,isRestDay:true,availableTokens:graceTokens});
      if(healthAdvance){ setHealthStreak(healthAdvance.streak); await save("wb-health-streak",healthAdvance.streak); }
      showToast("😴 Rest day — streaks protected");
    }
  },[restDayToday,today,streaks,healthStreak,graceTokens]);

  // ── LESSON-THIS-WEEK TOGGLE ──────────────────────────────────────────
  const toggleLessonWeek = useCallback(async()=>{
    const next = !lessonThisWeek;
    setLessonThisWeek(next);
    await save(`wb-lesson-${weekKey()}`, next);
  },[lessonThisWeek]);

  // ── MILESTONE SPLASH DISMISSAL ───────────────────────────────────────
  const dismissMilestone = useCallback(()=>{
    setMilestoneQueue(q=>q.slice(1));
  },[]);

  const makeToggler = useCallback((stateSetter,saveKey,stateRef)=>async(itemId,item)=>{
    const cur=stateRef[itemId]; const nowChecked=!cur?.checked;
    const ns={...stateRef,[itemId]:{checked:nowChecked,at:new Date().toISOString()}};
    stateSetter(ns); await save(saveKey,ns);
    const nxp=Math.max(0,totalXP+(nowChecked?item.xp:-item.xp)); setTotalXP(nxp); await save("wb-totalxp",nxp);
    if(nowChecked){setBouncing(itemId);setTimeout(()=>setBouncing(null),450);setXpFloat(item.xp);setTimeout(()=>setXpFloat(null),1300);}
  },[totalXP]);

  const handleWeekly = useCallback((id,item)=>makeToggler(setWeeklyState,`cl-weekly-${weekKey()}`,weeklyState)(id,item),[weeklyState,makeToggler]);
  const handleMonthly= useCallback((id,item)=>makeToggler(setMonthlyState,`cl-monthly-${monthKey()}`,monthlyState)(id,item),[monthlyState,makeToggler]);
  const handleAnnual = useCallback((id,item)=>makeToggler(setAnnualState,`cl-annual-${yearKey()}`,annualState)(id,item),[annualState,makeToggler]);
  const handleIjm    = useCallback((id,item)=>makeToggler(setIjmState,`cl-ijm-${weekKey()}`,ijmState)(id,item),[ijmState,makeToggler]);
  const handlePlat   = useCallback((id,item)=>makeToggler(setPlatState,`cl-platform-${monthKey()}`,platState)(id,item),[platState,makeToggler]);

  // ── VIEW PAST DAY ────────────────────────────────────────────────────
  const viewPastDay = useCallback(async(ds)=>{
    if(ds===today){setViewDate(null);return;}
    setViewDate(ds);
    const key=getDayKey(ds,getModeForDate(ds));
    if(!dayStates[key]){const d=await load(key)||{};setDayStates(p=>({...p,[key]:d}));}
  },[today,dayStates]);

  // ── TRAVEL ───────────────────────────────────────────────────────────
  const enableTravel=async()=>{
    if(!tempDest.trim())return;
    setTravelMode(true);setTravelDest(tempDest.trim());setShowTM(false);
    const trip={id:`trip-${Date.now()}`,dest:tempDest.trim(),start:new Date().toISOString()};
    const nl=[trip,...tripLog];setTripLog(nl);await save("wb-trips-v1",nl);
    await save("wb-travel-mode",true);await save("wb-travel-dest",tempDest.trim());
    const nst={...streaks,tripCount:(streaks.tripCount||0)+1};setStreaks(nst);await save("wb-streaks-v4",nst);
    const tkey=getDayKey(today,"travel");if(!dayStates[tkey]){const d=await load(tkey)||{};setDayStates(p=>({...p,[tkey]:d}));}
    setTempDest("");showToast(`✈️ Travel mode — ${tempDest.trim()}`);
  };
  const disableTravel=async()=>{setTravelMode(false);setTravelDest("");await save("wb-travel-mode",false);await save("wb-travel-dest","");showToast("🏠 Home mode restored");};

  // ── AVATAR ────────────────────────────────────────────────────────
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      // Resize to 200px max via canvas
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX = 200;
        const scale = Math.min(MAX/img.width, MAX/img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setAvatar(dataUrl);
        await save("wb-avatar", dataUrl);
        showToast("Photo updated");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    setShowAvatarMenu(false);
  };

  const removeAvatar = async () => {
    setAvatar(null);
    await save("wb-avatar", null);
    setShowAvatarMenu(false);
    showToast("Photo removed");
  };

  // ── EDITOR ───────────────────────────────────────────────────────────
  const openEditor=()=>{setEditLists(JSON.parse(JSON.stringify(customLists||DEFAULT_LISTS)));setEditorOpen(true);};
  const saveEditor=async()=>{setCustomLists(editLists);await save("wb-custom-lists",editLists);setEditorOpen(false);showToast("✅ Checklists saved");};
  const addEditorItem=(lk)=>setEditLists(p=>({...p,[lk]:[...(p[lk]||[]),{id:`c-${Date.now()}`,text:"New item",sub:"Description",xp:10,icon:"⭐"}]}));
  const updEditorItem=(lk,idx,field,val)=>setEditLists(p=>{const l=[...(p[lk]||[])];l[idx]={...l[idx],[field]:field==="xp"?parseInt(val)||0:val};return{...p,[lk]:l};});
  const delEditorItem=(lk,idx)=>setEditLists(p=>({...p,[lk]:p[lk].filter((_,i)=>i!==idx)}));

  // ── MUSIC ────────────────────────────────────────────────────────────
  const logPractice=async()=>{
    const key=`s-${Date.now()}`;const nl={...practiceLogs,[key]:{instrument:activeInstr,at:new Date().toISOString()}};
    setPracticeLogs(nl);await save(`wb-prac-${weekKey()}`,nl);
    const nst={...streaks,practiceSessions:(streaks.practiceSessions||0)+1};setStreaks(nst);await save("wb-streaks-v4",nst);
    const nxp=totalXP+10;setTotalXP(nxp);await save("wb-totalxp",nxp);
    setXpFloat(10);setTimeout(()=>setXpFloat(null),1300);showToast(`🎸 ${activeInstr} logged +10 pts`);
  };
  const updateTrack=async(idx,changes)=>{const u=tracks.map((t,i)=>i===idx?{...t,...changes}:t);setTracks(u);await save("wb-tracks-v3",u);};

  // ── JOURNAL ──────────────────────────────────────────────────────────
  const saveJournalEntry=async(text)=>{
    setJournalInput(text);
    const upd={...journal,[today]:text};setJournal(upd);await save(`wb-journal-${yearKey()}`,upd);
  };

  // ── GOALS ────────────────────────────────────────────────────────────
  const toggleGoalDone=async(id)=>{const g=goals.find(x=>x.id===id);const u=goals.map(x=>x.id===id?{...x,completed:!x.completed,progress:!x.completed?100:x.progress}:x);setGoals(u);await save("wb-goals-v5",u);if(!g.completed){const nxp=totalXP+100;setTotalXP(nxp);await save("wb-totalxp",nxp);showToast("🎯 Goal complete! +100 pts");}};
  const updateGoalProgress=(id,progress)=>setGoals(g=>g.map(x=>x.id===id?{...x,progress}:x));
  const saveGoalProgress=async()=>await save("wb-goals-v5",goals);
  const updateGoalNote=async(id,notes)=>{const u=goals.map(g=>g.id===id?{...g,notes}:g);setGoals(u);await save("wb-goals-v5",u);};
  const addGoal=async()=>{if(!newGoal.title.trim())return;const g={...newGoal,id:`c-${Date.now()}`,progress:0};const u=[...goals,g];setGoals(u);await save("wb-goals-v5",u);setNewGoal({title:"",detail:"",domain:"family",target:""});setShowAddGoal(false);showToast("Goal added");};
  const saveEditGoal=async()=>{const u=goals.map(g=>g.id===editingGoal?{...g,...editGoalData}:g);setGoals(u);await save("wb-goals-v5",u);setEditingGoal(null);};
  const deleteGoal=async(id)=>{const u=goals.filter(g=>g.id!==id);setGoals(u);await save("wb-goals-v5",u);};

  // ── PLANNER ──────────────────────────────────────────────────────────
  const saveWeekPlan=async(upd)=>{
    setWeekPlan(upd);await save(`wb-weekplan-${weekKey()}`,upd);
    setHistory(null); // keep archive separate
    const na={...planArchive,[weekKey()]:{...upd,savedAt:new Date().toISOString()}};setPlanArchive(na);await save("wb-planarchive",na);
  };

  // ── FRIENDS ──────────────────────────────────────────────────────────
  const addFriend=async()=>{if(!friendInput.name.trim())return;const e={id:`f-${Date.now()}`,name:friendInput.name.trim(),note:friendInput.note.trim(),date:new Date().toISOString()};const nl=[e,...friendLog];setFriendLog(nl);await save("wb-friends-v2",nl);const nst={...streaks,friendDinners:(streaks.friendDinners||0)+1};setStreaks(nst);await save("wb-streaks-v4",nst);const nxp=totalXP+15;setTotalXP(nxp);await save("wb-totalxp",nxp);setFriendInput({name:"",note:""});setShowFF(false);showToast(`👥 ${e.name} logged +15 pts`);};

  // ── TODOS ────────────────────────────────────────────────────────────
  // ── HEALTH ────────────────────────────────────────────────────────
  const PROTEIN_PRESETS = [
    {label:"Chicken breast",grams:31,icon:"🍗"},
    {label:"Eggs (×1)",grams:6,icon:"🥚"},
    {label:"Protein shake",grams:25,icon:"🥤"},
    {label:"Tuna (can)",grams:27,icon:"🐟"},
    {label:"Turkey breast",grams:29,icon:"🦃"},
    {label:"Steak",grams:26,icon:"🥩"},
    {label:"Custom",grams:0,icon:"✏️"},
  ];
  const WORKOUT_TYPES = ["Lift","Run","Walk","Sport","HIIT","Other"];
  const [customGrams, setCustomGrams] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const todayProtein = proteinLog.reduce((s,e)=>s+e.grams,0);

  const logProtein = async(preset) => {
    if(preset.grams===0){setShowCustom(true);return;}
    const entry = {id:`p-${Date.now()}`,label:preset.label,grams:preset.grams,at:new Date().toISOString()};
    const nl = [...proteinLog, entry];
    setProteinLog(nl); await save(`wb-protein-${todayKey()}`, nl);
    showToast(`+${preset.grams}g protein`);
  };
  const logCustomProtein = async() => {
    const g = parseInt(customGrams);
    if(!g||g<=0) return;
    const entry = {id:`p-${Date.now()}`,label:`Custom`,grams:g,at:new Date().toISOString()};
    const nl = [...proteinLog, entry];
    setProteinLog(nl); await save(`wb-protein-${todayKey()}`, nl);
    setCustomGrams(""); setShowCustom(false);
    showToast(`+${g}g protein`);
  };
  const deleteProteinEntry = async(id) => {
    const nl = proteinLog.filter(e=>e.id!==id);
    setProteinLog(nl); await save(`wb-protein-${todayKey()}`, nl);
  };

  const logWorkout = async(dayKey, type) => {
    const nw = {...workoutLog, [dayKey]:{type,at:new Date().toISOString()}};
    setWorkoutLog(nw); await save(`wb-workouts-${weekKey()}`, nw);
    const nxp=totalXP+20; setTotalXP(nxp); await save("wb-totalxp",nxp);
    showToast(`💪 ${type} logged +20 pts`);
  };
  const removeWorkout = async(dayKey) => {
    const nw = {...workoutLog}; delete nw[dayKey];
    setWorkoutLog(nw); await save(`wb-workouts-${weekKey()}`, nw);
  };

  const saveCats = async(cats) => { setCategories(cats); await save("wb-categories-v1", cats); };
  const addCategory = async() => {
    if(!newCatName.trim()) return;
    const nc = [...categories, {id:`cat-${Date.now()}`,name:newCatName.trim(),collapsed:false}];
    await saveCats(nc); setNewCatName(""); setAddingCat(false); setActiveCatId(nc[nc.length-1].id);
  };
  const toggleCatCollapse = async(id) => {
    const nc = categories.map(c=>c.id===id?{...c,collapsed:!c.collapsed}:c);
    await saveCats(nc);
  };
  const deleteCategory = async(id) => {
    if(id==="cat-default") return;
    // Move tasks in deleted cat to General
    const moved = todos.map(t=>t.categoryId===id?{...t,categoryId:"cat-default"}:t);
    setTodos(moved); await save("wb-todos-v1",moved);
    const nc = categories.filter(c=>c.id!==id);
    await saveCats(nc);
    if(activeCatId===id) setActiveCatId("cat-default");
  };
  const renameCategory = async(id, name) => {
    const nc = categories.map(c=>c.id===id?{...c,name}:c);
    await saveCats(nc); setEditCatId(null);
  };
  const addTodo=async()=>{if(!todoInput.trim())return;const u=[...todos,{id:`t-${Date.now()}`,text:todoInput.trim(),done:false,categoryId:activeCatId}];setTodos(u);await save("wb-todos-v1",u);setTodoInput("");};
  const toggleTodo=async(id)=>{const u=todos.map(t=>t.id===id?{...t,done:!t.done}:t);setTodos(u);await save("wb-todos-v1",u);};
  const deleteTodo=async(id)=>{const u=todos.filter(t=>t.id!==id);setTodos(u);await save("wb-todos-v1",u);};

  // ── HERO HELPERS ─────────────────────────────────────────────────────
  const heroClass = () => {
    if(travelMode)return"hero hero-travel";
    const m=getModeForDate(today);
    if(m==="sunday")return"hero hero-sunday";
    if(m==="saturday")return"hero hero-saturday";
    return"hero hero-home";
  };
  const fillClass = () => {
    if(travelMode)return"h-fill h-fill-travel";
    const m=getModeForDate(today);
    if(m==="sunday")return"h-fill h-fill-sunday";
    if(m==="saturday")return"h-fill h-fill-saturday";
    return"h-fill h-fill-home";
  };
  const modeLabel = () => {
    if(travelMode)return travelDest;
    const m=getModeForDate(today);
    if(m==="sunday")return"Sabbath Day";
    if(m==="saturday")return"Family Saturday";
    return new Date().toLocaleDateString("en-US",{weekday:"long"});
  };
  const modeIcon = () => {
    if(travelMode)return"✈️";
    const m=getModeForDate(today);
    if(m==="sunday")return"🕊️";
    if(m==="saturday")return"🌄";
    return"☀️";
  };

  // ── JOURNAL CALENDAR ─────────────────────────────────────────────────
  const getCalDays=(y,m)=>{const first=new Date(y,m-1,1).getDay();const last=new Date(y,m,0).getDate();const days=[];for(let i=0;i<first;i++)days.push(null);for(let i=1;i<=last;i++)days.push(i);return days;};
  const fmtMonthYear=(y,m)=>new Date(y,m-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"});

  // ── DOT COLOR ────────────────────────────────────────────────────────
  const dotColor=(ds)=>{const h=history[ds];if(!h)return null;if(h.pct>=100)return"#059669";if(h.pct>=80)return"#34D399";if(h.pct>=40)return"#F59E0B";return"#EF4444";};

  // ── EDITOR TABS ──────────────────────────────────────────────────────
  const EDITOR_TABS=[{key:"weekday",label:"Weekday"},{key:"saturday",label:"Saturday"},{key:"sunday",label:"Sunday"},{key:"travel",label:"Travel"},{key:"weekly",label:"Weekly"},{key:"ijm",label:"IJM"},{key:"monthly",label:"Monthly"},{key:"platform",label:"Platform"}];

  // ── LOADING ──────────────────────────────────────────────────────────
  if(loading) return(
    <>
      <style>{CSS}</style>
      <div className="loading">
        <div style={{animation:"iconPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",marginBottom:20}}>
          <AppIcon size={72} style={{boxShadow:"0 0 40px rgba(35,181,211,0.2)"}}/>
        </div>
        <div style={{fontSize:32,fontWeight:900,color:"#DFE0E2",letterSpacing:"0.28em",textTransform:"uppercase"}}>MERIDIAN</div>
        <div style={{height:1,width:80,background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.4),transparent)",margin:"12px 0"}}/>
        <div style={{fontSize:9,fontWeight:800,color:"#23B5D3",letterSpacing:"0.18em",textTransform:"uppercase"}}>Loading…</div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      {!splashDone && <SplashScreen onDone={()=>setSplashDone(true)}/>}
      {showConfetti && <Confetti/>}
      {milestoneQueue.length>0 && (
        <MilestoneSplash
          milestone={milestoneQueue[0]}
          streakLabel={milestoneQueue[0].streakLabel}
          bonusXP={milestoneQueue[0].major?MILESTONE_BONUS_XP.major:MILESTONE_BONUS_XP.minor}
          onDismiss={async()=>{
            const bonus = milestoneQueue[0].major?MILESTONE_BONUS_XP.major:MILESTONE_BONUS_XP.minor;
            const nxp = totalXP+bonus; setTotalXP(nxp); await save("wb-totalxp",nxp);
            dismissMilestone();
          }}
        />
      )}
      {xpFloat!==null && <XPFloat amount={xpFloat} onDone={()=>setXpFloat(null)}/>}
      {toast && <div key={toastKey} className="toast">{toast}</div>}

      {/* TRAVEL MODAL */}
      {showTM&&(
        <div className="modal-overlay" onClick={()=>setShowTM(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">✈️ Travel Mode</div>
            <div className="modal-sub">Where are you headed? Your checklist switches to travel mode.</div>
            <input className="modal-input" placeholder="e.g. Ghana, Mumbai, DC…" value={tempDest} onChange={e=>setTempDest(e.target.value)} onKeyDown={e=>e.key==="Enter"&&enableTravel()} autoFocus/>
            <button className="modal-btn" onClick={enableTravel}>Activate Travel Mode</button>
            <button className="modal-cancel" onClick={()=>setShowTM(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* YEAR HEATMAP */}
      {showYearMap&&(
        <div className="yearmap-overlay" onClick={()=>setShowYearMap(false)}>
          <div className="yearmap-sheet" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,fontWeight:800,color:"#0B1929",marginBottom:4}}>{yearKey()} in Review</div>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {[["#059669","100%"],["#34D399","80%+"],["#F59E0B","40%+"],["#EF4444","<40%"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#64748B"}}>
                  <span style={{width:10,height:10,borderRadius:2,background:c,display:"inline-block"}}/>{l}
                </span>
              ))}
            </div>
            {Array.from({length:12},(_,i)=>i+1).map(m=>{
              const days=getCalDays(parseInt(yearKey()),m);
              return(
                <div key={m} style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{new Date(parseInt(yearKey()),m-1,1).toLocaleDateString("en-US",{month:"long"})}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {days.map((d,i)=>{
                      if(!d)return<div key={`e${i}`} style={{width:26,height:26}}/>;
                      const ds=`${yearKey()}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                      const h=history[ds];const isToday=ds===today;
                      const bg=h?(h.pct>=100?"#059669":h.pct>=80?"#34D399":h.pct>=40?"#F59E0B":"#EF4444"):"#E2E8F0";
                      return(
                        <div key={ds} className="yearmap-cell" style={{background:bg,color:h||isToday?"rgba(255,255,255,0.9)":"#CBD5E1",outline:isToday?"2px solid #2563EB":"none"}}
                          onClick={()=>{setShowYearMap(false);viewPastDay(ds);}}>
                          {d}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button style={{width:"100%",padding:15,background:"#F0F4FA",border:"none",borderRadius:14,color:"#64748B",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:8}} onClick={()=>setShowYearMap(false)}>Close</button>
          </div>
        </div>
      )}

      {/* EDITOR */}
      {editorOpen&&editLists&&(
        <div className="editor-overlay">
          <div className="editor-sheet">
            <div className="editor-hdr">
              <div className="editor-title">Edit Checklists</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setEditorOpen(false)} style={{background:"none",border:"none",color:"#64748B",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button className="editor-close" onClick={saveEditor}>Save</button>
              </div>
            </div>
            <div className="editor-body">
              <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
                {EDITOR_TABS.map(({key,label})=>(
                  <button key={key} onClick={()=>setEditorTab(key)} style={{flexShrink:0,padding:"8px 14px",borderRadius:100,border:"none",background:editorTab===key?"linear-gradient(135deg,#1A3A6B,#2563EB)":"rgba(255,255,255,0.65)",color:editorTab===key?"#fff":"#64748B",fontSize:13,fontWeight:700,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              <div style={{fontSize:12,fontWeight:800,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{EDITOR_TABS.find(t=>t.key===editorTab)?.label} Items</div>
              {(editLists[editorTab]||[]).map((item,idx)=>(
                <div key={item.id} className="editor-item">
                  <div className="editor-item-row">
                    <input className="editor-icon-input" value={item.icon} onChange={e=>updEditorItem(editorTab,idx,"icon",e.target.value)} maxLength={2}/>
                    <div className="editor-text-inputs">
                      <input className="editor-field" placeholder="Item name…" value={item.text} onChange={e=>updEditorItem(editorTab,idx,"text",e.target.value)}/>
                      <input className="editor-field small" placeholder="Description…" value={item.sub} onChange={e=>updEditorItem(editorTab,idx,"sub",e.target.value)}/>
                    </div>
                    <input className="editor-xp" type="number" value={item.xp} onChange={e=>updEditorItem(editorTab,idx,"xp",e.target.value)} min={1} max={100}/>
                    <button className="editor-del" onClick={()=>delEditorItem(editorTab,idx)}>×</button>
                  </div>
                </div>
              ))}
              <button className="editor-add-btn" onClick={()=>addEditorItem(editorTab)}>+ Add Item</button>
            </div>
          </div>
        </div>
      )}

      <div className="app">
        {/* HEADER */}
        <div className="hdr">
          <div className="hdr-inner">
            <div className="hdr-left">
              {/* AVATAR / APP ICON */}
              <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setShowAvatarMenu(p=>!p)}>
                {avatar
                  ? <img src={avatar} style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"1px solid rgba(35,181,211,0.3)"}} alt="You"/>
                  : <AppIcon size={36}/>
                }
                <div style={{position:"absolute",bottom:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#23B5D3",border:"2px solid #071013",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#071013",fontWeight:900}}>✎</div>
              </div>
              {/* AVATAR MENU */}
              {showAvatarMenu&&(
                <div style={{position:"absolute",top:60,left:18,background:"#0D1A1E",border:"1px solid rgba(35,181,211,0.2)",borderRadius:10,padding:8,zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",minWidth:180}}>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
                  <button onClick={()=>avatarInputRef.current?.click()} style={{display:"block",width:"100%",padding:"10px 14px",background:"none",border:"none",color:"#DFE0E2",fontSize:13,fontWeight:700,textAlign:"left",cursor:"pointer",letterSpacing:"0.04em"}}>📷 Upload Photo</button>
                  {avatar&&<button onClick={removeAvatar} style={{display:"block",width:"100%",padding:"10px 14px",background:"none",border:"none",color:"#4A5A62",fontSize:13,fontWeight:700,textAlign:"left",cursor:"pointer",borderTop:"1px solid rgba(255,255,255,0.06)",letterSpacing:"0.04em"}}>Remove Photo</button>}
                  <button onClick={()=>setShowAvatarMenu(false)} style={{display:"block",width:"100%",padding:"10px 14px",background:"none",border:"none",color:"#4A5A62",fontSize:12,textAlign:"left",cursor:"pointer",letterSpacing:"0.04em"}}>Cancel</button>
                </div>
              )}
              <div>
                <div className="hdr-eyebrow">{travelMode?`✈️ ${travelDest}`:"Meridian"}</div>
                <div className="hdr-date">{formatDate()}</div>
              </div>
            </div>
            <div className="hdr-right">
              <button className="gear-btn" onClick={openEditor} title="Edit checklists">⚙️</button>
              <button className={`travel-toggle ${travelMode?"on":"off"}`} onClick={travelMode?disableTravel:()=>setShowTM(true)}>✈️ {travelMode?"Road":"Travel"}</button>
            </div>
          </div>
        </div>

        <div className="scroll">

          {/* ══ TODAY ══════════════════════════════════════════════════ */}
          {tab==="today"&&(
            <>
              <div className={heroClass()} style={{marginTop:4}}>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",letterSpacing:"0.14em",marginBottom:4}}>{modeIcon()} {modeLabel()}</div>
                  <div className="pts-row">
                    <div>
                      <div className="pts-num">{viewDate?(history[viewDate]?.pts||0):todayPts}</div>
                      <div className="pts-label">of {viewDate?(history[viewDate]?.maxPts||0):todayMax} pts today</div>
                    </div>
                    <div className="pts-right">
                      <span className="pts-icon">{todayMode==="sunday"?"🕊️":todayMode==="saturday"?"🌄":travelMode?"✈️":"☀️"}</span>
                      <div className="pts-streak">🔥 {streaks.current}-day streak</div>
                    </div>
                  </div>
                  <div className="h-prog-row"><div className="h-prog-label">Today's completion</div><div className="h-prog-pct">{viewDate?(history[viewDate]?.pct||0):todayPct}%</div></div>
                  <div className="h-track"><div className={fillClass()} style={{width:`${viewDate?(history[viewDate]?.pct||0):todayPct}%`}}/></div>
                  <div className="h-stats">
                    <div className="h-stat"><div className="h-stat-val">{totalXP}</div><div className="h-stat-lbl">Total Pts</div></div>
                    <div className="h-stat"><div className="h-stat-val">{streaks.longest}</div><div className="h-stat-lbl">Best Streak</div></div>
                    <div className="h-stat"><div className="h-stat-val">{goalsComplete}/{goals.length}</div><div className="h-stat-lbl">Goals</div></div>
                  </div>
                </div>
              </div>

              <div className="xp-card">
                <div className="xp-row"><div className="xp-level">Level {levelInfo.l} — {levelInfo.t}</div><div className="xp-pts">{totalXP} pts</div></div>
                <div className="xp-track"><div className="xp-fill" style={{width:`${levelInfo.progress}%`}}/></div>
              </div>

              {todayMode==="sunday"&&!viewDate&&<div className="mode-badge mode-badge-sun"><span style={{fontSize:18}}>🕊️</span><div><div className="mb-text">Sabbath Sunday</div><div className="mb-sub">Rest, church, presence. Nothing else required.</div></div></div>}
              {todayMode==="saturday"&&!viewDate&&<div className="mode-badge mode-badge-sat"><span style={{fontSize:18}}>🌄</span><div><div className="mb-text">Family Saturday</div><div className="mb-sub">River, Annie, Jules, music. All that matters today.</div></div></div>}
              {travelMode&&!viewDate&&<div className="mode-badge mode-badge-travel"><span style={{fontSize:18}}>🗺️</span><div><div className="mb-text">{travelDest}</div><div className="mb-sub">Travel checklist active. Stay anchored.</div></div></div>}

              {!viewDate&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
                  <button className={`travel-toggle ${restDayToday?"on":"off"}`} onClick={toggleRestDay}>😴 {restDayToday?"Rest day on":"Rest day"}</button>
                  {todayMode==="saturday"&&(
                    <button className={`travel-toggle ${lessonThisWeek?"on":"off"}`} onClick={toggleLessonWeek}>🎸 {lessonThisWeek?"Lesson this week":"No lesson this week"}</button>
                  )}
                  <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:11,fontWeight:800,color:"#7A9AAA",letterSpacing:"0.06em"}}>
                    <span>🎟️ {graceTokens} grace</span>
                    <span>❤️ {healthStreak.current}d health</span>
                  </div>
                </div>
              )}

              {!viewDate&&(
                <div className="scripture-card">
                  <div className="scripture-verse">"{scripture.verse}"</div>
                  <div className="scripture-ref">{scripture.ref}</div>
                </div>
              )}

              {/* DATE STRIP */}
              <div style={{marginBottom:4}}>
                <div className="date-strip">
                  {pastDays.map(ds=>{
                    const d=new Date(ds+"T12:00:00");const isToday=ds===today;const isViewing=viewDate===ds;const dc=dotColor(ds);
                    return(
                      <div key={ds} className="day-chip" onClick={()=>viewPastDay(ds)}>
                        <div className={`day-chip-inner ${isToday?"today":""} ${isViewing?"viewing":""}`}>
                          <div className="day-chip-dow">{DAYS[d.getDay()]}</div>
                          <div className="day-chip-num">{d.getDate()}</div>
                          {dc&&<div className="day-dot" style={{background:dc}}/>}
                          {isToday&&!viewDate&&<div className="day-dot" style={{background:"#2563EB"}}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{textAlign:"right",marginTop:-2}}>
                  <button onClick={()=>setShowYearMap(true)} style={{background:"none",border:"none",fontSize:11,fontWeight:700,color:"#94A3B8",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Full Year ›</button>
                </div>
              </div>

              {/* HISTORY OR TODAY */}
              {viewDate?(
                <>
                  <div className="history-banner">
                    <div>
                      <div className="history-banner-text">📅 {new Date(viewDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
                      <div style={{fontSize:12,color:"#071013",marginTop:2}}>{history[viewDate]?.pts||0}/{history[viewDate]?.maxPts||0} pts — tap to edit</div>
                    </div>
                    <button className="history-banner-btn" onClick={()=>setViewDate(null)}>Today ›</button>
                  </div>
                  <CheckGroup
                    items={lists[getModeForDate(viewDate)]||lists.weekday}
                    state={dayStates[getDayKey(viewDate,getModeForDate(viewDate))]||{}}
                    onToggle={handleToggle}
                    bouncing={bouncing}
                    travel={false}
                  />
                </>
              ):(
                <>
                  <div className="sec"><div className="sec-title">{todayMode==="sunday"?"Sunday":todayMode==="saturday"?"Saturday":travelMode?"Travel":"Daily"}</div><div className="sec-sub">{Object.values(todayState).filter(v=>v?.checked).length}/{todayItems.length} done</div></div>
                  <CheckGroup items={todayItems} state={todayState} onToggle={handleToggle} bouncing={bouncing} travel={travelMode}/>

                  {/* ── TASKS WITH CATEGORIES ── */}
                  <div className="sec">
                    <div className="sec-title">Tasks</div>
                    <button onClick={()=>setAddingCat(true)} style={{background:"none",border:"none",fontSize:11,fontWeight:800,color:"#23B5D3",cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase"}}>+ Category</button>
                  </div>

                  {/* Add category form */}
                  {addingCat&&(
                    <div className="cat-add-form">
                      <input
                        className="cat-name-input"
                        placeholder="Category name…"
                        value={newCatName}
                        onChange={e=>setNewCatName(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")addCategory();if(e.key==="Escape"){setAddingCat(false);setNewCatName("");}}}
                        autoFocus
                      />
                      <button onClick={addCategory} className="cat-add-confirm">Add</button>
                      <button onClick={()=>{setAddingCat(false);setNewCatName("");}} className="cat-add-cancel">✕</button>
                    </div>
                  )}

                  {/* Category selector pills */}
                  <div className="cat-pills">
                    {categories.map(cat=>(
                      <button key={cat.id} className={"cat-pill"+(activeCatId===cat.id?" active":"")} onClick={()=>setActiveCatId(cat.id)}>
                        {cat.name}
                        {todos.filter(t=>t.categoryId===cat.id&&!t.done).length>0&&(
                          <span className="cat-pill-count">{todos.filter(t=>t.categoryId===cat.id&&!t.done).length}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Task input for active category */}
                  <div className="todo-input-row">
                    <input className="todo-input" placeholder={`Add to ${categories.find(c=>c.id===activeCatId)?.name||"General"}…`} value={todoInput} onChange={e=>setTodoInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()}/>
                    <button className="todo-add-btn" onClick={addTodo}>+</button>
                  </div>

                  {/* Categories with collapsible task lists */}
                  {categories.map(cat=>{
                    const catTodos = todos.filter(t=>(t.categoryId||"cat-default")===cat.id);
                    const doneCnt = catTodos.filter(t=>t.done).length;
                    const total = catTodos.length;
                    if(total===0 && activeCatId!==cat.id) return null;
                    return(
                      <div key={cat.id} className="cat-section">
                        {/* Category header */}
                        <div className="cat-header" onClick={()=>toggleCatCollapse(cat.id)}>
                          <div className="cat-chevron" style={{transform:cat.collapsed?"rotate(-90deg)":"rotate(0deg)"}}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#A2AEBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 4 6 8 10 4"/>
                            </svg>
                          </div>
                          {editCatId===cat.id?(
                            <input
                              className="cat-rename-input"
                              defaultValue={cat.name}
                              autoFocus
                              onBlur={e=>renameCategory(cat.id, e.target.value||cat.name)}
                              onKeyDown={e=>{if(e.key==="Enter")renameCategory(cat.id,e.target.value||cat.name);if(e.key==="Escape")setEditCatId(null);}}
                              onClick={e=>e.stopPropagation()}
                            />
                          ):(
                            <div className="cat-header-name" onDoubleClick={e=>{e.stopPropagation();setEditCatId(cat.id);}}>{cat.name}</div>
                          )}
                          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
                            {cat.collapsed&&total>0&&(
                              <span className="cat-collapsed-badge">{total-doneCnt} remaining</span>
                            )}
                            {doneCnt>0&&!cat.collapsed&&(
                              <button onClick={async e=>{e.stopPropagation();const u=todos.filter(t=>!((t.categoryId||"cat-default")===cat.id&&t.done));setTodos(u);await save("wb-todos-v1",u);}} className="cat-clear-btn">Clear done</button>
                            )}
                            {cat.id!=="cat-default"&&(
                              <button onClick={async e=>{e.stopPropagation();if(window.confirm&&window.confirm("Delete this category?"))deleteCategory(cat.id);else deleteCategory(cat.id);}} className="cat-del-btn">✕</button>
                            )}
                          </div>
                        </div>

                        {/* Tasks list */}
                        {!cat.collapsed&&(
                          <div className="check-card" style={{marginTop:0,borderRadius:"0 0 14px 14px",borderTop:"none"}}>
                            {catTodos.length===0&&(
                              <div style={{padding:"16px 18px",fontSize:13,color:"#A2AEBB",fontStyle:"italic"}}>
                                No tasks yet — type above to add one
                              </div>
                            )}
                            {catTodos.map(todo=>(
                              <div key={todo.id} className="c-row">
                                <div className={`todo-circle ${todo.done?"done":""}`} onClick={()=>toggleTodo(todo.id)}/>
                                <div className="c-body" onClick={()=>toggleTodo(todo.id)} style={{cursor:"pointer"}}>
                                  <div className="c-main" style={{color:todo.done?"#A2AEBB":"#071013",textDecoration:todo.done?"line-through":"none"}}>{todo.text}</div>
                                </div>
                                <button className="todo-del" onClick={()=>deleteTodo(todo.id)}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="col323-footer">
                    <div className="col323-verse">"Whatever you do, work at it with all your heart, as working for the Lord, not for human masters."</div>
                    <div className="col323-ref">Colossians 3:23 · The Webb Family Verse</div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ══ RHYTHMS ════════════════════════════════════════════════ */}
          {tab==="rhythms"&&(
            <>
              <div className="r-tabs" style={{marginTop:8}}>
                {[["weekly","Weekly"],["monthly","Monthly"],["annual","Annual"]].map(([k,l])=>(
                  <button key={k} className={`r-tab ${rhythmTab===k?"active":""}`} onClick={()=>setRhythmTab(k)}>{l}</button>
                ))}
              </div>
              {rhythmTab==="weekly"&&(
                <>
                  <div className="sec"><div className="sec-title">This Week</div><div className="sec-sub">{weeklyPct}% · {weeklyPts}/{weeklyMax} pts</div></div>
                  <CheckGroup items={weeklyItems} state={weeklyState} onToggle={handleWeekly} bouncing={bouncing} travel={false}/>
                  <div style={{background:"linear-gradient(135deg,#071013,#0D1A1E)",borderRadius:"16px 16px 0 0",padding:"12px 18px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#23B5D3",boxShadow:"0 0 8px rgba(35,181,211,0.4)"}}/>
                    <div><div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.9)",letterSpacing:"0.06em",textTransform:"uppercase"}}>IJM Leadership</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>Strategic + platform layer</div></div>
                  </div>
                  <div className="check-card" style={{borderRadius:"0 0 20px 20px",marginBottom:12}}>
                    <CheckGroup items={lists.ijm||DEFAULT_LISTS.ijm} state={ijmState} onToggle={handleIjm} bouncing={bouncing} travel={false}/>
                  </div>
                </>
              )}
              {rhythmTab==="monthly"&&(
                <>
                  <div className="sec"><div className="sec-title">This Month</div></div>
                  <div className="prompt-card" onClick={()=>setShowFF(true)}>
                    <div style={{fontSize:22}}>👥</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#23B5D3"}}>Log a connection</div><div style={{fontSize:11,color:"#4A5A62"}}>{friendLog.length} this year</div></div>
                    <div style={{fontSize:14,color:"#4A5A62"}}>+</div>
                  </div>
                  {showFF&&(
                    <div className="add-form">
                      <div style={{fontSize:17,fontWeight:800,color:"#0B1929",marginBottom:14}}>Who did you connect with?</div>
                      <input className="field" placeholder="Name…" value={friendInput.name} onChange={e=>setFriendInput(p=>({...p,name:e.target.value}))}/>
                      <input className="field" placeholder="Dinner, coffee, call…" value={friendInput.note} onChange={e=>setFriendInput(p=>({...p,note:e.target.value}))}/>
                      <div className="btn-row"><button className="btn-s" onClick={()=>setShowFF(false)}>Cancel</button><button className="btn-p" onClick={addFriend}>Log it</button></div>
                    </div>
                  )}
                  <CheckGroup items={lists.monthly||DEFAULT_LISTS.monthly} state={monthlyState} onToggle={handleMonthly} bouncing={bouncing} travel={false}/>
                </>
              )}
              {rhythmTab==="annual"&&(
                <>
                  <div style={{background:"linear-gradient(135deg,#071013,#071013,#071013)",borderRadius:24,padding:22,marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>{yearKey()} Annual</div>
                    <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:2}}>Health & Foundations</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>{Object.values(annualState).filter(v=>v?.checked).length}/{(lists.annual||DEFAULT_LISTS.annual).length} complete</div>
                  </div>
                  <CheckGroup items={lists.annual||DEFAULT_LISTS.annual} state={annualState} onToggle={handleAnnual} bouncing={bouncing} travel={false}/>
                </>
              )}
            </>
          )}

          {/* ══ PLATFORM ═══════════════════════════════════════════════ */}
          {tab==="platform"&&(
            <>
              <div className="platform-hero" style={{marginTop:4}}>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>Slow Burn</div>
                  <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:2}}>Platform Work</div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,0.45)",marginBottom:16}}>The books, the movement, the legacy.</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[{label:"Completed",val:`${platItems.filter(i=>platState[i.id]?.checked).length}/${platItems.length}`},{label:"Pts Available",val:`${platItems.reduce((s,i)=>s+i.xp,0)}`}].map(({label,val})=>(
                      <div key={label} style={{background:"rgba(255,255,255,0.08)",borderRadius:6,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.12)"}}>
                        <div style={{fontSize:20,fontWeight:900,color:"#fff",letterSpacing:"-0.02em"}}>{val}</div>
                        <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sec"><div className="sec-title">This Month</div><div className="sec-sub">Tap to log · pts awarded</div></div>
              <CheckGroup items={platItems} state={platState} onToggle={handlePlat} bouncing={bouncing} travel={false}/>
              <div className="sec"><div className="sec-title">Projects</div></div>
              {[{title:"Recalibrated",sub:"Faith + leadership book",color:"#7C3AED",stage:"Writing"},{title:"The Sequence",sub:"Marketing book",color:"#2563EB",stage:"Writing"},{title:"One Five One",sub:"Men's movement",color:"#0891B2",stage:"Building"},{title:"BenWebb.com",sub:"Unified platform",color:"#23B5D3",stage:"Planning"}].map(p=>(
                <div key={p.title} className="g-card" style={{borderLeft:`3px solid ${p.color}`,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div><div style={{fontSize:15,fontWeight:700,color:"#0B1929"}}>{p.title}</div><div style={{fontSize:12,color:"#64748B",marginTop:2}}>{p.sub}</div></div>
                    <div style={{fontSize:11,fontWeight:700,background:"rgba(255,255,255,0.05)",color:p.color,padding:"4px 10px",borderRadius:4,border:`1px solid ${p.color}30`}}>{p.stage}</div>
                  </div>
                </div>
              ))}
              <div className="quote-hero" style={{marginTop:16}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginBottom:10}}>Core Thesis</div>
                <div style={{fontSize:17,fontWeight:500,color:"#fff",lineHeight:1.55,fontStyle:"italic"}}>"Really chasing the Lord means great sacrifice but great outcomes — encouraging others to dream and live a life less ordinary."</div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.3)",marginTop:12,letterSpacing:"0.08em",textTransform:"uppercase"}}>Ben Webb</div>
              </div>
            </>
          )}

          {/* ══ PROGRESS ═══════════════════════════════════════════════ */}
          {tab==="progress"&&(
            <>
              <div className="sec" style={{marginTop:8}}><div className="sec-title">By Domain</div></div>
              <div className="d-grid">
                {Object.entries(DOMAIN_CFG).map(([k,v])=>(
                  <div className="d-card" key={k}>
                    <div className="d-icon">{k==="family"?"👨‍👧‍👦":k==="platform"?"📚":k==="financial"?"💼":"💪"}</div>
                    <div className="d-lbl">{v.label}</div>
                    <div className="d-pct" style={{color:v.color}}>{domainProgress[k]}%</div>
                    <div className="d-bar"><div className="d-fill" style={{width:`${domainProgress[k]}%`,background:v.color}}/></div>
                  </div>
                ))}
              </div>
              <div className="sec"><div className="sec-title">Financial</div></div>
              <div className="fin-grid">
                <div className="fin-card">
                  <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94A3B8",marginBottom:6}}>Debt Reduction</div>
                  <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,marginBottom:8,color:"#23B5D3"}}>{debtPct}%</div>
                  <div style={{height:5,background:"rgba(11,25,41,0.08)",borderRadius:100,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",background:"linear-gradient(90deg,#059669,#34D399)",borderRadius:100,width:`${debtPct}%`,transition:"width 0.8s"}}/></div>
                  <div style={{fontSize:12,color:"#94A3B8"}}>${(financials.debtStart-financials.debtCurrent).toLocaleString()} reduced</div>
                </div>
                <div className="fin-card">
                  <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94A3B8",marginBottom:6}}>Savings</div>
                  <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,marginBottom:8,color:"#75ABBC"}}>{savPct}%</div>
                  <div style={{height:5,background:"rgba(11,25,41,0.08)",borderRadius:100,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",background:"linear-gradient(90deg,#2563EB,#60A5FA)",borderRadius:100,width:`${savPct}%`,transition:"width 0.8s"}}/></div>
                  <div style={{fontSize:12,color:"#94A3B8"}}>${financials.savingsCurrent.toLocaleString()} of ${financials.savingsTarget.toLocaleString()}</div>
                </div>
              </div>
              {!showFinForm&&<div className="prompt-card" onClick={()=>setShowFinForm(true)}><div style={{fontSize:22}}>✏️</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:800,color:"#23B5D3",letterSpacing:"0.04em",textTransform:"uppercase"}}>Update numbers</div><div style={{fontSize:11,color:"#4A5A62"}}>Debt, savings, targets</div></div><div style={{fontSize:14,color:"#4A5A62"}}>›</div></div>}
              {showFinForm&&(
                <div className="fin-edit">
                  <div style={{fontSize:16,fontWeight:700,color:"#0B1929",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>Update Financials<button onClick={()=>setShowFinForm(false)} style={{background:"none",border:"none",color:"#94A3B8",fontSize:14,cursor:"pointer",fontWeight:600}}>Done</button></div>
                  {[["debtStart","Debt Start"],["debtCurrent","Debt Now"],["savingsTarget","Savings Target"],["savingsCurrent","Savings Now"]].reduce((rows,item,i)=>{if(i%2===0)rows.push([]);rows[rows.length-1].push(item);return rows;},[]).map((pair,ri)=>(
                    <div key={ri} style={{display:"flex",gap:10,marginBottom:10}}>
                      {pair.map(([field,label])=>(
                        <div key={field} style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</div>
                          <input style={{width:"100%",background:"#F0F4FA",border:"1.5px solid transparent",borderRadius:12,padding:"11px 13px",fontSize:16,fontWeight:700,color:"#0B1929",outline:"none"}} type="number" value={financials[field]} onChange={async e=>{const nf={...financials,[field]:Number(e.target.value)};setFinancials(nf);await save("wb-fin-v2",nf);}}/>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="sec"><div className="sec-title">Connections</div><div className="sec-sub">{friendLog.length} this year</div></div>
              <div className="prompt-card" onClick={()=>setShowFF(true)}><div style={{fontSize:22}}>👥</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#23B5D3"}}>Log a connection</div></div><div style={{fontSize:14,color:"#4A5A62"}}>+</div></div>
              {showFF&&(
                <div className="add-form">
                  <div style={{fontSize:17,fontWeight:800,color:"#0B1929",marginBottom:14}}>Who did you connect with?</div>
                  <input className="field" placeholder="Name…" value={friendInput.name} onChange={e=>setFriendInput(p=>({...p,name:e.target.value}))}/>
                  <input className="field" placeholder="Dinner, coffee, call…" value={friendInput.note} onChange={e=>setFriendInput(p=>({...p,note:e.target.value}))}/>
                  <div className="btn-row"><button className="btn-s" onClick={()=>setShowFF(false)}>Cancel</button><button className="btn-p" onClick={addFriend}>Log it</button></div>
                </div>
              )}
              {friendLog.length>0&&(
                <div className="friend-list">
                  {friendLog.map(f=>(
                    <div key={f.id} className="friend-row">
                      <div className="friend-av">{f.name.charAt(0)}</div>
                      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600,color:"#0B1929"}}>{f.name}</div>{f.note&&<div style={{fontSize:12,color:"#64748B"}}>{f.note}</div>}<div style={{fontSize:11,color:"#CBD5E1"}}>{formatShort(f.date)}</div></div>
                      <button style={{background:"none",border:"none",color:"#E2E8F0",fontSize:20,cursor:"pointer",padding:4}} onClick={async()=>{const nl=friendLog.filter(x=>x.id!==f.id);setFriendLog(nl);await save("wb-friends-v2",nl);}}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {tripLog.length>0&&(
                <>
                  <div className="sec"><div className="sec-title">Trip Log</div><div className="sec-sub">{tripLog.length} trips</div></div>
                  <div className="trip-card">
                    {tripLog.map(t=>(
                      <div key={t.id} className="trip-row">
                        <span style={{fontSize:22}}>✈️</span>
                        <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#0B1929"}}>{t.dest}</div><div style={{fontSize:12,color:"#94A3B8"}}>{formatShort(t.start)}</div></div>
                        <div style={{fontSize:11,fontWeight:700,background:"#E0F7FA",color:"#23B5D3",padding:"3px 9px",borderRadius:100}}>IJM</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="sec"><div className="sec-title">Stats</div></div>
              <div className="stat-card">
                {[["Streak",`${streaks.current} days`],["Best Streak",`${streaks.longest} days`],["Days Complete",`${streaks.totalDays||0}`],["Sabbaths Honored",`${streaks.sabbaths||0}`],["Practice Sessions",`${streaks.practiceSessions||0}`],["Album Progress",`${albumProgress}%`],["Trips",`${tripLog.length}`],["Goals Done",`${goalsComplete}/${goals.length}`],["Total Points",`${totalXP}`]].map(([l,v])=>(
                  <div key={l} className="s-row"><div className="s-lbl">{l}</div><div className="s-val">{v}</div></div>
                ))}
              </div>
              <div className="sec"><div className="sec-title">Milestone Journey</div><div className="sec-sub">Main streak</div></div>
              <MilestoneJourney milestones={generateMilestoneList(420)} currentStreak={streaks.current}/>

              <div className="sec"><div className="sec-title">Achievements</div></div>
              <div className="ach-grid">
                {ACHIEVEMENTS.map(a=>(
                  <div key={a.id} className={`ach-card ${unlockedAch[a.id]?"unlocked":""}`}>
                    <div className="ach-icon">{a.icon}</div>
                    <div className="ach-name">{a.title}</div>
                  </div>
                ))}
              </div>
              <div className="sec"><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%"}}><div className="sec-title">Goals</div><button className="sec-btn" onClick={()=>setShowAddGoal(p=>!p)}>{showAddGoal?"Cancel":"+ Add"}</button></div></div>
              {showAddGoal&&(
                <div className="add-form">
                  <div style={{fontSize:17,fontWeight:800,color:"#0B1929",marginBottom:14}}>New Goal</div>
                  <input className="field" placeholder="Goal title…" value={newGoal.title} onChange={e=>setNewGoal(p=>({...p,title:e.target.value}))}/>
                  <input className="field" placeholder="Details…" value={newGoal.detail} onChange={e=>setNewGoal(p=>({...p,detail:e.target.value}))}/>
                  <input className="field" placeholder="Target (e.g. Q3 2026)…" value={newGoal.target} onChange={e=>setNewGoal(p=>({...p,target:e.target.value}))}/>
                  <select className="field" value={newGoal.domain} onChange={e=>setNewGoal(p=>({...p,domain:e.target.value}))}>
                    {Object.entries(DOMAIN_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div className="btn-row"><button className="btn-s" onClick={()=>setShowAddGoal(false)}>Cancel</button><button className="btn-p" onClick={addGoal}>Add</button></div>
                </div>
              )}
              <div className="chips">
                {[["all","All"],["family","Family"],["platform","Platform"],["financial","Financial"],["health","Health"]].map(([k,l])=>(
                  <button key={k} className={`chip ${domainFilter===k?"active":""}`} style={{"--cc":k==="all"?"#2563EB":DOMAIN_CFG[k]?.color}} onClick={()=>setDomainFilter(k)}>{l}</button>
                ))}
              </div>
              {filteredGoals.map(g=>{
                const dc=DOMAIN_CFG[g.domain]; const isEditing=editingGoal===g.id;
                return(
                  <div key={g.id} className={`g-card ${g.completed?"complete":""}`}>
                    {isEditing?(
                      <>
                        <div style={{fontSize:15,fontWeight:800,color:"#0B1929",marginBottom:12}}>Edit Goal</div>
                        <input className="field" value={editGoalData.title} onChange={e=>setEditGoalData(p=>({...p,title:e.target.value}))} placeholder="Title…"/>
                        <input className="field" value={editGoalData.detail} onChange={e=>setEditGoalData(p=>({...p,detail:e.target.value}))} placeholder="Details…"/>
                        <input className="field" value={editGoalData.target} onChange={e=>setEditGoalData(p=>({...p,target:e.target.value}))} placeholder="Target…"/>
                        <select className="field" value={editGoalData.domain} onChange={e=>setEditGoalData(p=>({...p,domain:e.target.value}))}>
                          {Object.entries(DOMAIN_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <div className="btn-row"><button className="btn-s" onClick={()=>setEditingGoal(null)}>Cancel</button><button className="btn-p" onClick={saveEditGoal}>Save</button></div>
                      </>
                    ):(
                      <>
                        <div className="g-hdr">
                          <div className="g-dot" style={{background:dc.color}}/>
                          <div className="g-title">{g.title}</div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <button onClick={()=>{setEditingGoal(g.id);setEditGoalData({title:g.title,detail:g.detail,target:g.target,domain:g.domain});}} style={{background:"none",border:"none",fontSize:12,color:"#94A3B8",cursor:"pointer",fontWeight:700}}>Edit</button>
                            <button className={`g-done ${g.completed?"done":""}`} onClick={()=>toggleGoalDone(g.id)}>✓</button>
                          </div>
                        </div>
                        <div className="g-detail">{g.detail}</div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                          <div className="g-tag" style={{background:`${dc.color}15`,color:dc.color,marginBottom:0}}>Target: {g.target}</div>
                          <button onClick={()=>deleteGoal(g.id)} style={{background:"none",border:"none",fontSize:11,fontWeight:700,color:"#EF4444",cursor:"pointer",letterSpacing:"0.04em"}}>Delete</button>
                        </div>
                        {!g.completed&&(
                          <>
                            <div className="g-prog-row"><div className="g-prog-track"><div className="g-prog-fill" style={{width:`${g.progress}%`,background:dc.color}}/></div><div className="g-prog-pct">{g.progress}%</div></div>
                            <input type="range" className="g-slider" min={0} max={100} value={g.progress} onChange={e=>updateGoalProgress(g.id,parseInt(e.target.value))} onMouseUp={saveGoalProgress} onTouchEnd={saveGoalProgress}/>
                            <textarea className="g-note" rows={2} placeholder="Add a note…" value={g.notes||""} onChange={e=>updateGoalNote(g.id,e.target.value)}/>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ══ MUSIC ══════════════════════════════════════════════════ */}
          {tab==="music"&&(
            <>
              <div className="music-hero" style={{marginTop:4}}>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:3}}>The Album</div>
                  <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:2}}>Untitled Record</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:18}}>10 songs · 12 months</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[{v:completedTracks,l:"Done",a:"of 10"},{v:wkSessions,l:"Sessions",a:"this week"},{v:summerDaysLeft(),l:"Days",a:"to summer"}].map(({v,l,a})=>(
                      <div key={l} style={{background:"rgba(255,255,255,0.1)",borderRadius:13,padding:"11px 9px",backdropFilter:"blur(8px)"}}>
                        <div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:"-0.03em"}}>{v}</div>
                        <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:1}}>{l}</div>
                        <div style={{fontSize:11,fontWeight:700,color:"#60A5FA",marginTop:1}}>{a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="album-card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div><div style={{fontSize:17,fontWeight:800,color:"#0B1929"}}>Album Progress</div><div style={{fontSize:12,color:"#64748B",marginTop:2}}>Track 01 target: this summer</div></div>
                  <div style={{background:"linear-gradient(135deg,#E0F7FA,#B2EBF2)",borderRadius:12,padding:"8px 13px",textAlign:"center"}}>
                    <div style={{fontSize:20,fontWeight:900,color:"#071013",letterSpacing:"-0.03em"}}>{summerDaysLeft()}</div>
                    <div style={{fontSize:9,fontWeight:700,color:"#071013",textTransform:"uppercase",letterSpacing:"0.08em"}}>days left</div>
                  </div>
                </div>
                <div className="album-bar"><div className="album-fill" style={{width:`${albumProgress}%`}}/></div>
                <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:13,color:"#64748B"}}>Overall</div><div style={{fontSize:14,fontWeight:800,color:"#0B1929"}}>{albumProgress}%</div></div>
              </div>
              <div className="sec"><div className="sec-title">Practice</div><div className="sec-sub">Target: 3 sessions per week</div></div>
              <div className="prac-grid">
                {[0,1,2].map(i=>{
                  const skeys=Object.keys(practiceLogs);const logged=i<skeys.length;const instr=logged?practiceLogs[skeys[i]]?.instrument:"";
                  return(
                    <div key={i} className={`prac-card ${logged?"logged":""}`} onClick={!logged?logPractice:undefined}>
                      <div style={{fontSize:30,fontWeight:900,color:logged?"#1D4ED8":"#CBD5E1",letterSpacing:"-0.04em",marginBottom:3}}>{i+1}</div>
                      <div style={{fontSize:10,fontWeight:700,color:logged?"#3B82F6":"#CBD5E1",textTransform:"uppercase",letterSpacing:"0.06em"}}>{logged?"Done":"Tap"}</div>
                      <div style={{fontSize:11,color:logged?"#1D4ED8":"#94A3B8",marginTop:3,fontWeight:logged?600:400}}>{logged?instr:"to log"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="check-card" style={{marginBottom:13}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"14px 17px 10px"}}>
                  {["Bass","Guitar","Piano","Drums"].map(ins=>(
                    <button key={ins} onClick={()=>setActiveInstr(ins)} style={{padding:"9px 16px",borderRadius:100,border:"none",background:activeInstr===ins?"linear-gradient(135deg,#1A3A6B,#2563EB)":"rgba(255,255,255,0.5)",color:activeInstr===ins?"#fff":"#64748B",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>{ins}</button>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 17px",borderTop:"1px solid rgba(11,25,41,0.04)"}}>
                  <div><div style={{fontSize:15,fontWeight:600,color:"#0B1929"}}>Church roster this week</div><div style={{fontSize:12,color:"#64748B",marginTop:1}}>{churchRoster?"Covered ✓":"Requires discipline"}</div></div>
                  <button style={{width:50,height:30,borderRadius:100,background:churchRoster?"linear-gradient(90deg,#1A3A6B,#2563EB)":"#CBD5E1",border:"none",cursor:"pointer",position:"relative",transition:"background 0.25s",flexShrink:0}} onClick={async()=>{const nc=!churchRoster;setChurchRoster(nc);await save(`wb-church-${weekKey()}`,nc);}}>
                    <div style={{position:"absolute",top:3,left:churchRoster?23:3,width:24,height:24,borderRadius:"50%",background:"#fff",transition:"left 0.25s",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}/>
                  </button>
                </div>
              </div>
              <div className="sec"><div className="sec-title">Tracks</div><div className="sec-sub">Tap title to rename</div></div>
              {tracks.map((t,i)=>{
                const pct=STAGE_PCT[t.stage]||0;
                return(
                  <div key={t.id} className={`track-card ${t.priority?"priority":""}`}>
                    <div className="track-hdr">
                      <div style={{fontSize:12,fontWeight:700,color:"#CBD5E1",width:24}}>{String(i+1).padStart(2,"0")}</div>
                      <div className="track-title" onClick={()=>updateTrack(i,{_editing:!t._editing})}>{t._editing?null:t.title}</div>
                      {t._editing&&<input style={{flex:1,border:"none",borderBottom:"2px solid #2563EB",background:"transparent",fontSize:15,fontWeight:700,color:"#0B1929",outline:"none",paddingBottom:2}} value={t.title} autoFocus onChange={e=>updateTrack(i,{title:e.target.value})} onBlur={()=>updateTrack(i,{_editing:false})} onKeyDown={e=>e.key==="Enter"&&updateTrack(i,{_editing:false})}/>}
                      {t.priority&&<span style={{fontSize:13}}>⭐</span>}
                      <select className={`stage-sel ${t.stage==="Complete"?"complete":""}`} value={t.stage} onChange={e=>updateTrack(i,{stage:e.target.value})}>
                        {["Not Started","Written","Demo","Recording","Mixing","Complete"].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="track-bar"><div className="track-fill" style={{width:`${pct}%`}}/></div>
                    <textarea className="track-note" rows={1} placeholder="Notes…" value={t.notes||""} onChange={e=>updateTrack(i,{notes:e.target.value})}/>
                  </div>
                );
              })}
            </>
          )}

          {/* ══ PLANNER ════════════════════════════════════════════════ */}
          {tab==="planner"&&(
            <>
              {Object.keys(planArchive).length>0&&!viewPlanWeek&&(
                <div style={{marginTop:4,marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Previous Weeks</div>
                  <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
                    {Object.entries(planArchive).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([wk,plan])=>{
                      const wNum=wk.split("-W")[1];
                      return(
                        <button key={wk} onClick={()=>setViewPlanWeek(wk)} style={{flexShrink:0,background:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.6)",borderRadius:14,padding:"10px 14px",cursor:"pointer",textAlign:"left",backdropFilter:"blur(12px)"}}>
                          <div style={{fontSize:12,fontWeight:800,color:"#1A3A6B"}}>W{wNum}</div>
                          <div style={{fontSize:10,color:"#64748B",marginTop:2,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plan.top3?.[0]?.slice(0,18)||"No priority"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {viewPlanWeek&&planArchive[viewPlanWeek]&&(
                <>
                  <div style={{background:"linear-gradient(135deg,#E0F7FA,#B2EBF2)",border:"1px solid rgba(14,138,160,0.3)",borderRadius:14,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#071013"}}>📅 Viewing {viewPlanWeek}</div>
                    <button onClick={()=>setViewPlanWeek(null)} style={{background:"none",border:"none",fontSize:12,fontWeight:800,color:"#23B5D3",cursor:"pointer"}}>Back ›</button>
                  </div>
                  {[["Top 3","top3"],["Intention","intention"],["Gratitude","gratitude"],["Carry Forward","carryForward"]].map(([label,key])=>{
                    const val=planArchive[viewPlanWeek][key];
                    if(!val||(Array.isArray(val)&&!val.some(v=>v)))return null;
                    return(
                      <div key={key} style={{marginBottom:16}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{label}</div>
                        {Array.isArray(val)
                          ?val.filter(v=>v).map((v,i)=><div key={i} style={{fontSize:14,color:"#0B1929",padding:"10px 14px",background:"rgba(255,255,255,0.5)",borderRadius:12,marginBottom:6}}>{i+1}. {v}</div>)
                          :<div style={{fontSize:14,color:"#2A4050",lineHeight:1.65,background:"rgba(255,255,255,0.5)",borderRadius:12,padding:"12px 14px"}}>{val}</div>
                        }
                      </div>
                    );
                  })}
                </>
              )}
              {!viewPlanWeek&&(
                <>
                  <div style={{background:"linear-gradient(160deg,#071013,#0D1A1E,#0D1A1E)",backgroundSize:"300% 300%",animation:"gradShift 10s ease infinite",borderRadius:26,padding:"24px 22px 20px",marginBottom:12,marginTop:4,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,background:"radial-gradient(circle,rgba(96,165,250,0.15),transparent 70%)"}}/>
                    <div style={{position:"relative",zIndex:1}}>
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>
                        {(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+1);const e=new Date(d);e.setDate(e.getDate()+6);return`Week of ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${e.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;})()}
                      </div>
                      <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:4}}>Weekly Plan</div>
                      <div style={{fontSize:14,color:"rgba(255,255,255,0.45)"}}>What does this week need to produce?</div>
                    </div>
                  </div>
                  <div className="sec"><div className="sec-title">Top 3 Priorities</div><div className="sec-sub">Must happen this week</div></div>
                  <div className="plan-card">
                    {[0,1,2].map(i=>(
                      <div key={i} className="plan-priority-row">
                        <div className="plan-num">{i+1}</div>
                        <input className="plan-input" placeholder={["Most important this week…","Second priority…","Third priority…"][i]} value={weekPlan.top3?.[i]||""} onChange={e=>{const t=[...(weekPlan.top3||["","",""])];t[i]=e.target.value;saveWeekPlan({...weekPlan,top3:t});}}/>
                      </div>
                    ))}
                  </div>
                  <div className="sec"><div className="sec-title">Intention</div><div className="sec-sub">How do I want to show up?</div></div>
                  <textarea className="journal-input" rows={3} placeholder={"As a leader, husband, father — what does this week call for?"} value={weekPlan.intention||""} onChange={e=>saveWeekPlan({...weekPlan,intention:e.target.value})} style={{marginBottom:14}}/>
                  <div className="sec"><div className="sec-title">Gratitude</div><div className="sec-sub">What from last week deserves acknowledgment?</div></div>
                  <textarea className="journal-input" rows={3} placeholder={"What went well? What am I grateful for?"} value={weekPlan.gratitude||""} onChange={e=>saveWeekPlan({...weekPlan,gratitude:e.target.value})} style={{marginBottom:14}}/>
                  <div className="sec"><div className="sec-title">Carry Forward</div><div className="sec-sub">Anything unfinished that still matters?</div></div>
                  <textarea className="journal-input" rows={2} placeholder={"What didn't get done but still needs to?"} value={weekPlan.carryForward||""} onChange={e=>saveWeekPlan({...weekPlan,carryForward:e.target.value})} style={{marginBottom:14}}/>
                  <div className="vision-card">
                    <div style={{fontSize:14,fontWeight:700,color:"#2563EB",marginBottom:8}}>Vision Anchor</div>
                    <div style={{fontSize:13,color:"#2A4050",lineHeight:1.7}}>Annie's path built on depth. River's ceiling limited by talent only. Jules is the primary relationship. A platform that outlasts the role. An album completed. Parents cared for.</div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ══ JOURNAL ════════════════════════════════════════════════ */}
          {tab==="journal"&&(
            <>
              {/* Day One-style calendar */}
              <div style={{background:"rgba(255,255,255,0.42)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.6)",borderRadius:20,padding:18,marginTop:4,marginBottom:14,boxShadow:"0 2px 16px rgba(11,25,41,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <button onClick={()=>setJMonth(p=>{const d=new Date(p.y,p.m-2,1);return{y:d.getFullYear(),m:d.getMonth()+1};})} style={{background:"none",border:"none",fontSize:20,color:"#64748B",cursor:"pointer",padding:"4px 10px"}}>‹</button>
                  <div style={{fontSize:16,fontWeight:800,color:"#0B1929"}}>{new Date(jMonth.y,jMonth.m-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
                  <button onClick={()=>setJMonth(p=>{const d=new Date(p.y,p.m,1);return{y:d.getFullYear(),m:d.getMonth()+1};})} style={{background:"none",border:"none",fontSize:20,color:"#64748B",cursor:"pointer",padding:"4px 10px"}}>›</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
                    <div key={d} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{d}</div>
                  ))}
                </div>
                <div className="jcal-grid">
                  {getCalDays(jMonth.y,jMonth.m).map((day,i)=>{
                    if(!day)return<div key={`e${i}`} className="jcal-cell empty"/>;
                    const ds=`${jMonth.y}-${String(jMonth.m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const hasEntry=!!(journal[ds]&&journal[ds].trim());
                    const isToday=ds===today; const isViewing=jViewDate===ds; const isFuture=ds>today;
                    return(
                      <div key={ds} className={`jcal-cell ${hasEntry?"has-entry":""} ${isToday&&!hasEntry?"today-cell":""} ${isFuture?"future":""}`}
                        style={{background:hasEntry?"linear-gradient(135deg,#1A3A6B,#2563EB)":isToday?"transparent":"rgba(255,255,255,0.3)",color:hasEntry?"#fff":isToday?"#2563EB":"#64748B",border:isToday&&!hasEntry?"2px solid #2563EB":isViewing&&!hasEntry?"2px solid #F59E0B":"none",boxShadow:isViewing?"0 0 0 2px #F59E0B":"none"}}
                        onClick={()=>{if(!isFuture)setJViewDate(ds===jViewDate?null:ds);}}>
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"#64748B"}}>{Object.keys(journal).filter(k=>journal[k]?.trim()).length} entries this year</div>
              </div>

              {jViewDate&&jViewDate!==today?(
                <>
                  <div style={{background:"rgba(255,255,255,0.55)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.65)",borderRadius:18,padding:20,marginBottom:12,boxShadow:"0 2px 16px rgba(11,25,41,0.05)"}}>
                    <div style={{fontSize:22,fontWeight:800,color:"#0B1929",letterSpacing:"-0.02em",marginBottom:2}}>{new Date(jViewDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
                    <div style={{fontSize:12,fontWeight:600,color:"#64748B",marginBottom:16}}>{new Date(jViewDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"})}</div>
                    {journal[jViewDate]?.trim()
                      ?<div style={{fontSize:15,lineHeight:1.75,color:"#334155",whiteSpace:"pre-wrap"}}>{journal[jViewDate]}</div>
                      :<div style={{fontSize:14,color:"#94A3B8",fontStyle:"italic"}}>No entry for this day.</div>
                    }
                  </div>
                  <button onClick={()=>setJViewDate(null)} style={{width:"100%",padding:14,background:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.6)",borderRadius:14,color:"#64748B",fontSize:15,fontWeight:600,cursor:"pointer",backdropFilter:"blur(12px)"}}>Back to today</button>
                </>
              ):(
                <>
                  <div className="sec"><div className="sec-title">Today's Reflection</div><div className="sec-sub">{new Date().toLocaleDateString("en-US",{weekday:"long"})}</div></div>
                  <textarea className="journal-input" rows={8} placeholder={"What is God saying to you today?\n\nWhat are you grateful for?\n\nWhat do you need to surrender?"} value={journalInput} onChange={e=>saveJournalEntry(e.target.value)} style={{marginBottom:14}}/>
                  {Object.entries(journal).filter(([d,t])=>d!==today&&t&&t.trim()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5).length>0&&(
                    <>
                      <div className="sec"><div className="sec-title">Recent</div></div>
                      {Object.entries(journal).filter(([d,t])=>d!==today&&t&&t.trim()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5).map(([d,t])=>{
                        const dt=new Date(d+"T12:00:00");
                        return(
                          <div key={d} style={{background:"rgba(255,255,255,0.45)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.6)",borderRadius:16,padding:"16px 18px",marginBottom:10,boxShadow:"0 2px 12px rgba(11,25,41,0.05)",cursor:"pointer"}}
                            onClick={()=>{setJMonth({y:dt.getFullYear(),m:dt.getMonth()+1});setJViewDate(d);}}>
                            <div style={{fontSize:13,fontWeight:800,color:"#2563EB",marginBottom:4}}>{dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
                            <div style={{fontSize:13,color:"#64748B",lineHeight:1.55,fontStyle:"italic"}}>{t.length>160?t.slice(0,160)+"…":t}</div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}

              <div className="vision-card" style={{marginTop:8}}>
                {[["Stewardship","Care for what God entrusted: health, family, finances, talent, platform."],["Service","Act humbly. IJM. Family presence. Platform for others."],["Scale","Build and multiply. Legacy for children. Platform that outlasts the role."],["Sweat","Work hard. God-honoring things face natural resistance."],["Sabbath","Three Sundays per month minimum. Rest in sovereignty."]].map(([n,d])=>(
                  <div className="tenet-row" key={n}><div className="tenet-s">S</div><div><div style={{fontSize:15,fontWeight:700,color:"#0B1929",marginBottom:2}}>{n}</div><div style={{fontSize:13,color:"#64748B",lineHeight:1.4}}>{d}</div></div></div>
                ))}
              </div>
            </>
          )}

          {/* ══ HEALTH ══════════════════════════════════════════════════ */}
          {tab==="health"&&(
            <>
              {/* PROTEIN HERO */}
              <div style={{background:"linear-gradient(145deg,#071013,#0D2030,#0F2D3A)",borderRadius:20,padding:"22px 20px 20px",marginBottom:12,marginTop:4,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(7,16,19,0.15)"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent)"}}/>
                <div style={{position:"absolute",top:-40,right:-30,width:160,height:160,background:"radial-gradient(circle,rgba(35,181,211,0.1),transparent 70%)"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:12}}>Daily Protein</div>
                  <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:16}}>
                    {/* Ring */}
                    <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
                      <svg viewBox="0 0 80 80" style={{transform:"rotate(-90deg)"}}>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7"/>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#23B5D3" strokeWidth="7"
                          strokeDasharray={`${Math.min(todayProtein/proteinTarget,1)*213.6} 213.6`}
                          strokeLinecap="round"/>
                      </svg>
                      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <div style={{fontSize:18,fontWeight:900,color:"#FFFFFF",lineHeight:1}}>{todayProtein}</div>
                        <div style={{fontSize:8,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em"}}>/ {proteinTarget}g</div>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:32,fontWeight:900,color:"#FFFFFF",letterSpacing:"-0.03em",lineHeight:1}}>{Math.round((todayProtein/proteinTarget)*100)}%</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:4}}>{proteinTarget-todayProtein>0?`${proteinTarget-todayProtein}g to go`:"Target hit ✓"}</div>
                      <div style={{fontSize:10,fontWeight:700,color:"#23B5D3",marginTop:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>{proteinLog.length} entries today</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{height:2,background:"rgba(255,255,255,0.1)",borderRadius:0,overflow:"hidden"}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,#23B5D3,#75ABBC)",width:`${Math.min((todayProtein/proteinTarget)*100,100)}%`,transition:"width 0.6s"}}/>
                  </div>
                </div>
              </div>

              {/* QUICK ADD */}
              <div className="sec"><div className="sec-title">Quick Add</div><div className="sec-sub">Tap to log</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {PROTEIN_PRESETS.filter(p=>p.grams>0).map(p=>(
                  <button key={p.label} onClick={()=>logProtein(p)} style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.15)",borderRadius:12,padding:"12px 8px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 2px 8px rgba(7,16,19,0.05)",textAlign:"center"}}>
                    <div style={{fontSize:22,marginBottom:4}}>{p.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#071013",lineHeight:1.2,marginBottom:2}}>{p.label}</div>
                    <div style={{fontSize:12,fontWeight:800,color:"#23B5D3"}}>{p.grams}g</div>
                  </button>
                ))}
                <button onClick={()=>setShowCustom(p=>!p)} style={{background:showCustom?"#EAF7FB":"#FFFFFF",border:`1.5px ${showCustom?"solid #23B5D3":"solid rgba(35,181,211,0.15)"}`,borderRadius:12,padding:"12px 8px",cursor:"pointer",textAlign:"center",boxShadow:"0 2px 8px rgba(7,16,19,0.05)"}}>
                  <div style={{fontSize:22,marginBottom:4}}>✏️</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#071013",marginBottom:2}}>Custom</div>
                  <div style={{fontSize:11,color:"#A2AEBB"}}>any amount</div>
                </button>
              </div>

              {/* CUSTOM INPUT */}
              {showCustom&&(
                <div style={{background:"#FFFFFF",border:"1.5px solid #23B5D3",borderRadius:12,padding:"14px 16px",marginBottom:12,display:"flex",gap:10,alignItems:"center",boxShadow:"0 0 0 3px rgba(35,181,211,0.1)"}}>
                  <input
                    type="number" placeholder="Enter grams…"
                    value={customGrams} onChange={e=>setCustomGrams(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&logCustomProtein()}
                    style={{flex:1,border:"none",outline:"none",fontSize:17,fontWeight:700,color:"#071013",background:"transparent"}}
                    autoFocus
                  />
                  <span style={{fontSize:14,fontWeight:700,color:"#A2AEBB"}}>g</span>
                  <button onClick={logCustomProtein} style={{background:"#23B5D3",border:"none",borderRadius:8,padding:"9px 16px",color:"#FFFFFF",fontSize:13,fontWeight:800,cursor:"pointer"}}>Add</button>
                  <button onClick={()=>{setShowCustom(false);setCustomGrams("");}} style={{background:"none",border:"none",color:"#A2AEBB",fontSize:18,cursor:"pointer"}}>✕</button>
                </div>
              )}

              {/* TODAY'S LOG */}
              {proteinLog.length>0&&(
                <>
                  <div className="sec"><div className="sec-title">Today's Log</div><button onClick={async()=>{setProteinLog([]);await save(`wb-protein-${todayKey()}`,[]);}} style={{background:"none",border:"none",fontSize:11,fontWeight:800,color:"#A2AEBB",cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase"}}>Clear all</button></div>
                  <div style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.12)",borderRadius:14,overflow:"hidden",marginBottom:16,boxShadow:"0 2px 10px rgba(7,16,19,0.05)"}}>
                    {proteinLog.map((e,i)=>(
                      <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<proteinLog.length-1?"1px solid rgba(35,181,211,0.07)":"none"}}>
                        <div style={{width:36,height:36,borderRadius:8,background:"#EAF7FB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                          {PROTEIN_PRESETS.find(p=>p.label===e.label)?.icon||"🍽️"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#071013"}}>{e.label}</div>
                          <div style={{fontSize:11,color:"#A2AEBB",marginTop:1}}>{new Date(e.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                        </div>
                        <div style={{fontSize:15,fontWeight:800,color:"#23B5D3",marginRight:4}}>{e.grams}g</div>
                        <button onClick={()=>deleteProteinEntry(e.id)} style={{background:"none",border:"none",color:"#DFE0E2",fontSize:18,cursor:"pointer",padding:"2px 4px",lineHeight:1}}>×</button>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"rgba(35,181,211,0.04)",borderTop:"1px solid rgba(35,181,211,0.1)"}}>
                      <div style={{fontSize:12,fontWeight:800,color:"#4A7080",letterSpacing:"0.08em",textTransform:"uppercase"}}>Total Today</div>
                      <div style={{fontSize:18,fontWeight:900,color:"#23B5D3"}}>{todayProtein}g <span style={{fontSize:12,color:"#A2AEBB",fontWeight:600}}>/ {proteinTarget}g</span></div>
                    </div>
                  </div>
                </>
              )}

              {/* WORKOUT SECTION */}
              <div style={{background:"linear-gradient(145deg,#071013,#0D2030,#0F2D3A)",borderRadius:20,padding:"22px 20px 20px",marginBottom:12,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(7,16,19,0.15)"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent)"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>This Week</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}}>
                    <div style={{fontSize:48,fontWeight:900,color:"#FFFFFF",lineHeight:1,letterSpacing:"-0.04em"}}>{Object.keys(workoutLog).length}</div>
                    <div style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>of 3 workouts</div>
                  </div>
                  <div style={{height:2,background:"rgba(255,255,255,0.1)",marginBottom:16,overflow:"hidden"}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,#23B5D3,#75ABBC)",width:`${Math.min((Object.keys(workoutLog).length/3)*100,100)}%`,transition:"width 0.6s"}}/>
                  </div>
                  {/* Weekly grid */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
                    {["M","T","W","T","F","S","S"].map((d,i)=>{
                      const date = new Date();
                      const dayOfWeek = date.getDay();
                      const mondayOffset = (dayOfWeek===0?-6:1-dayOfWeek);
                      const dayDate = new Date(date);
                      dayDate.setDate(date.getDate()+mondayOffset+i);
                      const dk = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;
                      const done = workoutLog[dk];
                      const isToday = dk===todayKey();
                      return(
                        <div key={i} style={{textAlign:"center"}}>
                          <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",marginBottom:4}}>{d}</div>
                          <div
                            onClick={()=>{if(done)removeWorkout(dk);else logWorkout(dk,"Lift");}}
                            style={{
                              width:"100%",aspectRatio:"1",borderRadius:6,
                              background:done?"#23B5D3":isToday?"rgba(35,181,211,0.15)":"rgba(255,255,255,0.06)",
                              border:`1px solid ${done?"#23B5D3":isToday?"rgba(35,181,211,0.4)":"rgba(255,255,255,0.1)"}`,
                              display:"flex",alignItems:"center",justifyContent:"center",
                              cursor:"pointer",transition:"all 0.15s",fontSize:10,
                            }}>
                            {done?<span style={{fontSize:11,fontWeight:800,color:"#FFFFFF"}}>{done.type.slice(0,1)}</span>:isToday?<span style={{fontSize:9,color:"rgba(35,181,211,0.7)"}}>+</span>:null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* LOG WORKOUT FOR TODAY */}
              <div className="sec"><div className="sec-title">Log Workout</div><div className="sec-sub">Tap to record today</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                {WORKOUT_TYPES.map(type=>{
                  const icons={"Lift":"🏋️","Run":"🏃","Walk":"🚶","Sport":"⚽","HIIT":"⚡","Other":"💪"};
                  const todayDone = workoutLog[todayKey()];
                  const isLogged = todayDone?.type===type;
                  return(
                    <button key={type} onClick={()=>isLogged?removeWorkout(todayKey()):logWorkout(todayKey(),type)}
                      style={{background:isLogged?"#EAF7FB":"#FFFFFF",border:`1.5px solid ${isLogged?"#23B5D3":"rgba(35,181,211,0.15)"}`,borderRadius:12,padding:"14px 8px",cursor:"pointer",textAlign:"center",boxShadow:"0 2px 8px rgba(7,16,19,0.05)",transition:"all 0.15s"}}>
                      <div style={{fontSize:24,marginBottom:4}}>{icons[type]}</div>
                      <div style={{fontSize:12,fontWeight:700,color:isLogged?"#0D6B85":"#071013"}}>{type}</div>
                      {isLogged&&<div style={{fontSize:9,fontWeight:800,color:"#23B5D3",marginTop:2,letterSpacing:"0.08em"}}>DONE ✓</div>}
                    </button>
                  );
                })}
              </div>

              {/* MINIMUM PROTOCOL */}
              <div className="sec"><div className="sec-title">The Protocol</div><div className="sec-sub">When time is short</div></div>
              <div style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.12)",borderRadius:14,padding:18,marginBottom:12,boxShadow:"0 2px 10px rgba(7,16,19,0.05)"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#23B5D3",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>12-Minute Minimum</div>
                <div style={{fontSize:12,color:"#4A7080",lineHeight:1.7,marginBottom:12}}>When the day closes in, this is non-negotiable. 12 minutes. No equipment. Gets it done.</div>
                {[["0:00–3:00","5 push-ups, 5 squats, 5 hip hinges × 3 sets. No rest. Get the blood moving."],["3:00–7:00","10 push-ups, 10 lunges (each leg), 10 pike push-ups. One set each."],["7:00–10:00","Max push-ups, max bodyweight squats, 30-sec plank. One round."],["10:00–12:00","Dead hang or doorframe pull-up hold. Finish with 10 slow deep breaths."]].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:12,paddingBottom:10,marginBottom:10,borderBottom:"1px solid rgba(35,181,211,0.07)"}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#23B5D3",letterSpacing:"0.06em",width:56,flexShrink:0,paddingTop:2}}>{t}</div>
                    <div style={{fontSize:13,color:"#071013",lineHeight:1.6}}>{d}</div>
                  </div>
                ))}
                <div style={{fontSize:11,fontWeight:700,color:"#7A9AAA",fontStyle:"italic",marginTop:4}}>Done is better than perfect. Log it. Streak protected.</div>
              </div>

              {/* WEEKLY CONSISTENCY TIP */}
              <div style={{background:"#EAF7FB",border:"1px solid rgba(35,181,211,0.2)",borderRadius:14,padding:16,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:800,color:"#0D6B85",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>The Real Fix</div>
                <div style={{fontSize:13,color:"#2A4050",lineHeight:1.7}}>The workout isn't the problem — the schedule is. Block 6:00–6:30am in your calendar as immovable. Before the day exists. Before email. Before anyone needs anything from you. Everything else is a negotiation. This block isn't.</div>
              </div>
            </>
          )}
        </div>

        {/* BOTTOM NAV — SVG line icons */}
        <div className="bottom-nav">
          {[
            {id:"today",lbl:"Today",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 13"/></svg>},
            {id:"rhythms",lbl:"Rhythms",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>},
            {id:"platform",lbl:"Platform",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>},
            {id:"progress",lbl:"Progress",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>},
            {id:"planner",lbl:"Plan",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 7h8M8 12h8M8 17h5"/></svg>},
            {id:"music",lbl:"Music",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><circle cx="8" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M11 18V7l10-2v9"/></svg>},
            {id:"journal",lbl:"Journal",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>},
            {id:"health",lbl:"Health",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>},
          ].map(n=>(
            <button key={n.id} className={"nav-btn"+(tab===n.id?" active":"")} onClick={()=>setTab(n.id)}>
              <div className="nav-icon">{n.path}</div>
              <div className="nav-lbl">{n.lbl}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
