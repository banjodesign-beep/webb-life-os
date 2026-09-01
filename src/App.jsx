import React, { useState, useEffect, useCallback, useRef } from "react";
import { load, save, hasLocalSnapshot, isDegraded, subscribeSync, retrySync, flushPending } from "./lib/supabase.js";
import { resolveStreakAdvance, checkMilestone, accrueGraceToken } from "./lib/streakEngine.js";
import { CATEGORY_LABELS, GRACE_TOKENS_PER_WEEK, GRACE_TOKEN_CAP, MILESTONE_BONUS_XP, generateMilestoneList,
         KEYSTONE_XP, ARC_STEP_XP, ARC_COMPLETE_XP, GOAL_XP, WORKOUT_XP } from "./config/meridianConfig.js";
import MilestoneJourney from "./components/MilestoneJourney.jsx";
import MilestoneSplash from "./components/MilestoneSplash.jsx";
import { pickKeystone, pickSabbathInvitation } from "./config/keystoneLibrary.js";
import { DEFAULT_ARCS, nextStep, isArcComplete, pickArc } from "./config/arcs.js";
import { buildWeeklyReview } from "./lib/weeklyReview.js";

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
const getPastDays = (n) => { const days=[]; for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(localDate(d));} return days; };
const getLevelInfo = (xp) => {
  const T=[{l:1,max:499,t:"Getting Started"},{l:2,max:999,t:"Building Rhythm"},{l:3,max:1999,t:"Gaining Momentum"},{l:4,max:3499,t:"In the Flow"},{l:5,max:5999,t:"Man After God\'s Heart"},{l:6,max:Infinity,t:"Legacy Builder"}];
  const tier=T.find(t=>xp<=t.max)||T[T.length-1]; const prev=T[T.indexOf(tier)-1],pm=prev?prev.max:-1;
  return {...tier,progress:tier.max===Infinity?100:Math.round(((xp-pm-1)/(tier.max-pm))*100)};
};
const JOURNAL_PROMPTS = [
  "What deserves your best attention — not your most attention?",
  "What did today ask of you that you weren't expecting?",
  "Where did you feel most like yourself today?",
  "What's one thing you're carrying that isn't actually yours to carry?",
  "What would today have looked like if you'd trusted yourself more?",
  "Who did you think about today, and what did that mean?",
  "What's quietly working, that you haven't given yourself credit for?",
  "What are you avoiding, and what is it costing you to avoid it?",
  "What moment today would you want to remember in five years?",
  "What did your body tell you today that your mind ignored?",
  "Where did you show up small, when the moment called for more?",
  "What's one honest sentence about how you actually feel right now?",
  "What would you tell a friend who had the day you just had?",
  "What's something you're proud of that no one else noticed?",
  "What's the pace you're keeping — and is it the pace you chose?",
  "What did you protect today, even in a small way?",
  "Where did grace show up today, in a form you almost missed?",
  "What's one thing that felt like enough, even if it wasn't much?",
  "What are you learning to let go of?",
  "What conversation today is still sitting with you?",
  "What would it look like to be gentler with yourself tomorrow?",
  "What's the truest thing you know today, even if it's small?",
  "Where did you choose connection over convenience?",
  "What's a fear you noticed today, and what did you do with it?",
  "What did you build today, even if it doesn't show yet?",
  "What's something ordinary today that was actually a gift?",
  "Where do you need rest that you haven't given yourself?",
  "What's one thing worth returning to tomorrow, exactly as it was?",
  "What did you say no to today, and how did that feel?",
  "What's a promise to yourself you kept without announcing it?",
  "Where did today ask for patience you didn't know you had?",
  "What's something you noticed today that you would have missed a year ago?",
  "What's the story you're telling yourself about today — and is it true?",
  "What would tomorrow look like if you led with curiosity instead of urgency?",
  "What's one thing that felt hard and worth it at the same time?",
  "Who showed up for you today, even in a small way?",
  "What's a question you're sitting with, without needing to answer it yet?",
  "What did you create space for today?",
  "What's something you did today purely because it mattered, not because it was efficient?",
  "What would the version of you a year from now want you to notice today?",
];
const getDailyJournalPrompt = () => {
  const start=new Date(new Date().getFullYear(),0,0);
  const day=Math.floor((new Date()-start)/864e5);
  return JOURNAL_PROMPTS[day%JOURNAL_PROMPTS.length];
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
  // NOTE: the Larger Arc now runs off arcs.js (checklists, derived progress).
  // This list remains for the Goals view. Progress values corrected — several
  // were showing stale figures (529s read 0% despite being open and funded).
  {id:"g0",domain:"family",title:"Annie\'s college pathway — depth over compliance",detail:"Theatre/Arts as spike. TCA College Pathways decision live.",target:"2029",progress:25},
  {id:"g1",domain:"family",title:"River\'s ceiling limited only by talent",detail:"Pride Club. Home training routine built.",target:"Ongoing",progress:40},
  {id:"g2",domain:"family",title:"Parents feel cared for",detail:"Conversation guide. Regular contact.",target:"2027",progress:15},
  {id:"g3",domain:"family",title:"20th anniversary marked",detail:"December 2, 2026.",target:"Dec 2026",progress:10},
  {id:"g4",domain:"platform",title:"The Sequence — manuscript complete",detail:"LinkedIn monthly. Ken Caldwell.",target:"Q1 2027",progress:20},
  {id:"g5",domain:"platform",title:"Recalibrated — publisher secured",detail:"Zondervan, IVP, WaterBrook.",target:"2027",progress:30},
  {id:"g6",domain:"platform",title:"BenWebb.com live",detail:"One home for all three projects.",target:"2027",progress:5},
  {id:"g7",domain:"financial",title:"529s open, funded, stepping up",detail:"CollegeInvest — auto-contributions and step-up live.",target:"Done",progress:90},
  {id:"g8",domain:"financial",title:"Household dashboard Jules-managed",detail:"Deployed. Monthly rhythm forming.",target:"Ongoing",progress:80},
  {id:"g17",domain:"financial",title:"Spousal Roth for Jules",detail:"Identified, not yet opened.",target:"2027",progress:0},
  {id:"g18",domain:"financial",title:"Fee-only fiduciary planner engaged",detail:"Once household surplus is established.",target:"2027",progress:0},
  {id:"g9",domain:"health",title:"Strength as primary modality",detail:"Lower body is the lever. Shoulder-safe.",target:"Ongoing",progress:40},
  {id:"g10",domain:"health",title:"Travel doesn\'t dismantle the routine",detail:"Sleep kit, hotel-room session, airport protein.",target:"Ongoing",progress:50},
  {id:"g16",domain:"faith",title:"Living from secure humility",detail:"Who am I? What am I worth? Am I safe?",target:"Ongoing",progress:15},
  {id:"g15",domain:"faith",title:"Three full Sabbaths a month",detail:"Worship team commitments factored in.",target:"Ongoing",progress:35},
];

const DOMAIN_CFG = {
  family:{label:"Family",color:"#2B5F7D"},
  platform:{label:"Platform",color:"#7A5C3E"},
  financial:{label:"Financial",color:"#3F6B54"},
  health:{label:"Health",color:"#8C4A3F"},
  faith:{label:"Faith",color:"#4C5470"},
  leadership:{label:"Leadership",color:"#55606B"},
  identity:{label:"Identity",color:"#6B5344"},
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

const APP_VERSION = "1.11";

// ── MOTION PREFERENCE ─────────────────────────────────────────────────
// CSS handles the declarative animations, but confetti, the XP float and
// the boot splash are JS-driven and have to opt out themselves.
function prefersReducedMotion(){
  if(typeof window==="undefined"||!window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

// ── CONFETTI + XP FLOAT ───────────────────────────────────────────────
function Confetti() {
  // No confetti at all under reduced motion — the completion state itself
  // is the feedback, and 50 falling elements is the opposite of subtle.
  if(prefersReducedMotion()) return null;
  const pieces = Array.from({length:50},(_,i)=>({
    id:i,x:Math.random()*100,
    color:["#35617E","#60A5FA","#34D399","#A78BFA","#FBBF24","#F472B6"][Math.floor(Math.random()*6)],
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
  const reduced = prefersReducedMotion();
  useEffect(()=>{const t=setTimeout(onDone,reduced?900:1200);return()=>clearTimeout(t);},[]);
  // Still shown when motion is reduced — the number is the information.
  // It just sits still and fades via opacity instead of flying upward.
  return <div role="status" aria-live="polite" style={{position:"fixed",bottom:140,right:24,fontWeight:800,fontSize:18,color:"#35617E",animation:reduced?"none":"xpFloat 1.2s ease-out forwards",opacity:reduced?0.95:undefined,pointerEvents:"none",zIndex:500}}>+{amount} pts</div>;
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
    // Under reduced motion the boot sequence is a 3.2s animation with no
    // information in it — skip straight through to the app.
    if(prefersReducedMotion()){ const t=setTimeout(onDone,150); return()=>clearTimeout(t); }
    const t1=setTimeout(()=>setPhase(1),400);
    const t2=setTimeout(()=>setPhase(2),300);
    const t3=setTimeout(()=>setPhase(3),2600);
    const t4=setTimeout(()=>onDone(),3200);
    return()=>[t1,t2,t3,t4].forEach(clearTimeout);
  },[]);

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:999,
      background:"#10171C",
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
        fontSize:42,fontWeight:900,color:"#DCE2E6",
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
        <div style={{fontSize:10,fontWeight:800,color:"#2B5F7D",letterSpacing:"0.2em"}}>{dateStr} · {modeLabel}</div>
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
        <div style={{fontSize:13,fontStyle:"italic",color:"#454F56",lineHeight:1.7,marginBottom:10}}>
          "{s.verse.length>120?s.verse.slice(0,120)+"…":s.verse}"
        </div>
        <div style={{fontSize:9,fontWeight:800,color:"#2B5F7D",letterSpacing:"0.18em",textTransform:"uppercase"}}>{s.ref}</div>
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
          <button key={item.id} type="button" role="checkbox" aria-checked={!!isDone}
            aria-label={`${item.text}${item.sub?" — "+item.sub:""}`}
            className="c-row" style={{animationDelay:`${idx*0.035}s`}} onClick={()=>onToggle(item.id,item,state)}>
            <div className={`c-icon-bg ${isDone?dc:""}`}>{item.icon}</div>
            <div className={`c-circle ${isDone?dc:""} ${isBounce?"bounce":""}`}/>
            <div className="c-body">
              <div className={`c-main ${isDone?"done":""}`}>{item.text}</div>
              <div className="c-hint">{item.sub}</div>
              {isDone&&val.at&&<div className="c-ts">{new Date(val.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
            <div className={`c-xp ${isDone?"done":travel?"travel":""}`}>{isDone?"✓":`+${item.xp}`}</div>
          </button>
        );
      })}
    </div>
  );
});

// ── SYNC CHIP ─────────────────────────────────────────────────────────
// Writes used to fail silently — save() caught the error and logged to the
// console. This is the visible counterpart: everything is already safe
// locally, and this says whether the server has it yet.
function SyncChip({state,onRetry}){
  const {status,pending} = state||{};
  if(status==="synced") return null;               // quiet when there's nothing to say
  const offline = status==="offline";
  return (
    <button
      type="button"
      onClick={offline?onRetry:undefined}
      aria-live="polite"
      title={offline
        ? `${pending} change${pending===1?"":"s"} saved on this device, waiting to sync. Tap to retry.`
        : "Syncing changes"}
      style={{
        display:"flex",alignItems:"center",gap:5,
        background:offline?"rgba(180,83,60,0.14)":"rgba(43,95,125,0.12)",
        border:`1px solid ${offline?"rgba(180,83,60,0.35)":"rgba(43,95,125,0.28)"}`,
        color:offline?"#B4533C":"#2B5F7D",
        borderRadius:999,padding:"5px 10px",fontSize:10.5,fontWeight:800,
        letterSpacing:"0.06em",cursor:offline?"pointer":"default",whiteSpace:"nowrap",
      }}>
      <span aria-hidden="true">{offline?"⚠":"⟳"}</span>
      <span>{offline?`Saved here · ${pending}`:"Syncing"}</span>
    </button>
  );
}

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
  background:#F1F3F4;
  background-image:
    linear-gradient(180deg,#FFFFFF 0%,#F2F4F5 45%,#E2E7EA 100%);
  background-attachment:fixed;
  color:#10171C;
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
.hdr-eyebrow{font-size:9px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#2B5F7D;margin-bottom:2px;}
.hdr-date{font-size:19px;font-weight:700;color:#10171C;letter-spacing:-0.02em;line-height:1.1;}
.hdr-right{display:flex;align-items:center;gap:8px;}
.gear-btn{width:34px;height:34px;border-radius:8px;background:rgba(35,181,211,0.08);border:1px solid rgba(35,181,211,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;transition:all 0.2s;}

/* HERO — keeps dark for contrast and drama */
.hero{border-radius:20px;padding:24px 20px 20px;margin-bottom:12px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(7,16,19,0.15);}
.hero-home{background:linear-gradient(145deg,#141A1F,#182530,#1B3443,#20455A);}
.hero-travel{background:linear-gradient(145deg,#161B1E,#1D2A31,#243B44,#2A4C57);}
.hero-saturday{background:linear-gradient(145deg,#151A17,#1C2620,#243328,#2E4433);}
.hero-sunday{background:linear-gradient(145deg,#1A1714,#251F19,#33291F,#41352A);}
.hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}
.hero::after{content:"";position:absolute;top:-60px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(35,181,211,0.12),transparent 70%);animation:glow 4s ease-in-out infinite;}

/* POINTS */
.pts-row{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:16px;position:relative;z-index:1;}
.pts-num{font-size:76px;font-weight:900;color:#FFFFFF;line-height:1;letter-spacing:-0.05em;animation:countUp 0.5s ease;}
.pts-label{font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;}
.pts-right{text-align:right;padding-bottom:6px;}
.pts-icon{font-size:36px;line-height:1;display:block;}
.pts-streak{font-size:10px;font-weight:700;color:#2B5F7D;margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;}
.h-prog-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;position:relative;z-index:1;}
.h-prog-label{font-size:9px;font-weight:800;color:rgba(255,255,255,0.4);letter-spacing:0.16em;text-transform:uppercase;}
.h-prog-pct{font-size:15px;font-weight:800;color:#2B5F7D;}
.h-track{height:2px;background:rgba(255,255,255,0.1);overflow:hidden;margin-bottom:18px;position:relative;z-index:1;}
.h-fill{height:100%;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.h-fill-home{background:linear-gradient(90deg,#2B5F7D,#6B8494);}
.h-fill-travel{background:linear-gradient(90deg,#2B5F7D,#6B8494);}
.h-fill-saturday{background:linear-gradient(90deg,#2B5F7D,#8B99A3);}
.h-fill-sunday{background:linear-gradient(90deg,#6B8494,#8B99A3);}
.h-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.06);position:relative;z-index:1;border-radius:2px;overflow:hidden;}
.h-stat{background:rgba(0,0,0,0.3);padding:12px 10px;}
.h-stat-val{font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;}
.h-stat-lbl{font-size:8px;font-weight:800;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.14em;margin-top:3px;}

/* MODE BADGE */
.mode-badge{border-radius:12px;padding:10px 15px;margin-bottom:12px;display:flex;align-items:center;gap:10px;}
.mode-badge-sun{background:rgba(117,171,188,0.15);border:1px solid rgba(117,171,188,0.25);}
.mode-badge-sat{background:rgba(35,181,211,0.1);border:1px solid rgba(35,181,211,0.2);}
.mode-badge-travel{background:rgba(35,181,211,0.1);border:1px solid rgba(35,181,211,0.2);}
.mb-text{font-size:13px;font-weight:800;color:#10171C;letter-spacing:0.04em;text-transform:uppercase;}
.mb-sub{font-size:11px;color:#3E525E;margin-top:2px;}

/* XP CARD */
.xp-card{background:rgba(255,255,255,0.85);border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:14px 18px;margin-bottom:12px;box-shadow:0 2px 12px rgba(7,16,19,0.06);}
.xp-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.xp-level{font-size:12px;font-weight:800;color:#10171C;letter-spacing:0.08em;text-transform:uppercase;}
.xp-pts{font-size:12px;font-weight:600;color:#6E7F8A;letter-spacing:0.04em;}
.xp-track{height:3px;background:rgba(35,181,211,0.12);border-radius:100px;overflow:hidden;}
.xp-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#2B5F7D,#6B8494);transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}

/* SCRIPTURE */
.scripture-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.15);border-radius:14px;padding:18px;margin-bottom:12px;box-shadow:0 2px 12px rgba(7,16,19,0.05);}
.scripture-verse{font-size:14px;font-weight:400;color:#2C3A44;line-height:1.75;font-style:italic;}
.scripture-ref{font-size:9px;font-weight:800;color:#2B5F7D;margin-top:10px;letter-spacing:0.16em;text-transform:uppercase;}

/* DATE STRIP */
.date-strip{display:flex;gap:5px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:none;}
.date-strip::-webkit-scrollbar{display:none;}
.day-chip{display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0;width:42px;}
.day-chip-inner{width:42px;height:58px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:1px solid rgba(35,181,211,0.15);transition:all 0.15s;background:rgba(255,255,255,0.7);}
.day-chip-inner.today{border-color:#2B5F7D;background:#EDF1F3;}
.day-chip-inner.viewing{border-color:#6B8494;background:#EAF2F6;}
.day-chip-dow{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#6E7F8A;}
.day-chip-num{font-size:16px;font-weight:800;color:#10171C;line-height:1;}
.day-chip-inner.today .day-chip-dow{color:#2B5F7D;}
.day-chip-inner.today .day-chip-num{color:#10171C;}
.day-chip-inner.viewing .day-chip-num{color:#2B5F7D;}
.day-dot{width:4px;height:4px;border-radius:50%;margin-top:1px;}

/* SECTION HEADERS */
.sec{margin:22px 0 10px;display:flex;align-items:center;justify-content:space-between;}
.sec-title{font-size:11px;font-weight:800;color:#10171C;letter-spacing:0.18em;text-transform:uppercase;}
.sec-sub{font-size:11px;color:#6E7F8A;letter-spacing:0.04em;}
.sec-btn{font-size:11px;font-weight:800;color:#2B5F7D;background:none;border:none;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;}

/* CHECK CARD */
.check-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 12px rgba(7,16,19,0.06);}
.c-row{display:flex;align-items:center;gap:13px;padding:14px 16px;border-bottom:1px solid rgba(35,181,211,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.1s;}
.c-row:last-child{border-bottom:none;}
.c-row:active{background:rgba(35,181,211,0.04);}
.c-icon-bg{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;background:rgba(35,181,211,0.08);transition:all 0.25s;}
.c-icon-bg.done{background:rgba(35,181,211,0.15);}
.c-icon-bg.done-travel{background:rgba(117,171,188,0.15);}
.c-circle{width:24px;height:24px;border-radius:6px;border:2px solid #8B99A3;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:#FFFFFF;}
.c-circle.done{background:#2B5F7D;border-color:#2B5F7D;}
.c-circle.done-travel{background:#6B8494;border-color:#6B8494;}
.c-circle.bounce{animation:bounceCheck 0.4s ease;}
.c-circle.done::after,.c-circle.done-travel::after{content:"✓";color:#FFFFFF;font-size:13px;font-weight:900;}
.c-body{flex:1;min-width:0;}
.c-main{font-size:15px;font-weight:600;color:#10171C;line-height:1.25;transition:color 0.2s;}
.c-main.done{color:#8B99A3;text-decoration:line-through;text-decoration-color:rgba(162,174,187,0.5);}
.c-hint{font-size:12px;color:#6E7F8A;margin-top:2px;line-height:1.4;}
.c-ts{font-size:9px;color:#8B99A3;margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;}
.c-xp{font-size:12px;font-weight:800;color:#2B5F7D;min-width:32px;text-align:right;}
.c-xp.travel{color:#6B8494;}
.c-xp.done{color:#DCE2E6;}

/* TRAVEL TOGGLE */
.travel-toggle{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;transition:all 0.2s;}
.travel-toggle.off{background:rgba(35,181,211,0.08);color:#3E525E;border:1px solid rgba(35,181,211,0.15);}
.travel-toggle.on{background:#2B5F7D;color:#FFFFFF;}

/* MODALS */
.modal-overlay{position:fixed;inset:0;background:rgba(7,16,19,0.6);z-index:200;display:flex;align-items:flex-end;}
.modal-sheet{background:#F6F8F9;border-radius:20px 20px 0 0;padding:28px 22px calc(40px + env(safe-area-inset-bottom));width:100%;max-height:90vh;overflow-y:auto;border-top:1px solid rgba(35,181,211,0.15);}
.modal-title{font-size:20px;font-weight:800;color:#10171C;margin-bottom:6px;}
.modal-sub{font-size:13px;color:#3E525E;margin-bottom:20px;}
.modal-input{width:100%;background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.2);border-radius:10px;padding:14px 16px;font-size:16px;font-weight:500;color:#10171C;outline:none;transition:all 0.2s;margin-bottom:12px;}
.modal-input:focus{border-color:#2B5F7D;box-shadow:0 0 0 3px rgba(35,181,211,0.1);}
.modal-input::placeholder{color:#8B99A3;}
.modal-btn{width:100%;padding:16px;border:none;border-radius:10px;background:#2B5F7D;color:#FFFFFF;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase;}
.modal-cancel{width:100%;padding:12px;border:none;background:transparent;color:#6E7F8A;font-size:13px;cursor:pointer;margin-top:8px;}

/* EDITOR */
.editor-overlay{position:fixed;inset:0;background:rgba(7,16,19,0.7);z-index:300;display:flex;flex-direction:column;}
.editor-sheet{flex:1;background:#F6F8F9;overflow-y:auto;margin-top:env(safe-area-inset-top);}
.editor-hdr{background:#FFFFFF;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(35,181,211,0.12);position:sticky;top:0;z-index:10;}
.editor-title{font-size:14px;font-weight:800;color:#10171C;letter-spacing:0.12em;text-transform:uppercase;}
.editor-close{background:#2B5F7D;border:none;border-radius:8px;padding:8px 18px;color:#FFFFFF;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;}
.editor-body{padding:16px;}
.editor-item{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:10px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(7,16,19,0.05);}
.editor-item-row{display:flex;align-items:center;gap:10px;}
.editor-icon-input{width:42px;height:42px;background:#F0F8FA;border:1px solid rgba(35,181,211,0.15);border-radius:8px;text-align:center;font-size:20px;cursor:pointer;flex-shrink:0;}
.editor-text-inputs{flex:1;}
.editor-field{width:100%;background:#F6F8F9;border:1px solid rgba(35,181,211,0.15);border-radius:6px;padding:7px 10px;font-size:13px;font-weight:600;color:#10171C;outline:none;margin-bottom:5px;transition:all 0.2s;}
.editor-field:last-child{margin-bottom:0;}
.editor-field:focus{border-color:#2B5F7D;background:#FFFFFF;}
.editor-field.small{font-size:12px;font-weight:400;color:#3E525E;}
.editor-field::placeholder{color:#8B99A3;}
.editor-xp{width:52px;background:#EDF1F3;border:1px solid rgba(35,181,211,0.2);border-radius:6px;padding:6px 8px;font-size:12px;font-weight:800;color:#2B5F7D;text-align:center;outline:none;}
.editor-del{background:none;border:none;color:#8B99A3;font-size:18px;cursor:pointer;padding:4px;flex-shrink:0;}
.editor-add-btn{width:100%;padding:13px;background:transparent;border:1.5px dashed rgba(35,181,211,0.3);border-radius:10px;color:#2B5F7D;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.12em;text-transform:uppercase;margin-top:4px;}

/* HISTORY */
.history-banner{background:#EDF1F3;border:1px solid rgba(35,181,211,0.2);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.history-banner-text{font-size:12px;font-weight:800;color:#17384A;letter-spacing:0.08em;text-transform:uppercase;}
.history-banner-btn{font-size:11px;font-weight:800;color:#2B5F7D;background:none;border:none;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;}

/* YEARMAP */
.yearmap-overlay{position:fixed;inset:0;background:rgba(7,16,19,0.7);z-index:200;display:flex;align-items:flex-end;}
.yearmap-sheet{background:#F6F8F9;border-radius:20px 20px 0 0;padding:24px 20px calc(40px + env(safe-area-inset-bottom));width:100%;max-height:85vh;overflow-y:auto;}
.yearmap-cell{width:26px;height:26px;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;}

/* GOALS */
.g-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);margin-bottom:10px;}
.g-card.complete{opacity:0.45;}
.g-hdr{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px;}
.g-dot{width:7px;height:7px;border-radius:2px;flex-shrink:0;margin-top:7px;}
.g-title{font-size:15px;font-weight:700;color:#10171C;line-height:1.3;flex:1;}
.g-done{width:26px;height:26px;border-radius:6px;border:2px solid #8B99A3;background:#FFFFFF;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#8B99A3;font-size:11px;font-weight:800;transition:all 0.2s;flex-shrink:0;}
.g-done.done{background:#2B5F7D;border-color:#2B5F7D;color:#FFFFFF;}
.g-detail{font-size:12px;color:#3E525E;margin-bottom:9px;line-height:1.5;}
.g-tag{display:inline-flex;font-size:9px;font-weight:800;padding:3px 9px;border-radius:4px;margin-bottom:12px;letter-spacing:0.1em;text-transform:uppercase;}
.g-prog-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.g-prog-track{flex:1;height:3px;background:rgba(35,181,211,0.12);border-radius:100px;overflow:hidden;}
.g-prog-fill{height:100%;border-radius:100px;transition:width 0.4s;}
.g-prog-pct{font-size:13px;font-weight:800;color:#10171C;width:36px;text-align:right;}
.g-slider{width:100%;-webkit-appearance:none;height:3px;background:rgba(35,181,211,0.12);border-radius:100px;outline:none;cursor:pointer;margin-bottom:10px;}
.g-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:6px;background:#2B5F7D;cursor:pointer;box-shadow:0 2px 8px rgba(35,181,211,0.3);}
.g-note{width:100%;background:#F6F8F9;border:1px solid rgba(35,181,211,0.15);border-radius:8px;padding:10px 12px;font-size:13px;color:#10171C;outline:none;resize:none;transition:all 0.2s;line-height:1.5;}
.g-note::placeholder{color:#8B99A3;}
.g-note:focus{border-color:#2B5F7D;background:#FFFFFF;}

/* DOMAIN GRID */
.d-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
.d-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.d-icon{font-size:20px;margin-bottom:8px;}
.d-lbl{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:#6E7F8A;margin-bottom:6px;}
.d-pct{font-size:32px;font-weight:900;letter-spacing:-0.03em;line-height:1;margin-bottom:8px;}
.d-bar{height:3px;background:rgba(35,181,211,0.1);border-radius:100px;overflow:hidden;}
.d-fill{height:100%;border-radius:100px;transition:width 0.8s;}

/* STAT CARD */
.stat-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(7,16,19,0.05);margin-bottom:12px;}
.s-row{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.s-row:last-child{border-bottom:none;}
.s-lbl{font-size:14px;color:#10171C;}
.s-val{font-size:14px;font-weight:800;color:#2B5F7D;}

/* ACHIEVEMENTS */
.ach-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px;}
.ach-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.1);border-radius:10px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:5px;opacity:0.25;transition:all 0.3s;box-shadow:0 1px 4px rgba(7,16,19,0.04);}
.ach-card.unlocked{opacity:1;border-color:rgba(35,181,211,0.3);background:#EDF1F3;}
.ach-icon{font-size:22px;line-height:1;}
.ach-name{font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#6E7F8A;text-align:center;line-height:1.3;}

/* CHIPS */
.chips{display:flex;gap:6px;margin-bottom:13px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{padding:7px 14px;border-radius:6px;border:1px solid rgba(35,181,211,0.2);background:#FFFFFF;color:#3E525E;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;transition:all 0.2s;letter-spacing:0.08em;text-transform:uppercase;}
.chip.active{border-color:var(--cc);color:var(--cc);background:rgba(35,181,211,0.06);}

/* MUSIC */
.music-hero{background:linear-gradient(145deg,#10171C,#121C24,#14262F);border-radius:18px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(7,16,19,0.2);}
.music-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}
.album-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.album-bar{height:4px;background:rgba(35,181,211,0.1);border-radius:100px;overflow:hidden;margin-bottom:8px;}
.album-fill{height:100%;background:linear-gradient(90deg,#2B5F7D,#6B8494);border-radius:100px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.prac-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;}
.prac-card{background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.15);border-radius:12px;padding:16px 10px;text-align:center;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(7,16,19,0.05);}
.prac-card.logged{background:#EDF1F3;border-color:#2B5F7D;}
.prac-card:active{transform:scale(0.97);}
.track-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(7,16,19,0.05);margin-bottom:8px;}
.track-card.priority{border-left:3px solid #2B5F7D;}
.track-hdr{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.track-title{font-size:14px;font-weight:700;color:#10171C;flex:1;cursor:pointer;}
.stage-sel{-webkit-appearance:none;background:#EDF1F3;border:1px solid rgba(35,181,211,0.2);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;color:#17384A;cursor:pointer;outline:none;}
.stage-sel.complete{background:#E8F5E9;border-color:rgba(56,142,60,0.3);color:#2E7D32;}
.track-bar{height:2px;background:rgba(35,181,211,0.1);overflow:hidden;margin-bottom:8px;border-radius:100px;}
.track-fill{height:100%;background:linear-gradient(90deg,#2B5F7D,#6B8494);border-radius:100px;transition:width 0.5s;}
.track-note{width:100%;background:#F6F8F9;border:none;border-radius:6px;padding:8px 10px;font-size:12px;color:#3E525E;outline:none;resize:none;line-height:1.4;}
.track-note:focus{outline:1px solid rgba(35,181,211,0.3);background:#FFFFFF;}

/* JOURNAL */
.journal-input{width:100%;background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.15);border-radius:14px;padding:16px 18px;font-size:15px;color:#10171C;outline:none;resize:none;transition:all 0.2s;line-height:1.7;box-shadow:0 2px 8px rgba(7,16,19,0.04);}
.journal-input::placeholder{color:#8B99A3;line-height:1.7;}
.journal-input:focus{border-color:#2B5F7D;box-shadow:0 0 0 3px rgba(35,181,211,0.1);}
.jcal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.jcal-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;color:#3E525E;background:rgba(255,255,255,0.7);}
.jcal-cell.empty{visibility:hidden;}
.jcal-cell.has-entry{background:#2B5F7D;color:#FFFFFF;font-weight:800;}
.jcal-cell.today-cell{border:2px solid #2B5F7D;color:#10171C;font-weight:800;background:#FFFFFF;}
.jcal-cell.today-cell.has-entry{border:none;}
.jcal-cell.future{opacity:0.25;cursor:default;}
.jcal-cell:not(.has-entry):not(.future):not(.empty):hover{background:rgba(35,181,211,0.1);}

/* PLANNER */
.plan-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.plan-priority-row{display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.plan-priority-row:last-child{border-bottom:none;}
.plan-num{width:26px;height:26px;border-radius:6px;background:#2B5F7D;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:12px;font-weight:900;flex-shrink:0;}
.plan-input{flex:1;border:none;outline:none;font-size:15px;font-weight:500;color:#10171C;background:transparent;}
.plan-input::placeholder{color:#8B99A3;}

/* PLATFORM */
.platform-hero{background:linear-gradient(145deg,#10171C,#0D1520,#101828,#0A1535);border-radius:18px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(7,16,19,0.2);}
.platform-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}

/* FINANCIAL */
.fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
.fin-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.fin-edit{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}

/* FRIENDS */
.friend-list{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.friend-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.friend-row:last-child{border-bottom:none;}
.friend-av{width:36px;height:36px;border-radius:8px;background:#2B5F7D;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:14px;font-weight:800;flex-shrink:0;}

/* VISION */
.vision-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:18px;box-shadow:0 2px 10px rgba(7,16,19,0.05);margin-bottom:10px;}
.quote-hero{background:linear-gradient(145deg,#10171C,#121C24,#14262F);border-radius:18px;padding:24px;margin-bottom:12px;position:relative;box-shadow:0 8px 32px rgba(7,16,19,0.2);}
.quote-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent);}

/* TENET */
.tenet-row{display:flex;align-items:flex-start;gap:13px;padding:12px 0;border-bottom:1px solid rgba(35,181,211,0.08);}
.tenet-row:last-child{border-bottom:none;}
.tenet-s{font-size:18px;font-weight:900;color:#2B5F7D;width:22px;flex-shrink:0;line-height:1.2;}

/* TODO */
.todo-input-row{display:flex;gap:8px;margin-bottom:10px;}
.todo-input{flex:1;background:#FFFFFF;border:1.5px solid rgba(35,181,211,0.15);border-radius:10px;padding:12px 14px;font-size:15px;color:#10171C;outline:none;transition:all 0.2s;box-shadow:0 2px 6px rgba(7,16,19,0.04);}
.todo-input::placeholder{color:#8B99A3;}
.todo-input:focus{border-color:#2B5F7D;}
.todo-add-btn{width:46px;height:46px;border-radius:10px;background:#2B5F7D;border:none;color:#FFFFFF;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:300;box-shadow:0 4px 12px rgba(35,181,211,0.3);}
.todo-circle{width:22px;height:22px;border-radius:6px;border:2px solid #8B99A3;flex-shrink:0;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;background:#FFFFFF;}
.todo-circle.done{background:#2B5F7D;border-color:#2B5F7D;}
.todo-circle.done::after{content:"✓";color:#FFFFFF;font-size:11px;font-weight:900;}
.todo-del{background:none;border:none;color:#8B99A3;font-size:18px;cursor:pointer;padding:4px;}

/* FORMS */
.add-form{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;padding:18px;margin-bottom:14px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.field{width:100%;background:#F6F8F9;border:1.5px solid rgba(35,181,211,0.15);border-radius:10px;padding:12px 14px;font-size:15px;color:#10171C;outline:none;margin-bottom:8px;transition:all 0.2s;}
.field::placeholder{color:#8B99A3;}
.field:focus{border-color:#2B5F7D;background:#FFFFFF;box-shadow:0 0 0 3px rgba(35,181,211,0.08);}
select.field{-webkit-appearance:none;cursor:pointer;}
.btn-row{display:flex;gap:8px;}
.btn-p{flex:1;padding:13px;background:#2B5F7D;border:none;border-radius:8px;color:#FFFFFF;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase;box-shadow:0 4px 12px rgba(35,181,211,0.25);}
.btn-s{flex:1;padding:13px;background:#F6F8F9;border:1px solid rgba(35,181,211,0.15);border-radius:8px;color:#3E525E;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.04em;}

/* BOTTOM NAV */
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(245,250,251,0.92);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-top:1px solid rgba(35,181,211,0.15);display:flex;z-index:50;padding:8px 0 calc(8px + env(safe-area-inset-bottom));box-shadow:0 -4px 20px rgba(7,16,19,0.08);}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 1px;cursor:pointer;border:none;background:transparent;color:#8B99A3;transition:color 0.2s;}
.nav-btn.active{color:#2B5F7D;}
.nav-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
.nav-lbl{font-size:7px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}

/* TOAST */
.toast{position:fixed;top:calc(80px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:#10171C;border:1px solid rgba(35,181,211,0.3);border-radius:8px;padding:10px 20px;font-size:12px;font-weight:800;color:#2B5F7D;z-index:300;white-space:nowrap;letter-spacing:0.08em;text-transform:uppercase;animation:fadeUp 0.3s ease;box-shadow:0 4px 20px rgba(7,16,19,0.3);}

/* FOOTER */
.col323-footer{text-align:center;padding:20px 20px 8px;}
.col323-verse{font-size:11px;font-style:italic;color:#6E7F8A;line-height:1.7;}
.col323-ref{font-size:9px;font-weight:800;color:#2B5F7D;letter-spacing:0.14em;text-transform:uppercase;margin-top:5px;}

.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:#10171C;}
.scroll{flex:1;overflow-y:auto;padding:14px 15px 110px;}
.r-tabs{display:flex;background:rgba(255,255,255,0.8);border:1px solid rgba(35,181,211,0.15);border-radius:10px;padding:4px;gap:3px;margin-bottom:14px;}
.r-tab{flex:1;padding:9px 4px;border:none;background:transparent;border-radius:7px;font-size:10px;font-weight:800;color:#6E7F8A;cursor:pointer;transition:all 0.2s;letter-spacing:0.1em;text-transform:uppercase;}
.r-tab.active{background:#2B5F7D;color:#FFFFFF;box-shadow:0 2px 8px rgba(35,181,211,0.25);}
.prompt-card{background:#EDF1F3;border:1px solid rgba(35,181,211,0.2);border-radius:12px;padding:13px 15px;margin-bottom:12px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.15s;}
.prompt-card:active{transform:scale(0.99);}
.trip-card{background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 10px rgba(7,16,19,0.05);}
.trip-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid rgba(35,181,211,0.07);}
.trip-row:last-child{border-bottom:none;}
/* CATEGORIES */
.cat-pills{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;scrollbar-width:none;}
.cat-pills::-webkit-scrollbar{display:none;}
.cat-pill{display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:100px;border:1.5px solid rgba(35,181,211,0.2);background:#FFFFFF;color:#3E525E;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;}
.cat-pill.active{border-color:#2B5F7D;background:#EDF1F3;color:#10171C;}
.cat-pill-count{background:#2B5F7D;color:#FFFFFF;font-size:9px;font-weight:800;border-radius:100px;padding:1px 6px;min-width:16px;text-align:center;}
.cat-add-form{display:flex;gap:8px;margin-bottom:10px;align-items:center;}
.cat-name-input{flex:1;background:#FFFFFF;border:1.5px solid #2B5F7D;border-radius:10px;padding:10px 14px;font-size:14px;color:#10171C;outline:none;}
.cat-name-input::placeholder{color:#8B99A3;}
.cat-add-confirm{padding:10px 16px;background:#2B5F7D;border:none;border-radius:8px;color:#FFFFFF;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;letter-spacing:0.06em;text-transform:uppercase;}
.cat-add-cancel{padding:10px;background:none;border:none;color:#8B99A3;font-size:16px;cursor:pointer;}
.cat-section{margin-bottom:4px;}
.cat-header{display:flex;align-items:center;gap:8px;padding:11px 16px;background:#FFFFFF;border:1px solid rgba(35,181,211,0.12);border-radius:14px;cursor:pointer;transition:all 0.15s;box-shadow:0 1px 4px rgba(7,16,19,0.04);}
.cat-section:has(.check-card) .cat-header{border-radius:14px 14px 0 0;border-bottom:none;}
.cat-header:active{background:#F6F8F9;}
.cat-chevron{flex-shrink:0;transition:transform 0.2s ease;display:flex;align-items:center;}
.cat-header-name{font-size:13px;font-weight:700;color:#10171C;letter-spacing:0.02em;}
.cat-rename-input{flex:1;border:none;border-bottom:2px solid #2B5F7D;background:transparent;font-size:13px;font-weight:700;color:#10171C;outline:none;padding-bottom:2px;}
.cat-collapsed-badge{font-size:10px;font-weight:700;color:#6E7F8A;background:rgba(35,181,211,0.08);padding:3px 8px;border-radius:100px;white-space:nowrap;}
.cat-clear-btn{font-size:10px;font-weight:800;color:#8B99A3;background:none;border:none;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;}
.cat-del-btn{font-size:14px;color:#8B99A3;background:none;border:none;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;}
.cat-del-btn:hover{color:#EF4444;}

/* ── Button resets ───────────────────────────────────────────────────
   These elements were clickable divs. As real buttons they inherit UA
   styling, so it has to be stripped for them to look unchanged. */
button.c-row,button.prompt-card,button.day-chip,button.tenet-row{
  width:100%;font:inherit;color:inherit;text-align:left;
  -webkit-appearance:none;appearance:none;
}
button.c-row{background:transparent;border:none;border-bottom:1px solid rgba(35,181,211,0.06);cursor:pointer;}
button.c-row:last-child{border-bottom:none;}
button.day-chip{width:auto;cursor:pointer;}
.cat-toggle{background:none;border:none;padding:0;margin:0;display:flex;align-items:center;cursor:pointer;}
.cat-header-name:focus-visible{outline-offset:1px;}

/* ── Focus visibility ────────────────────────────────────────────────
   Several controls were clickable divs with no focus treatment at all.
   Now that they're real buttons they need a visible ring. */
:focus-visible{outline:2px solid #2B5F7D;outline-offset:2px;border-radius:6px;}
.hero :focus-visible,.milestone-splash :focus-visible{outline-color:#9FD3EC;}

/* ── Reduced motion ──────────────────────────────────────────────────
   Confetti, bounce, XP float, splash, shimmer, glow and route
   transitions were all unconditional. Completion feedback must survive
   with motion off, so checks and progress still change state — they
   just stop moving. */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:0.001ms !important;
    animation-iteration-count:1 !important;
    transition-duration:0.001ms !important;
    scroll-behavior:auto !important;
  }
  .pts-num,.c-row,.c-circle.bounce{animation:none !important;}
  .hero{background-size:100% 100% !important;}
}
`;


// ── MAIN APP ──────────────────────────────────────────────────────────
export default function App() {
  const [splashDone,  setSplashDone]  = useState(false);
  const [tab,         setTab]         = useState("today");
  const [rhythmTab,   setRhythmTab]   = useState("weekly");
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);
  const [syncState,   setSyncState]   = useState({status:"synced",pending:0});
  const flushJournalRef = useRef(null);
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
  const [editingTripId, setEditingTripId] = useState(null);
  const [tripDraft,   setTripDraft]   = useState({dest:"",start:"",type:"IJM"});
  const [showAddTrip, setShowAddTrip] = useState(false);

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

  // Goals / journal / planner
  const [goals,       setGoals]       = useState(DEFAULT_GOALS);
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
  // Mirror of totalXP that is always current within a single tick. Award sites
  // used to read the `totalXP` closure, so two awards in the same tick could
  // both compute from the same base and one would be lost. Every mutation now
  // goes through adjustXP, which is also the single place a reversal can
  // subtract — previously keystone, arc, goal and workout awarded on completion
  // and refunded nothing on undo, so the score could be farmed by toggling.
  const xpRef = useRef(0);
  const adjustXP = useCallback(async (delta) => {
    if(!delta) return xpRef.current;
    const next = Math.max(0, (xpRef.current || 0) + delta);
    xpRef.current = next;
    setTotalXP(next);
    await save("wb-totalxp", next);
    return next;
  }, []);
  const [streaks,     setStreaks]     = useState({current:0,longest:0,lastDate:null,totalDays:0,sabbaths:0,practiceSessions:0,friendDinners:0,tripCount:0});
  // ── Engagement layer: stakes streaks, grace tokens, rest day, lesson toggle, milestones ──
  const [healthStreak, setHealthStreak] = useState({current:0,longest:0,lastDate:null});
  const [graceTokens,  setGraceTokens]  = useState(0);
  const [graceAccruedWeek, setGraceAccruedWeek] = useState(null);
  const [restDayToday, setRestDayToday] = useState(false);
  const [lessonThisWeek, setLessonThisWeek] = useState(false);
  const [arcBonus,    setArcBonus]    = useState({}); // {arcId:true} — completion bonus already paid
  const [milestoneAck, setMilestoneAck] = useState({main:0,health:0}); // highest milestone day already shown
  const [milestoneQueue, setMilestoneQueue] = useState([]); // pending splash celebrations
  const [progressSubTab, setProgressSubTab] = useState("stats"); // stats | rhythms | platform | health
  const [addingSubFor, setAddingSubFor] = useState(null); // todo id currently adding a sub-item
  const [subInput, setSubInput] = useState("");
  // Vision Anchor + Values (editable)
  const [visionAnchor, setVisionAnchor] = useState("Annie's path built on depth. River's ceiling limited by talent only. Jules is the primary relationship. A platform that outlasts the role. An album completed. Parents cared for.");
  const [editingVision, setEditingVision] = useState(false);
  const [visionDraft, setVisionDraft] = useState("");
  const [values, setValues] = useState([
    {n:"Stewardship",d:"Care for what God entrusted: health, family, finances, talent, platform."},
    {n:"Service",d:"Act humbly. Serve others. Family presence. Platform for others."},
    {n:"Scale",d:"Build and multiply. Legacy for children. Platform that outlasts the role."},
    {n:"Sweat",d:"Work hard. God-honoring things face natural resistance."},
    {n:"Sabbath",d:"Three Sundays per month minimum. Rest in sovereignty."},
  ]);
  const [editingValueIdx, setEditingValueIdx] = useState(null);
  const [valueDraft, setValueDraft] = useState({n:"",d:""});
  // Quick Capture — lingering notes on the main screen
  const [quickNotes, setQuickNotes] = useState([]); // [{id,text,kind,at}]
  const [quickInput, setQuickInput] = useState("");
  // Keystone — today's one thing, drawn from the strategic library
  const [keystoneOverrideId, setKeystoneOverrideId] = useState(null);
  const [keystoneWhy, setKeystoneWhy] = useState({}); // {taskId: "why it matters" text}
  const [keystoneMin, setKeystoneMin] = useState({}); // {taskId: "minimum version" text}
  const [keystoneSkip, setKeystoneSkip] = useState(0);      // "show another" offset
  const [recentKeystones, setRecentKeystones] = useState([]); // cooldown: last 20 ids
  const [keystoneDoneMap, setKeystoneDoneMap] = useState({}); // {dateStr: keystoneId}
  // Larger Arc — checklists, not percentages
  const [arcs, setArcs] = useState(DEFAULT_ARCS);
  const [arcOffset, setArcOffset] = useState(0);
  const [showMomentumInfo, setShowMomentumInfo] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [arcsSnapshot, setArcsSnapshot] = useState(null); // last week's arc state, for movement detection
  // Journal prompt of the day
  const [journalPromptSeed] = useState(()=>Math.floor(Math.random()*10000));
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
  const loadAll = useCallback(async () => {
      setLoadError(false);
      // Captured before anything can write, so it reflects the state at boot.
      const hadSnapshot = hasLocalSnapshot();
      const today = todayKey();
      const mode  = getModeForDate(today);
      const dkey  = getDayKey(today, mode);
      try {
        const timeout = new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),8000));
        const results = await Promise.race([
          Promise.all([
          load(dkey), load(`cl-weekly-${weekKey()}`), load(`cl-monthly-${monthKey()}`),
          load(`cl-annual-${yearKey()}`), load(`cl-ijm-${weekKey()}`), load(`cl-platform-${monthKey()}`),
          load("wb-goals-v5"),
          load("wb-friends-v2"), load("wb-fin-v2"),
          load("wb-totalxp"), load("wb-streaks-v4"), load("wb-ach-v3"),
          load("wb-trips-v1"), load("wb-travel-mode"), load("wb-travel-dest"),
          load(`wb-journal-${yearKey()}`), load(`wb-weekplan-${weekKey()}`),
          load("wb-planarchive"), load("wb-todos-v1"), load("wb-custom-lists"),
          load(`wb-history-${yearKey()}`),
          ]),
          timeout,
        ]);
        const [ds,ws,ms,as,ij,plt,g,fl,fin,xp,s,ach,tl,tm,dest,jrnl,wp,pa,tod,cl,hist] = results;

        // Cold start with no network AND no cache: nothing real was read.
        // Bail out before applying or writing anything. If we rendered
        // defaults here, the weekly grace accrual and arc snapshot below
        // would queue those defaults and overwrite live server data the
        // moment the connection came back.
        if(isDegraded() && !hadSnapshot){
          setLoadError(true); setLoading(false); return;
        }
        if(ds)  setDayStates(p=>({...p,[dkey]:ds}));
        if(ws)  setWeeklyState(ws); if(ms)  setMonthlyState(ms);
        if(as)  setAnnualState(as); if(ij)  setIjmState(ij);
        if(plt) setPlatState(plt);  if(g)   setGoals(g);
        if(fl) setFriendLog(fl);
        if(fin) setFinancials(fin); if(xp!==null&&xp!==undefined){ setTotalXP(xp); xpRef.current = xp; }
        if(s)   setStreaks(s);      if(ach) setUnlockedAch(ach);
        if(tl)  setTripLog(tl);    if(tm)  setTravelMode(tm);
        if(dest)setTravelDest(dest);

        // Keystone rotation state + arcs (checklist-based Larger Arc).
        const kRecent = await load("wb-keystone-recent");
        const kDone   = await load("wb-keystone-done");
        const savedArcs = await load("wb-arcs-v1");
        if(kRecent) setRecentKeystones(kRecent);
        if(kDone)   setKeystoneDoneMap(kDone);
        // Arc snapshot: stored once per week so the review can tell whether any
        // long-horizon step actually moved, rather than just how many are done.
        const snapMeta = await load("wb-arcs-snapshot");
        if(snapMeta){
          setArcsSnapshot(snapMeta.arcs||null);
          if(snapMeta.week!==weekKey()){
            const cur = (await load("wb-arcs-v1")) || DEFAULT_ARCS;
            await save("wb-arcs-snapshot",{week:weekKey(),arcs:cur});
            setArcsSnapshot(snapMeta.arcs||cur);
          }
        } else {
          const cur = (await load("wb-arcs-v1")) || DEFAULT_ARCS;
          await save("wb-arcs-snapshot",{week:weekKey(),arcs:cur});
          setArcsSnapshot(cur);
        }
        if(savedArcs && Array.isArray(savedArcs) && savedArcs.length){
          // Merge: keep saved step-completion, but pick up any newly shipped arcs.
          const merged = DEFAULT_ARCS.map(def=>{
            const prev = savedArcs.find(a=>a.id===def.id);
            if(!prev) return def;
            return {...def, completed: prev.completed,
              steps:(def.steps||[]).map(s=>{
                const ps=(prev.steps||[]).find(x=>x.id===s.id);
                return ps?{...s,done:!!ps.done}:s;
              })};
          });
          const custom = savedArcs.filter(a=>!DEFAULT_ARCS.some(d=>d.id===a.id));
          setArcs([...merged,...custom]);
        }
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
        // History is stored per calendar year. A 120-day momentum window
        // crosses Jan 1, so without last year's slice every January would
        // look like a cold start. Merge the previous year in behind it.
        try{
          const prevYear = new Date().getFullYear()-1;
          const prevHist = await load(`wb-history-${prevYear}`);
          if(prevHist) setHistory(p=>({...prevHist,...(hist||{}),...p}));
        }catch(e){ /* first year of use — nothing to merge */ }
        const av = await load("wb-avatar"); if(av) setAvatar(av);
        const cats = await load("wb-categories-v1");
        const proteinData = await load(`wb-protein-${todayKey()}`); if(proteinData) setProteinLog(proteinData);
        const workoutData = await load(`wb-workouts-${weekKey()}`); if(workoutData) setWorkoutLog(workoutData);
        if(cats && cats.length>0) setCategories(cats);

        // ── Engagement layer ──
        const ab = await load("wb-arc-bonus-v1"); if(ab) setArcBonus(ab);
        const hs = await load("wb-health-streak"); if(hs) setHealthStreak(hs);
        const mAck = await load("wb-milestone-ack"); if(mAck) setMilestoneAck(mAck);
        const restDay = await load(`wb-restday-${today}`); if(restDay) setRestDayToday(true);
        const lesson = await load(`wb-lesson-${weekKey()}`); if(lesson) setLessonThisWeek(true);
        const va = await load("wb-vision-anchor"); if(va) setVisionAnchor(va);
        const vals = await load("wb-values-v1"); if(vals) setValues(vals);
        const qc = await load("wb-quick-notes-v1"); if(qc) setQuickNotes(qc);

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
        setLoading(false);
      } catch(e){
        console.error("Load error:",e);
        // Showing the user their day matters more than proving the server is
        // reachable. If anything has ever been cached locally, render it and
        // reconcile in the background; the sync chip says we are offline.
        // The hard error screen is only for a genuine cold start with no data.
        if(hasLocalSnapshot()) setLoadError(false);
        else setLoadError(true);
        setLoading(false);
      }
  }, []);

  useEffect(()=>{ loadAll(); },[loadAll]);

  // Sync status feed from the write queue.
  useEffect(()=>subscribeSync((status,pending)=>setSyncState({status,pending})),[]);

  // Flush anything queued before the tab goes away or the user switches tabs.
  useEffect(()=>{
    const onHide=()=>{ flushJournalRef.current?.(); flushPending(); };
    window.addEventListener("pagehide",onHide);
    document.addEventListener("visibilitychange",onHide);
    return ()=>{ window.removeEventListener("pagehide",onHide); document.removeEventListener("visibilitychange",onHide); };
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

  // ── KEYSTONE ────────────────────────────────────────────────────────
  // Drawn from KEYSTONE_LIBRARY (60+ strategic prompts across faith, family,
  // health, platform, money, leadership, identity) rather than from today's
  // checklist. The checklist already has its own card — echoing it here made
  // the keystone a duplicate instead of the one thing that moves life forward.
  //
  // Sabbath deliberately gets NO keystone. A rest day with an assignment on it
  // isn't a rest day. Sunday renders an invitation instead (see render below).
  const dayOfYearNow = Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/864e5);
  const keystoneMode = todayMode === "travel" ? "travel" : getModeForDate(today);
  const isSabbathToday = keystoneMode === "sunday";

  const libraryKeystone = isSabbathToday ? null : pickKeystone({
    mode: keystoneMode,
    dayOfYear: dayOfYearNow + keystoneSkip,
    recentIds: recentKeystones,
  });
  // Manual override still supported: tapping "show me another" advances the
  // rotation rather than falling back to a checklist item.
  const keystoneItem = libraryKeystone;
  const sabbathInvitation = isSabbathToday ? pickSabbathInvitation(dayOfYearNow) : null;
  const keystoneDone = keystoneItem ? !!keystoneDoneMap[today] : false;
  const maintenanceItems = coreItems;
  const bonusItems = todayItems.filter(i=>i.w==="bonus");
  const maintDoneCount = maintenanceItems.filter(i=>todayState[i.id]?.checked).length;

  // ── CONSISTENCY (Phase 3) — cheap: history is already written daily ──
  const consistency14 = (()=>{
    const days = getPastDays(14);
    const scored = days.filter(d=>history[d]);
    if(scored.length===0) return null;
    return Math.round(scored.reduce((s,d)=>s+(history[d]?.pct||0),0)/scored.length);
  })();

  // ── YEARLY GOAL, SOFTLY SURFACED (doesn't touch XP/streak scoring) ──
  // A different open goal each day, so the year doesn't get lost inside
  // the week. Deterministic per day so it doesn't jump around on re-render.
  const dayOfYear = Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/864e5);
  const openGoals = goals.filter(g=>!g.completed);
  const surfacedGoal = openGoals.length>0 ? openGoals[dayOfYear%openGoals.length] : null;

  // Larger Arc: rotate through arcs that still have unchecked steps.
  const surfacedArc = pickArc(arcs, dayOfYear, arcOffset);
  const surfacedArcDone = surfacedArc ? (surfacedArc.steps||[]).filter(s=>s.done).length : 0;
  const surfacedArcNext = surfacedArc ? nextStep(surfacedArc) : null;

  // ── CONSISTENCY-BASED MOMENTUM (replaces the brittle all-or-nothing streak) ──
  // The old streak required every core item; one thin day reset it to zero,
  // which is demoralising and easy to abandon. A day now COUNTS if any of:
  //   · the keystone was done
  //   · at least half the core checklist was done
  //   · it was a Sabbath / declared rest day (rest is participation, not failure)
  // Tiers are tracked so a strong day still reads differently from a thin one.
  const dayTier=(ds)=>{
    const h = history[ds];
    const mode = getModeForDate(ds);
    if(mode==="sunday") return "rest";
    if(keystoneDoneMap[ds]) return "full";
    if(!h||!h.maxPts) return null;
    const pct = h.pct||0;
    if(pct>=80) return "full";
    if(pct>=40) return "partial";
    return null;
  };
  // Weekly review — reads the last seven days back and says something about it.
  const weeklyReview = buildWeeklyReview({
    history: history||{},
    keystoneDone: keystoneDoneMap,
    arcs,
    journalEntries: journal||{},
    prevArcsSnapshot: arcsSnapshot,
    today,
  });

  const momentum = (()=>{
    let current=0, best=0, run=0, active30=0, fullDays=0;
    const window = getPastDays(120);
    window.forEach(ds=>{
      const t = dayTier(ds);
      if(t){ run++; best=Math.max(best,run); } else { run=0; }
    });
    // current run counts backwards from today
    const back = getPastDays(120).slice().reverse();
    for(const ds of back){
      const t = dayTier(ds);
      if(t){ current++; } else if(ds!==today){ break; } else { break; }
    }
    getPastDays(30).forEach(ds=>{ const t=dayTier(ds); if(t){active30++; if(t==="full")fullDays++;} });
    return {current,best:Math.max(best,current),active30,fullDays};
  })();


  const todayPts  = todayItems.reduce((s,i)=>s+(todayState[i.id]?.checked?i.xp:0),0);
  const todayMax  = todayItems.reduce((s,i)=>s+i.xp,0);
  const todayPct  = todayMax>0?Math.round(todayPts/todayMax*100):0;

  const weeklyItems= lists.weekly||DEFAULT_LISTS.weekly;
  const weeklyMax  = weeklyItems.reduce((s,i)=>s+i.xp,0);
  const weeklyPts  = weeklyItems.reduce((s,i)=>s+(weeklyState[i.id]?.checked?i.xp:0),0);
  const weeklyPct  = weeklyMax>0?Math.round(weeklyPts/weeklyMax*100):0;
  const platItems  = lists.platform||DEFAULT_LISTS.platform;
  const goalsComplete   = goals.filter(g=>g.completed).length;
  const debtPct  = financials.debtStart>0?Math.round(((financials.debtStart-financials.debtCurrent)/financials.debtStart)*100):0;
  const savPct   = financials.savingsTarget>0?Math.min(100,Math.round((financials.savingsCurrent/financials.savingsTarget)*100)):0;
  const domainProgress = Object.keys(DOMAIN_CFG).reduce((acc,d)=>{
    const dg=goals.filter(g=>g.domain===d); acc[d]=dg.length?Math.round(dg.reduce((s,g)=>s+(g.progress||0),0)/dg.length):0; return acc;
  },{});
  const stats = {totalXP,streak:streaks.current,totalDays:streaks.totalDays||0,sabbaths:streaks.sabbaths||0,goalsComplete,practiceSessions:streaks.practiceSessions||0,friendDinners:streaks.friendDinners||0,tripCount:streaks.tripCount||0};
  const levelInfo = getLevelInfo(totalXP);
  const scripture = getDailyScripture();
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
    const nxp = await adjustXP(nowChecked ? item.xp : -item.xp);
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
        runningXP = await adjustXP(bonus);
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
    await adjustXP(nowChecked ? item.xp : -item.xp);
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
  const startEditTrip=(t)=>{setEditingTripId(t.id);setTripDraft({dest:t.dest,start:t.start?t.start.slice(0,10):"",type:t.type||"IJM"});setShowAddTrip(false);};
  const cancelEditTrip=()=>{setEditingTripId(null);setTripDraft({dest:"",start:"",type:"IJM"});};
  const saveEditTrip=async()=>{
    if(!tripDraft.dest.trim())return;
    const u=tripLog.map(t=>t.id===editingTripId?{...t,dest:tripDraft.dest.trim(),start:tripDraft.start?new Date(tripDraft.start+"T12:00:00").toISOString():t.start,type:tripDraft.type||"IJM"}:t);
    setTripLog(u);await save("wb-trips-v1",u);
    setEditingTripId(null);setTripDraft({dest:"",start:"",type:"IJM"});
  };
  const deleteTrip=async(id)=>{
    const u=tripLog.filter(t=>t.id!==id);setTripLog(u);await save("wb-trips-v1",u);
    const nst={...streaks,tripCount:Math.max(0,(streaks.tripCount||0)-1)};setStreaks(nst);await save("wb-streaks-v4",nst);
    if(editingTripId===id)cancelEditTrip();
  };
  const addManualTrip=async()=>{
    if(!tripDraft.dest.trim())return;
    const trip={id:`trip-${Date.now()}`,dest:tripDraft.dest.trim(),start:tripDraft.start?new Date(tripDraft.start+"T12:00:00").toISOString():new Date().toISOString(),type:tripDraft.type||"IJM"};
    const nl=[trip,...tripLog];setTripLog(nl);await save("wb-trips-v1",nl);
    const nst={...streaks,tripCount:(streaks.tripCount||0)+1};setStreaks(nst);await save("wb-streaks-v4",nst);
    setTripDraft({dest:"",start:"",type:"IJM"});setShowAddTrip(false);
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
  const moveEditorItem=(lk,idx,dir)=>setEditLists(p=>{
    const arr=[...p[lk]];const t=idx+dir;
    if(t<0||t>=arr.length)return p;
    [arr[idx],arr[t]]=[arr[t],arr[idx]];
    return {...p,[lk]:arr};
  });

  // ── VISION ANCHOR ─────────────────────────────────────────────────
  const startEditVision=()=>{setVisionDraft(visionAnchor);setEditingVision(true);};
  const saveVision=async()=>{
    const v=visionDraft.trim()||visionAnchor;
    setVisionAnchor(v);await save("wb-vision-anchor",v);
    setEditingVision(false);
  };

  // ── VALUES (the five S's) ────────────────────────────────────────
  const startEditValue=(idx)=>{setValueDraft({n:values[idx].n,d:values[idx].d});setEditingValueIdx(idx);};
  const saveValue=async()=>{
    const u=values.map((v,i)=>i===editingValueIdx?{n:valueDraft.n.trim()||v.n,d:valueDraft.d.trim()||v.d}:v);
    setValues(u);await save("wb-values-v1",u);
    setEditingValueIdx(null);
  };

  // ── QUICK CAPTURE — lingering notes ─────────────────────────────────
  // Stays on the main screen. A note doesn't need a home yet — it just
  // needs somewhere to sit until it does.
  const addQuickNote=async(kind="reflection")=>{
    if(!quickInput.trim())return;
    const n={id:`qc-${Date.now()}`,text:quickInput.trim(),kind,at:new Date().toISOString()};
    const nl=[n,...quickNotes];setQuickNotes(nl);await save("wb-quick-notes-v1",nl);
    setQuickInput("");
  };
  const deleteQuickNote=async(id)=>{
    const nl=quickNotes.filter(n=>n.id!==id);setQuickNotes(nl);await save("wb-quick-notes-v1",nl);
  };
  const promoteQuickNote=async(note,dest)=>{
    // Send a lingering note somewhere it can actually live — journal or a task.
    if(dest==="journal"){
      const merged = journalInput ? `${journalInput}\n\n${note.text}` : note.text;
      await saveJournalEntry(merged);
    } else if(dest==="task"){
      const u=[...todos,{id:`t-${Date.now()}`,text:note.text,done:false,categoryId:activeCatId,subitems:[]}];
      setTodos(u);await save("wb-todos-v1",u);
    }
    deleteQuickNote(note.id);
    showToast(dest==="journal"?"Moved into today's reflection":"Added to your tasks");
  };

  // ── JOURNAL ──────────────────────────────────────────────────────────
  // Journal used to upsert the entire year's object on every keystroke.
  // Now: local state updates immediately, persistence is debounced, and the
  // pending write is flushed on blur, tab change and page hide so nothing is
  // lost. journalDirtyRef holds the text that has not reached save() yet.
  const journalTimer = useRef(null);
  const journalDirtyRef = useRef(null);

  const flushJournal = useCallback(async ()=>{
    if(journalTimer.current){ clearTimeout(journalTimer.current); journalTimer.current=null; }
    const text = journalDirtyRef.current;
    if(text===null||text===undefined) return;
    journalDirtyRef.current = null;
    setJournal(prev=>{
      const upd={...prev,[today]:text};
      save(`wb-journal-${yearKey()}`,upd);
      return upd;
    });
  },[today]);

  flushJournalRef.current = flushJournal;

  const onJournalChange=(text)=>{
    setJournalInput(text);
    journalDirtyRef.current = text;
    if(journalTimer.current) clearTimeout(journalTimer.current);
    journalTimer.current = setTimeout(()=>{ flushJournal(); }, 800);
  };

  const saveJournalEntry=async(text)=>{
    setJournalInput(text);
    const upd={...journal,[today]:text};setJournal(upd);await save(`wb-journal-${yearKey()}`,upd);
  };

  // ── GOALS ────────────────────────────────────────────────────────────
  // ── KEYSTONE handlers ───────────────────────────────────────────────
  const completeKeystone=async()=>{
    if(!keystoneItem) return;
    const already = !!keystoneDoneMap[today];
    const nextMap = {...keystoneDoneMap};
    if(already){ delete nextMap[today]; }
    else { nextMap[today] = keystoneItem.id; }
    setKeystoneDoneMap(nextMap);
    await save("wb-keystone-done", nextMap);
    if(!already){
      const nextRecent = [keystoneItem.id, ...recentKeystones].slice(0,20);
      setRecentKeystones(nextRecent);
      await save("wb-keystone-recent", nextRecent);
      await adjustXP(KEYSTONE_XP);
      showToast("✦ Keystone done. +40 pts");
    } else {
      // Undoing has to give the points back, or the keystone can be farmed
      // by ticking and unticking. Recency history is left alone deliberately:
      // the prompt was surfaced, so it should still cool down.
      await adjustXP(-KEYSTONE_XP);
      showToast("Keystone reopened. −40 pts");
    }
  };
  const skipKeystone=()=>setKeystoneSkip(s=>s+1);

  // ── ARC handlers — the Larger Arc as an advanceable checklist ────────
  const toggleArcStep=async(arcId,stepId)=>{
    const u = arcs.map(a=>a.id!==arcId?a:{
      ...a, steps:(a.steps||[]).map(s=>s.id===stepId?{...s,done:!s.done}:s)
    });
    setArcs(u); await save("wb-arcs-v1", u);
    const arc = u.find(a=>a.id===arcId);
    const step = (arc?.steps||[]).find(s=>s.id===stepId);

    // Step points mirror on undo.
    await adjustXP(step?.done ? ARC_STEP_XP : -ARC_STEP_XP);

    // The completion bonus is awarded at most once per arc, tracked
    // separately. It used to re-fire every time any step of a finished arc
    // was unticked and reticked.
    const complete = isArcComplete(arc);
    const alreadyBonused = !!arcBonus[arcId];
    if(complete && !alreadyBonused){
      const nb = {...arcBonus, [arcId]: true};
      setArcBonus(nb); await save("wb-arc-bonus-v1", nb);
      await adjustXP(ARC_COMPLETE_XP);
      showToast(`🎯 "${arc.title}" complete! +${ARC_STEP_XP + ARC_COMPLETE_XP} pts`);
    } else if(!complete && alreadyBonused){
      const nb = {...arcBonus}; delete nb[arcId];
      setArcBonus(nb); await save("wb-arc-bonus-v1", nb);
      await adjustXP(-ARC_COMPLETE_XP);
      showToast(`"${arc.title}" reopened. −${ARC_COMPLETE_XP} pts`);
    } else {
      showToast(step?.done ? `Step forward. +${ARC_STEP_XP} pts` : `Step reopened. −${ARC_STEP_XP} pts`);
    }
  };
  const cycleArc=()=>setArcOffset(o=>o+1);

  const toggleGoalDone=async(id)=>{
    const g=goals.find(x=>x.id===id); if(!g) return;
    const u=goals.map(x=>x.id===id?{...x,completed:!x.completed,progress:!x.completed?100:x.progress}:x);
    setGoals(u); await save("wb-goals-v5",u);
    // Reopening a goal refunds the award. Without this, complete → reopen →
    // complete paid out every cycle.
    if(!g.completed){ await adjustXP(GOAL_XP); showToast(`🎯 Goal complete! +${GOAL_XP} pts`); }
    else { await adjustXP(-GOAL_XP); showToast(`Goal reopened. −${GOAL_XP} pts`); }
  };
  const updateGoalProgress=(id,progress)=>setGoals(g=>g.map(x=>x.id===id?{...x,progress}:x));
  const saveGoalProgress=async()=>await save("wb-goals-v5",goals);
  const updateGoalNote=async(id,notes)=>{const u=goals.map(g=>g.id===id?{...g,notes}:g);setGoals(u);await save("wb-goals-v5",u);};
  const addGoal=async()=>{if(!newGoal.title.trim())return;const g={...newGoal,id:`c-${Date.now()}`,progress:0};const u=[...goals,g];setGoals(u);await save("wb-goals-v5",u);setNewGoal({title:"",detail:"",domain:"family",target:""});setShowAddGoal(false);showToast("Goal added");};
  const saveEditGoal=async()=>{const u=goals.map(g=>g.id===editingGoal?{...g,...editGoalData}:g);setGoals(u);await save("wb-goals-v5",u);setEditingGoal(null);};
  const deleteGoal=async(id)=>{const u=goals.filter(g=>g.id!==id);setGoals(u);await save("wb-goals-v5",u);};

  // ── PLANNER ──────────────────────────────────────────────────────────
  const saveWeekPlan=async(upd)=>{
    setWeekPlan(upd);await save(`wb-weekplan-${weekKey()}`,upd);
    // NOTE: this used to call setHistory(null) — which wiped the daily-scoring
    // history from state on every plan save. Any later read of history[ds]
    // (date-strip dots, consistency, momentum) then threw on null. The plan
    // archive below is already a separate store; history should not be touched.
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
    // Only award if this day did not already hold a logged workout — changing
    // the type of an existing entry is an edit, not a new session.
    if(!workoutLog[dayKey]) await adjustXP(WORKOUT_XP);
    showToast(`💪 ${type} logged +${WORKOUT_XP} pts`);
  };
  const removeWorkout = async(dayKey) => {
    const had = !!workoutLog[dayKey];
    const nw = {...workoutLog}; delete nw[dayKey];
    setWorkoutLog(nw); await save(`wb-workouts-${weekKey()}`, nw);
    // Removing a workout has to take the points back with it.
    if(had) await adjustXP(-WORKOUT_XP);
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
  const addTodo=async()=>{if(!todoInput.trim())return;const u=[...todos,{id:`t-${Date.now()}`,text:todoInput.trim(),done:false,categoryId:activeCatId,subitems:[]}];setTodos(u);await save("wb-todos-v1",u);setTodoInput("");};
  const toggleTodo=async(id)=>{const u=todos.map(t=>t.id===id?{...t,done:!t.done}:t);setTodos(u);await save("wb-todos-v1",u);};
  const deleteTodo=async(id)=>{const u=todos.filter(t=>t.id!==id);setTodos(u);await save("wb-todos-v1",u);};
  // ── SUB-ITEMS ──────────────────────────────────────────────────────
  const addSubTodo=async(todoId)=>{
    if(!subInput.trim())return;
    const u=todos.map(t=>t.id===todoId?{...t,subitems:[...(t.subitems||[]),{id:`st-${Date.now()}`,text:subInput.trim(),done:false}]}:t);
    setTodos(u);await save("wb-todos-v1",u);setSubInput("");setAddingSubFor(null);
  };
  const toggleSubTodo=async(todoId,subId)=>{
    const u=todos.map(t=>t.id===todoId?{...t,subitems:(t.subitems||[]).map(s=>s.id===subId?{...s,done:!s.done}:s)}:t);
    setTodos(u);await save("wb-todos-v1",u);
  };
  const deleteSubTodo=async(todoId,subId)=>{
    const u=todos.map(t=>t.id===todoId?{...t,subitems:(t.subitems||[]).filter(s=>s.id!==subId)}:t);
    setTodos(u);await save("wb-todos-v1",u);
  };

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
        <div style={{fontSize:32,fontWeight:900,color:"#DCE2E6",letterSpacing:"0.28em",textTransform:"uppercase"}}>MERIDIAN</div>
        <div style={{height:1,width:80,background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.4),transparent)",margin:"12px 0"}}/>
        <div style={{fontSize:9,fontWeight:800,color:"#2B5F7D",letterSpacing:"0.18em",textTransform:"uppercase"}}>Loading…</div>
      </div>
    </>
  );

  if(loadError) return(
    <>
      <style>{CSS}</style>
      <div className="loading">
        <AppIcon size={56} style={{marginBottom:20,opacity:0.6}}/>
        <div style={{fontSize:16,fontWeight:700,color:"#DCE2E6",marginBottom:8,textAlign:"center",padding:"0 30px"}}>Couldn't load your day</div>
        <div style={{fontSize:13,color:"#454F56",marginBottom:24,textAlign:"center",padding:"0 40px",lineHeight:1.6}}>Your data is still safe — this device just couldn't reach it. Check your connection and try again.</div>
        <button onClick={()=>{setLoading(true);loadAll();}} style={{padding:"13px 28px",borderRadius:10,border:"none",background:"#2B5F7D",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Retry</button>
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
            await adjustXP(bonus);
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
            <div style={{fontSize:20,fontWeight:800,color:"#121A20",marginBottom:4}}>{yearKey()} in Review</div>
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
                        <div key={ds} className="yearmap-cell" style={{background:bg,color:h||isToday?"rgba(255,255,255,0.9)":"#CBD5E1",outline:isToday?"2px solid #35617E":"none"}}
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
                  <button key={key} onClick={()=>setEditorTab(key)} style={{flexShrink:0,padding:"8px 14px",borderRadius:100,border:"none",background:editorTab===key?"linear-gradient(135deg,#1A3A6B,#35617E)":"rgba(255,255,255,0.65)",color:editorTab===key?"#fff":"#64748B",fontSize:13,fontWeight:700,cursor:"pointer"}}>{label}</button>
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
              <button type="button" aria-label="Change profile photo" aria-expanded={showAvatarMenu}
                style={{position:"relative",cursor:"pointer",background:"none",border:"none",padding:0,lineHeight:0}}
                onClick={()=>setShowAvatarMenu(p=>!p)}>
                {avatar
                  ? <img src={avatar} style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"1px solid rgba(35,181,211,0.3)"}} alt="You"/>
                  : <AppIcon size={36}/>
                }
                <span aria-hidden="true" style={{position:"absolute",bottom:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#2B5F7D",border:"2px solid #10171C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#10171C",fontWeight:900}}>✎</span>
              </button>
              {/* AVATAR MENU */}
              {showAvatarMenu&&(
                <div style={{position:"absolute",top:60,left:18,background:"#121A1E",border:"1px solid rgba(35,181,211,0.2)",borderRadius:10,padding:8,zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",minWidth:180}}>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
                  <button onClick={()=>avatarInputRef.current?.click()} style={{display:"block",width:"100%",padding:"10px 14px",background:"none",border:"none",color:"#DCE2E6",fontSize:13,fontWeight:700,textAlign:"left",cursor:"pointer",letterSpacing:"0.04em"}}>📷 Upload Photo</button>
                  {avatar&&<button onClick={removeAvatar} style={{display:"block",width:"100%",padding:"10px 14px",background:"none",border:"none",color:"#454F56",fontSize:13,fontWeight:700,textAlign:"left",cursor:"pointer",borderTop:"1px solid rgba(255,255,255,0.06)",letterSpacing:"0.04em"}}>Remove Photo</button>}
                  <button onClick={()=>setShowAvatarMenu(false)} style={{display:"block",width:"100%",padding:"10px 14px",background:"none",border:"none",color:"#454F56",fontSize:12,textAlign:"left",cursor:"pointer",letterSpacing:"0.04em"}}>Cancel</button>
                </div>
              )}
              <div>
                <div className="hdr-eyebrow">{travelMode?`✈️ ${travelDest}`:"Meridian"}</div>
                <div className="hdr-date">{formatDate()}</div>
              </div>
            </div>
            <div className="hdr-right">
              <SyncChip state={syncState} onRetry={()=>retrySync()}/>
              <button className="gear-btn" onClick={openEditor} title="Edit checklists" aria-label="Edit checklists">⚙️</button>
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
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginBottom:4}}>{modeIcon()} {modeLabel()}</div>
                  <div className="pts-row">
                    <div>
                      <div className="pts-num">{viewDate?(history[viewDate]?.pts||0):todayPts}</div>
                      <div className="pts-label">of {viewDate?(history[viewDate]?.maxPts||0):todayMax} pts today</div>
                    </div>
                    <div className="pts-right">
                      <span className="pts-icon">{todayMode==="sunday"?"🕊️":todayMode==="saturday"?"🌄":travelMode?"✈️":"☀️"}</span>
                      <div className="pts-streak">🔥 {momentum.current}-day run</div>
                      {consistency14!==null&&<div className="pts-streak" style={{color:"rgba(255,255,255,0.5)",marginTop:2}}>the return is the win — {consistency14}% these 2 weeks</div>}
                    </div>
                  </div>
                  <div className="h-prog-row"><div className="h-prog-label">Today's completion</div><div className="h-prog-pct">{viewDate?(history[viewDate]?.pct||0):todayPct}%</div></div>
                  <div className="h-track"><div className={fillClass()} style={{width:`${viewDate?(history[viewDate]?.pct||0):todayPct}%`}}/></div>
                  <div className="h-stats">
                    <div className="h-stat"><div className="h-stat-val">{totalXP}</div><div className="h-stat-lbl">Total Pts</div></div>
                    <div className="h-stat"><div className="h-stat-val">{momentum.best}</div><div className="h-stat-lbl">Best Run</div></div>
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
                  <button onClick={()=>setShowMomentumInfo(v=>!v)} style={{marginLeft:"auto",display:"flex",gap:12,fontSize:11,fontWeight:800,color:"#6E7F8A",letterSpacing:"0.06em",background:"none",border:"none",cursor:"pointer",alignItems:"center"}}>
                    <span>{momentum.active30}/30 days active</span>
                    <span style={{color:"#CBD5E1"}}>·</span>
                    <span>{graceTokens} grace</span>
                    <span style={{fontSize:13,color:"#A6B2BA"}}>ⓘ</span>
                  </button>
                </div>
              )}

              {showMomentumInfo&&!viewDate&&(
                <div style={{background:"#F5F7F8",border:"1px solid rgba(35,181,211,0.22)",borderRadius:14,padding:"14px 16px",marginBottom:12,fontSize:12.5,color:"#3A4C57",lineHeight:1.6}}>
                  <div style={{fontWeight:800,color:"#17384A",marginBottom:8}}>How momentum works</div>
                  <div style={{marginBottom:8}}>
                    A day counts if <strong>any</strong> of these is true — the keystone is done,
                    half the core list is done, or it's a Sabbath or declared rest day.
                    Rest counts as participation, not as a break in the chain.
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8}}>
                    <span><strong>{momentum.current}</strong> day run</span>
                    <span><strong>{momentum.best}</strong> best</span>
                    <span><strong>{momentum.fullDays}</strong> full days this month</span>
                  </div>
                  <div style={{paddingTop:8,borderTop:"1px solid rgba(35,181,211,0.18)"}}>
                    <strong style={{fontWeight:800}}>Grace ({graceTokens} held).</strong> You earn one a week, up to four.
                    A missed day spends one automatically and keeps the run intact — you don't have to do anything.
                    They exist so a hard week doesn't erase a good quarter.
                  </div>
                  <div style={{marginTop:8}}>
                    <strong style={{fontWeight:800}}>Health run: {healthStreak.current} days.</strong> Tracked separately —
                    counts any day the health items on the core list were done.
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
                      <button key={ds} type="button" className="day-chip" onClick={()=>viewPastDay(ds)}
                        aria-label={`View ${new Date(ds+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}`}>
                        <div className={`day-chip-inner ${isToday?"today":""} ${isViewing?"viewing":""}`}>
                          <div className="day-chip-dow">{DAYS[d.getDay()]}</div>
                          <div className="day-chip-num">{d.getDate()}</div>
                          {dc&&<div className="day-dot" style={{background:dc}}/>}
                          {isToday&&!viewDate&&<div className="day-dot" style={{background:"#35617E"}}/>}
                        </div>
                      </button>
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
                      <div style={{fontSize:12,color:"#10171C",marginTop:2}}>{history[viewDate]?.pts||0}/{history[viewDate]?.maxPts||0} pts — tap to edit</div>
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
                  <div className="sec"><div className="sec-title">Today</div><div className="sec-sub">{Object.values(todayState).filter(v=>v?.checked).length}/{todayItems.length} done</div></div>

                  <div style={{background:"#EDF1F3",border:"1px solid rgba(35,181,211,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#17384A",lineHeight:1.5}}>
                    ✦ A gentle target: one keystone, a couple of steadying things. Bonus is truly optional.
                  </div>

                  {isSabbathToday && (
                    <div style={{background:"linear-gradient(145deg,#333F47,#5C6E7A)",borderRadius:20,padding:24,marginBottom:14,boxShadow:"0 8px 24px rgba(117,171,188,0.28)"}}>
                      <div style={{fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.75)",background:"rgba(255,255,255,0.15)",display:"inline-block",padding:"4px 10px",borderRadius:100,marginBottom:14}}>Sabbath</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:10,lineHeight:1.3}}>{sabbathInvitation?.text}</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,0.9)",lineHeight:1.6}}>{sabbathInvitation?.sub}</div>
                      <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.18)",fontSize:11.5,color:"rgba(255,255,255,0.78)",lineHeight:1.6}}>
                        No keystone today, on purpose. Rest days don't come with assignments — the streak is already safe.
                      </div>
                    </div>
                  )}

                  {keystoneItem && !isSabbathToday && (
                    <div style={{background:"linear-gradient(145deg,#1B3443,#2F5C74)",borderRadius:20,padding:22,marginBottom:14,position:"relative",overflow:"hidden",boxShadow:"0 8px 24px rgba(35,181,211,0.25)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8}}>
                        <div style={{fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.75)",background:"rgba(255,255,255,0.15)",display:"inline-block",padding:"4px 10px",borderRadius:100}}>Today's Keystone</div>
                        <div style={{fontSize:9.5,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.6)"}}>{keystoneItem.domain}</div>
                      </div>
                      <div style={{fontSize:21,fontWeight:800,color:"#fff",marginBottom:14,lineHeight:1.25}}>{keystoneItem.text}</div>
                      <div style={{display:"flex",gap:20,marginBottom:16,flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:120}}>
                          <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Why it matters</div>
                          <div style={{fontSize:12.5,color:"rgba(255,255,255,0.92)",lineHeight:1.5}}>{keystoneItem.why}</div>
                        </div>
                        <div style={{flex:1,minWidth:120}}>
                          <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>If today is thin</div>
                          <div style={{fontSize:12.5,color:"rgba(255,255,255,0.92)",lineHeight:1.5}}>{keystoneItem.min}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                        <button onClick={completeKeystone} style={{background:keystoneDone?"rgba(255,255,255,0.22)":"#fff",color:keystoneDone?"#fff":"#17384A",border:"none",borderRadius:100,padding:"10px 20px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                          {keystoneDone?"✓ Done today":"Mark complete"}
                        </button>
                        <button onClick={skipKeystone} style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:700,cursor:"pointer",textDecoration:"underline"}}>Not today — show another</button>
                      </div>
                    </div>
                  )}

                  {maintenanceItems.length>0&&(
                    <>
                      <div className="sec"><div className="sec-title">Maintenance</div><div className="sec-sub">{maintDoneCount}/{maintenanceItems.length} · the steadying things</div></div>
                      <CheckGroup items={maintenanceItems} state={todayState} onToggle={handleToggle} bouncing={bouncing} travel={travelMode}/>
                    </>
                  )}

                  {bonusItems.length>0&&(
                    <>
                      <div className="sec"><div className="sec-title">If there's room</div><div className="sec-sub">a little extra, never a debt</div></div>
                      <CheckGroup items={bonusItems} state={todayState} onToggle={handleToggle} bouncing={bouncing} travel={travelMode}/>
                    </>
                  )}

                  {travelMode && (
                    <div style={{background:"#F5F7F8",border:"1px solid #D3DBE0",borderLeft:"3px solid #2B5F7D",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                      <div style={{fontSize:11.5,fontWeight:800,color:"#17384A",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>Travel — {travelDest||"on the road"}</div>
                      <div style={{fontSize:12.5,color:"#454F56",lineHeight:1.55}}>
                        Heavy lifts are off today's keystone rotation on purpose. The things that hold on the road: protein, a walk, and a message home before boarding.
                      </div>
                      {momentum.current>0&&(
                        <div style={{fontSize:12,color:"#17384A",fontWeight:700,marginTop:7}}>
                          → {momentum.current}-day run is intact. A rest day or one grace token keeps it that way.
                        </div>
                      )}
                    </div>
                  )}

                  {/* WEEKLY REVIEW — the app answering back, not just recording */}
                  <div className="sec">
                    <div className="sec-title">This Week</div>
                    <button onClick={()=>setShowReview(v=>!v)} style={{background:"none",border:"none",fontSize:11,fontWeight:800,color:"#2B5F7D",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>{showReview?"Hide":"Review ›"}</button>
                  </div>
                  <div className="g-card" style={{marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#121A20",marginBottom:8,lineHeight:1.35}}>{weeklyReview.headline}</div>
                    <div style={{display:"flex",gap:18,flexWrap:"wrap",fontSize:11.5,color:"#6E7F8A",fontWeight:700}}>
                      <span><strong style={{color:"#2B5F7D",fontSize:14}}>{weeklyReview.keystoneDays}</strong> keystones</span>
                      <span><strong style={{color:"#2B5F7D",fontSize:14}}>{weeklyReview.avg}%</strong> avg day</span>
                      <span><strong style={{color:"#2B5F7D",fontSize:14}}>{weeklyReview.journalDays}</strong> journal</span>
                    </div>
                    {showReview&&(
                      <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid #E4E9EC",display:"grid",gap:12}}>
                        {weeklyReview.observations.map((o,idx)=>{
                          const tone = o.severity==="high"?"#8C4A3F":o.severity==="medium"?"#7A5C3E":o.severity==="good"?"#3F6B54":"#6E7F8A";
                          return (
                            <div key={idx} style={{borderLeft:`3px solid ${tone}`,paddingLeft:11}}>
                              <div style={{fontSize:12.5,fontWeight:800,color:tone,marginBottom:3}}>{o.title}</div>
                              <div style={{fontSize:12.5,color:"#454F56",lineHeight:1.55}}>{o.body}</div>
                              {o.action&&<div style={{fontSize:12,color:"#17384A",lineHeight:1.5,marginTop:5,fontWeight:600}}>→ {o.action}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {surfacedArc && (
                    <>
                      <div className="sec">
                        <div className="sec-title">The Larger Arc</div>
                        <button onClick={cycleArc} style={{background:"none",border:"none",fontSize:11,fontWeight:800,color:"#2B5F7D",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Another ›</button>
                      </div>
                      <div className="g-card" style={{borderLeft:`3px solid ${DOMAIN_CFG[surfacedArc.domain]?.color||"#2B5F7D"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}}>
                          <div style={{fontSize:15,fontWeight:700,color:"#121A20",marginBottom:4}}>{surfacedArc.title}</div>
                          <div style={{fontSize:10.5,fontWeight:800,color:"#94A3B8",whiteSpace:"nowrap"}}>{surfacedArcDone}/{(surfacedArc.steps||[]).length}</div>
                        </div>
                        <div style={{fontSize:12,color:"#64748B",marginBottom:12}}>{surfacedArc.detail}</div>
                        <div style={{display:"grid",gap:2}}>
                          {(surfacedArc.steps||[]).map(st=>(
                            <button key={st.id} onClick={()=>toggleArcStep(surfacedArc.id,st.id)}
                              style={{display:"flex",alignItems:"flex-start",gap:9,textAlign:"left",background:"none",border:"none",padding:"7px 0",cursor:"pointer",width:"100%"}}>
                              <span style={{flexShrink:0,width:17,height:17,borderRadius:5,marginTop:1,
                                border:st.done?"none":"1.5px solid #CBD5E1",
                                background:st.done?(DOMAIN_CFG[surfacedArc.domain]?.color||"#2B5F7D"):"transparent",
                                color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{st.done?"✓":""}</span>
                              <span style={{fontSize:13,lineHeight:1.45,color:st.done?"#94A3B8":"#334155",textDecoration:st.done?"line-through":"none"}}>{st.text}</span>
                            </button>
                          ))}
                        </div>
                        {surfacedArcNext && (
                          <div style={{marginTop:12,paddingTop:11,borderTop:"1px solid #E8EEF2",fontSize:11.5,color:"#17384A",lineHeight:1.5}}>
                            <strong style={{fontWeight:800}}>Next:</strong> {surfacedArcNext.text}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="sec"><div className="sec-title">Quick Capture</div><div className="sec-sub">keep the useful bits close</div></div>
                  <div className="add-form" style={{marginBottom:12}}>
                    <div style={{display:"flex",gap:8}}>
                      <input className="field" style={{marginBottom:0}} placeholder="A thought, a note, something worth keeping…" value={quickInput} onChange={e=>setQuickInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addQuickNote()}/>
                      <button onClick={()=>addQuickNote()} className="todo-add-btn">+</button>
                    </div>
                  </div>
                  {quickNotes.length>0&&(
                    <div className="check-card" style={{marginBottom:12}}>
                      {quickNotes.map(n=>(
                        <div key={n.id} className="c-row" style={{cursor:"default"}}>
                          <div className="c-body">
                            <div className="c-main" style={{fontWeight:500}}>{n.text}</div>
                            <div className="c-hint">{new Date(n.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>promoteQuickNote(n,"journal")} title="Move to journal" style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#2B5F7D"}}>📓</button>
                            <button onClick={()=>promoteQuickNote(n,"task")} title="Turn into a task" style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#2B5F7D"}}>✓</button>
                            <button onClick={()=>deleteQuickNote(n.id)} className="todo-del">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── TASKS WITH CATEGORIES ── */}
                  <div className="sec">
                    <div className="sec-title">Tasks</div>
                    <button onClick={()=>setAddingCat(true)} style={{background:"none",border:"none",fontSize:11,fontWeight:800,color:"#2B5F7D",cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase"}}>+ Category</button>
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
                        <div className="cat-header">
                          <button type="button" className="cat-toggle" aria-expanded={!cat.collapsed}
                            aria-label={`${cat.collapsed?"Expand":"Collapse"} ${cat.name}`}
                            onClick={()=>toggleCatCollapse(cat.id)}>
                            <span className="cat-chevron" aria-hidden="true" style={{transform:cat.collapsed?"rotate(-90deg)":"rotate(0deg)"}}>
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#8B99A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="2 4 6 8 10 4"/>
                              </svg>
                            </span>
                          </button>
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
                            <button type="button" className="cat-header-name" style={{background:"none",border:"none",padding:0,font:"inherit",cursor:"pointer",textAlign:"left"}}
                              onClick={()=>toggleCatCollapse(cat.id)}
                              onDoubleClick={e=>{e.stopPropagation();setEditCatId(cat.id);}}>{cat.name}</button>
                          )}
                          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
                            {cat.collapsed&&total>0&&(
                              <span className="cat-collapsed-badge">{total-doneCnt} remaining</span>
                            )}
                            {doneCnt>0&&!cat.collapsed&&(
                              <button onClick={async e=>{e.stopPropagation();const u=todos.filter(t=>!((t.categoryId||"cat-default")===cat.id&&t.done));setTodos(u);await save("wb-todos-v1",u);}} className="cat-clear-btn">Clear done</button>
                            )}
                            {cat.id!=="cat-default"&&(
                              <button
                                aria-label={`Delete category ${cat.name}`}
                                onClick={e=>{
                                  e.stopPropagation();
                                  // Both branches used to call deleteCategory — cancelling
                                  // destroyed the category anyway. Delete only on confirm.
                                  const ok = typeof window.confirm === "function"
                                    ? window.confirm(`Delete "${cat.name}"? Tasks in it will be removed.`)
                                    : true;
                                  if(ok) deleteCategory(cat.id);
                                }} className="cat-del-btn">✕</button>
                            )}
                          </div>
                        </div>

                        {/* Tasks list */}
                        {!cat.collapsed&&(
                          <div className="check-card" style={{marginTop:0,borderRadius:"0 0 14px 14px",borderTop:"none"}}>
                            {catTodos.length===0&&(
                              <div style={{padding:"16px 18px",fontSize:13,color:"#8B99A3",fontStyle:"italic"}}>
                                No tasks yet — type above to add one
                              </div>
                            )}
                            {catTodos.map(todo=>(
                              <div key={todo.id} style={{borderBottom:"1px solid rgba(11,25,41,0.04)"}}>
                                <div className="c-row" style={{borderBottom:"none"}}>
                                  <button type="button" role="checkbox" aria-checked={!!todo.done} aria-label={todo.text}
                                    className="row-btn"
                                    onClick={()=>toggleTodo(todo.id)}
                                    style={{display:"flex",alignItems:"center",gap:13,flex:1,minWidth:0,background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left",font:"inherit"}}>
                                    <span className={`todo-circle ${todo.done?"done":""}`} aria-hidden="true"/>
                                    <span className="c-body" style={{minWidth:0}}>
                                      <span className="c-main" style={{display:"block",color:todo.done?"#8B99A3":"#10171C",textDecoration:todo.done?"line-through":"none"}}>{todo.text}</span>
                                    </span>
                                  </button>
                                  <button
                                    onClick={()=>setAddingSubFor(addingSubFor===todo.id?null:todo.id)}
                                    title="Add sub-item"
                                    style={{background:"none",border:"none",color:"#94A3B8",fontSize:16,fontWeight:700,cursor:"pointer",padding:"0 6px"}}
                                  >+</button>
                                  <button className="todo-del" onClick={()=>deleteTodo(todo.id)}>×</button>
                                </div>

                                {(todo.subitems||[]).length>0&&(
                                  <div style={{paddingLeft:34,paddingBottom:6}}>
                                    {todo.subitems.map(sub=>(
                                      <div key={sub.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px 6px 0"}}>
                                        <button type="button" role="checkbox" aria-checked={!!sub.done} aria-label={sub.text}
                                          onClick={()=>toggleSubTodo(todo.id,sub.id)}
                                          style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0,background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left",font:"inherit"}}>
                                          <span className={`todo-circle ${sub.done?"done":""}`} aria-hidden="true" style={{width:16,height:16,flexShrink:0}}/>
                                          <span style={{flex:1,fontSize:12.5,color:sub.done?"#8B99A3":"#454F56",textDecoration:sub.done?"line-through":"none"}}>{sub.text}</span>
                                        </button>
                                        <button className="todo-del" style={{fontSize:14}} onClick={()=>deleteSubTodo(todo.id,sub.id)}>×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {addingSubFor===todo.id&&(
                                  <div style={{display:"flex",gap:6,padding:"0 12px 10px 34px"}}>
                                    <input
                                      autoFocus
                                      className="field"
                                      style={{fontSize:12.5,padding:"7px 10px"}}
                                      placeholder="Sub-item…"
                                      value={subInput}
                                      onChange={e=>setSubInput(e.target.value)}
                                      onKeyDown={e=>{if(e.key==="Enter")addSubTodo(todo.id);if(e.key==="Escape"){setAddingSubFor(null);setSubInput("");}}}
                                    />
                                    <button className="todo-add-btn" onClick={()=>addSubTodo(todo.id)}>+</button>
                                  </div>
                                )}
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
          {/* ══ PROGRESS SUB-NAV (Stats / Rhythms / Platform / Health) ═══ */}
          {tab==="progress"&&(
            <div className="r-tabs" style={{marginTop:8}}>
              {[["stats","Stats"],["rhythms","Rhythms"],["platform","Platform"],["health","Health"]].map(([k,l])=>(
                <button key={k} className={`r-tab ${progressSubTab===k?"active":""}`} onClick={()=>setProgressSubTab(k)}>{l}</button>
              ))}
            </div>
          )}

          {tab==="progress"&&progressSubTab==="rhythms"&&(
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
                  <div style={{background:"linear-gradient(135deg,#10171C,#121A1E)",borderRadius:"16px 16px 0 0",padding:"12px 18px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#2B5F7D",boxShadow:"0 0 8px rgba(35,181,211,0.4)"}}/>
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
                  <button type="button" className="prompt-card" onClick={()=>setShowFF(true)}>
                    <div style={{fontSize:22}}>👥</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#2B5F7D"}}>Log a connection</div><div style={{fontSize:11,color:"#454F56"}}>{friendLog.length} this year</div></div>
                    <div style={{fontSize:14,color:"#454F56"}}>+</div>
                  </button>
                  {showFF&&(
                    <div className="add-form">
                      <div style={{fontSize:17,fontWeight:800,color:"#121A20",marginBottom:14}}>Who did you connect with?</div>
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
                  <div style={{background:"linear-gradient(135deg,#10171C,#10171C,#10171C)",borderRadius:24,padding:22,marginBottom:12}}>
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
          {tab==="progress"&&progressSubTab==="platform"&&(
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
              {[{title:"Recalibrated",sub:"Faith + leadership book",color:"#7C3AED",stage:"Writing"},{title:"The Sequence",sub:"Marketing book",color:"#35617E",stage:"Writing"},{title:"One Five One",sub:"Men's movement",color:"#0891B2",stage:"Building"},{title:"BenWebb.com",sub:"Unified platform",color:"#2B5F7D",stage:"Planning"}].map(p=>(
                <div key={p.title} className="g-card" style={{borderLeft:`3px solid ${p.color}`,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div><div style={{fontSize:15,fontWeight:700,color:"#121A20"}}>{p.title}</div><div style={{fontSize:12,color:"#64748B",marginTop:2}}>{p.sub}</div></div>
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
          {tab==="progress"&&progressSubTab==="stats"&&(
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
                  <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,marginBottom:8,color:"#2B5F7D"}}>{debtPct}%</div>
                  <div style={{height:5,background:"rgba(11,25,41,0.08)",borderRadius:100,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",background:"linear-gradient(90deg,#059669,#34D399)",borderRadius:100,width:`${debtPct}%`,transition:"width 0.8s"}}/></div>
                  <div style={{fontSize:12,color:"#94A3B8"}}>${(financials.debtStart-financials.debtCurrent).toLocaleString()} reduced</div>
                </div>
                <div className="fin-card">
                  <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94A3B8",marginBottom:6}}>Savings</div>
                  <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,marginBottom:8,color:"#6B8494"}}>{savPct}%</div>
                  <div style={{height:5,background:"rgba(11,25,41,0.08)",borderRadius:100,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",background:"linear-gradient(90deg,#35617E,#60A5FA)",borderRadius:100,width:`${savPct}%`,transition:"width 0.8s"}}/></div>
                  <div style={{fontSize:12,color:"#94A3B8"}}>${financials.savingsCurrent.toLocaleString()} of ${financials.savingsTarget.toLocaleString()}</div>
                </div>
              </div>
              {!showFinForm&&<button type="button" className="prompt-card" onClick={()=>setShowFinForm(true)}><div style={{fontSize:22}}>✏️</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:800,color:"#2B5F7D",letterSpacing:"0.04em",textTransform:"uppercase"}}>Update numbers</div><div style={{fontSize:11,color:"#454F56"}}>Debt, savings, targets</div></div><div style={{fontSize:14,color:"#454F56"}}>›</div></button>}
              {showFinForm&&(
                <div className="fin-edit">
                  <div style={{fontSize:16,fontWeight:700,color:"#121A20",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>Update Financials<button onClick={()=>setShowFinForm(false)} style={{background:"none",border:"none",color:"#94A3B8",fontSize:14,cursor:"pointer",fontWeight:600}}>Done</button></div>
                  {[["debtStart","Debt Start"],["debtCurrent","Debt Now"],["savingsTarget","Savings Target"],["savingsCurrent","Savings Now"]].reduce((rows,item,i)=>{if(i%2===0)rows.push([]);rows[rows.length-1].push(item);return rows;},[]).map((pair,ri)=>(
                    <div key={ri} style={{display:"flex",gap:10,marginBottom:10}}>
                      {pair.map(([field,label])=>(
                        <div key={field} style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</div>
                          <input style={{width:"100%",background:"#F0F4FA",border:"1.5px solid transparent",borderRadius:12,padding:"11px 13px",fontSize:16,fontWeight:700,color:"#121A20",outline:"none"}} type="number" value={financials[field]} onChange={async e=>{const nf={...financials,[field]:Number(e.target.value)};setFinancials(nf);await save("wb-fin-v2",nf);}}/>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="sec"><div className="sec-title">Connections</div><div className="sec-sub">{friendLog.length} this year</div></div>
              <button type="button" className="prompt-card" onClick={()=>setShowFF(true)}><div style={{fontSize:22}}>👥</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#2B5F7D"}}>Log a connection</div></div><div style={{fontSize:14,color:"#454F56"}}>+</div></button>
              {showFF&&(
                <div className="add-form">
                  <div style={{fontSize:17,fontWeight:800,color:"#121A20",marginBottom:14}}>Who did you connect with?</div>
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
                      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600,color:"#121A20"}}>{f.name}</div>{f.note&&<div style={{fontSize:12,color:"#64748B"}}>{f.note}</div>}<div style={{fontSize:11,color:"#CBD5E1"}}>{formatShort(f.date)}</div></div>
                      <button style={{background:"none",border:"none",color:"#E2E8F0",fontSize:20,cursor:"pointer",padding:4}} onClick={async()=>{const nl=friendLog.filter(x=>x.id!==f.id);setFriendLog(nl);await save("wb-friends-v2",nl);}}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="sec">
                <div className="sec-title">Trip Log</div>
                <div className="sec-sub">{tripLog.length} trips</div>
                <button
                  onClick={()=>{setShowAddTrip(v=>!v);setEditingTripId(null);setTripDraft({dest:"",start:"",type:"IJM"});}}
                  style={{marginLeft:"auto",background:"none",border:"none",color:"#2B5F7D",fontSize:13,fontWeight:800,cursor:"pointer"}}
                >{showAddTrip?"Cancel":"+ Add trip"}</button>
              </div>

              {showAddTrip&&(
                <div className="add-form" style={{marginBottom:12}}>
                  <input className="field" placeholder="Destination…" value={tripDraft.dest} onChange={e=>setTripDraft(p=>({...p,dest:e.target.value}))}/>
                  <input className="field" type="date" value={tripDraft.start} onChange={e=>setTripDraft(p=>({...p,start:e.target.value}))}/>
                  <select className="field" value={tripDraft.type} onChange={e=>setTripDraft(p=>({...p,type:e.target.value}))}>
                    {["IJM","Personal","Family"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="btn-row"><button className="btn-s" onClick={()=>setShowAddTrip(false)}>Cancel</button><button className="btn-p" onClick={addManualTrip}>Save trip</button></div>
                </div>
              )}

              {tripLog.length>0&&(
                <div className="trip-card">
                  {tripLog.map(t=>(
                    editingTripId===t.id?(
                      <div key={t.id} className="add-form" style={{margin:8,borderRadius:12}}>
                        <input className="field" placeholder="Destination…" value={tripDraft.dest} onChange={e=>setTripDraft(p=>({...p,dest:e.target.value}))}/>
                        <input className="field" type="date" value={tripDraft.start} onChange={e=>setTripDraft(p=>({...p,start:e.target.value}))}/>
                        <select className="field" value={tripDraft.type} onChange={e=>setTripDraft(p=>({...p,type:e.target.value}))}>
                          {["IJM","Personal","Family"].map(ty=><option key={ty} value={ty}>{ty}</option>)}
                        </select>
                        <div className="btn-row"><button className="btn-s" onClick={cancelEditTrip}>Cancel</button><button className="btn-p" onClick={saveEditTrip}>Save</button></div>
                      </div>
                    ):(
                      <div key={t.id} className="trip-row">
                        <span style={{fontSize:22}}>✈️</span>
                        <button type="button" aria-label={`Edit trip ${t.dest||""}`} style={{flex:1,cursor:"pointer",background:"none",border:"none",padding:0,textAlign:"left",font:"inherit"}} onClick={()=>startEditTrip(t)}>
                          <div style={{fontSize:15,fontWeight:700,color:"#121A20"}}>{t.dest}</div>
                          <div style={{fontSize:12,color:"#94A3B8"}}>{formatShort(t.start)}</div>
                        </button>
                        <div style={{fontSize:11,fontWeight:700,background:"#E0F7FA",color:"#2B5F7D",padding:"3px 9px",borderRadius:100}}>{t.type||"IJM"}</div>
                        <button className="todo-del" onClick={()=>deleteTrip(t.id)}>×</button>
                      </div>
                    )
                  ))}
                </div>
              )}
              <div className="sec"><div className="sec-title">Stats</div></div>
              <div className="stat-card">
                {[["Milestone streak",`${streaks.current} days`],["Longest milestone streak",`${streaks.longest} days`],["Momentum run",`${momentum.current} days`],["Days Complete",`${streaks.totalDays||0}`],["Sabbaths Honored",`${streaks.sabbaths||0}`],["Practice Sessions",`${streaks.practiceSessions||0}`],["Trips",`${tripLog.length}`],["Goals Done",`${goalsComplete}/${goals.length}`],["Total Points",`${totalXP}`]].map(([l,v])=>(
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
                  <div style={{fontSize:17,fontWeight:800,color:"#121A20",marginBottom:14}}>New Goal</div>
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
                  <button key={k} className={`chip ${domainFilter===k?"active":""}`} style={{"--cc":k==="all"?"#35617E":DOMAIN_CFG[k]?.color}} onClick={()=>setDomainFilter(k)}>{l}</button>
                ))}
              </div>
              {filteredGoals.map(g=>{
                const dc=DOMAIN_CFG[g.domain]; const isEditing=editingGoal===g.id;
                return(
                  <div key={g.id} className={`g-card ${g.completed?"complete":""}`}>
                    {isEditing?(
                      <>
                        <div style={{fontSize:15,fontWeight:800,color:"#121A20",marginBottom:12}}>Edit Goal</div>
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
                    <div style={{fontSize:13,fontWeight:700,color:"#10171C"}}>📅 Viewing {viewPlanWeek}</div>
                    <button onClick={()=>setViewPlanWeek(null)} style={{background:"none",border:"none",fontSize:12,fontWeight:800,color:"#2B5F7D",cursor:"pointer"}}>Back ›</button>
                  </div>
                  {[["Top 3","top3"],["Intention","intention"],["Gratitude","gratitude"],["Carry Forward","carryForward"]].map(([label,key])=>{
                    const val=planArchive[viewPlanWeek][key];
                    if(!val||(Array.isArray(val)&&!val.some(v=>v)))return null;
                    return(
                      <div key={key} style={{marginBottom:16}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{label}</div>
                        {Array.isArray(val)
                          ?val.filter(v=>v).map((v,i)=><div key={i} style={{fontSize:14,color:"#121A20",padding:"10px 14px",background:"rgba(255,255,255,0.5)",borderRadius:12,marginBottom:6}}>{i+1}. {v}</div>)
                          :<div style={{fontSize:14,color:"#2C3A44",lineHeight:1.65,background:"rgba(255,255,255,0.5)",borderRadius:12,padding:"12px 14px"}}>{val}</div>
                        }
                      </div>
                    );
                  })}
                </>
              )}
              {!viewPlanWeek&&(
                <>
                  <div style={{background:"linear-gradient(160deg,#10171C,#121A1E,#121A1E)",backgroundSize:"300% 300%",animation:"gradShift 10s ease infinite",borderRadius:26,padding:"24px 22px 20px",marginBottom:12,marginTop:4,position:"relative",overflow:"hidden"}}>
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
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#35617E"}}>Vision Anchor</div>
                      {!editingVision&&<button onClick={startEditVision} style={{background:"none",border:"none",color:"#94A3B8",fontSize:12,fontWeight:700,cursor:"pointer"}}>Edit</button>}
                    </div>
                    {editingVision?(
                      <>
                        <textarea className="journal-input" rows={4} value={visionDraft} onChange={e=>setVisionDraft(e.target.value)} style={{marginBottom:10}}/>
                        <div className="btn-row"><button className="btn-s" onClick={()=>setEditingVision(false)}>Cancel</button><button className="btn-p" onClick={saveVision}>Save</button></div>
                      </>
                    ):(
                      <div style={{fontSize:13,color:"#2C3A44",lineHeight:1.7}}>{visionAnchor}</div>
                    )}
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
                  <div style={{fontSize:16,fontWeight:800,color:"#121A20"}}>{new Date(jMonth.y,jMonth.m-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
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
                        style={{background:hasEntry?"linear-gradient(135deg,#1A3A6B,#35617E)":isToday?"transparent":"rgba(255,255,255,0.3)",color:hasEntry?"#fff":isToday?"#35617E":"#64748B",border:isToday&&!hasEntry?"2px solid #35617E":isViewing&&!hasEntry?"2px solid #F59E0B":"none",boxShadow:isViewing?"0 0 0 2px #F59E0B":"none"}}
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
                    <div style={{fontSize:22,fontWeight:800,color:"#121A20",letterSpacing:"-0.02em",marginBottom:2}}>{new Date(jViewDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
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
                  <div style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.15)",borderRadius:16,padding:18,marginBottom:14,boxShadow:"0 2px 12px rgba(7,16,19,0.05)"}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#2B5F7D",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>A question for today</div>
                    <div style={{fontSize:17,fontWeight:700,color:"#121A20",lineHeight:1.4,marginBottom:6}}>{getDailyJournalPrompt()}</div>
                    <div style={{fontSize:12,color:"#94A3B8",fontStyle:"italic"}}>Let the answer be smaller than you think.</div>
                  </div>
                  <div className="sec"><div className="sec-title">Today's Reflection</div><div className="sec-sub">{new Date().toLocaleDateString("en-US",{weekday:"long"})}</div></div>
                  <textarea className="journal-input" rows={8} placeholder={"What is God saying to you today?\n\nWhat are you grateful for?\n\nWhat do you need to surrender?"} value={journalInput} onChange={e=>onJournalChange(e.target.value)} onBlur={()=>flushJournal()} aria-label="Today's journal entry" style={{marginBottom:14}}/>
                  {Object.entries(journal).filter(([d,t])=>d!==today&&t&&t.trim()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5).length>0&&(
                    <>
                      <div className="sec"><div className="sec-title">Recent</div></div>
                      {Object.entries(journal).filter(([d,t])=>d!==today&&t&&t.trim()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5).map(([d,t])=>{
                        const dt=new Date(d+"T12:00:00");
                        return(
                          <div key={d} style={{background:"rgba(255,255,255,0.45)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.6)",borderRadius:16,padding:"16px 18px",marginBottom:10,boxShadow:"0 2px 12px rgba(11,25,41,0.05)",cursor:"pointer"}}
                            onClick={()=>{setJMonth({y:dt.getFullYear(),m:dt.getMonth()+1});setJViewDate(d);}}>
                            <div style={{fontSize:13,fontWeight:800,color:"#35617E",marginBottom:4}}>{dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
                            <div style={{fontSize:13,color:"#64748B",lineHeight:1.55,fontStyle:"italic"}}>{t.length>160?t.slice(0,160)+"…":t}</div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}

              <div className="vision-card" style={{marginTop:8}}>
                {values.map((v,i)=>(
                  editingValueIdx===i?(
                    <div key={v.n} className="add-form" style={{marginBottom:8}}>
                      <input className="field" placeholder="Value name…" value={valueDraft.n} onChange={e=>setValueDraft(p=>({...p,n:e.target.value}))}/>
                      <input className="field" placeholder="Description…" value={valueDraft.d} onChange={e=>setValueDraft(p=>({...p,d:e.target.value}))}/>
                      <div className="btn-row"><button className="btn-s" onClick={()=>setEditingValueIdx(null)}>Cancel</button><button className="btn-p" onClick={saveValue}>Save</button></div>
                    </div>
                  ):(
                    <button type="button" className="tenet-row" key={v.n} aria-label={`Edit value: ${v.n}`} onClick={()=>startEditValue(i)} style={{cursor:"pointer",width:"100%",textAlign:"left",font:"inherit"}}>
                      <div className="tenet-s">{v.n.slice(0,1)}</div>
                      <div><div style={{fontSize:15,fontWeight:700,color:"#121A20",marginBottom:2}}>{v.n}</div><div style={{fontSize:13,color:"#64748B",lineHeight:1.4}}>{v.d}</div></div>
                    </button>
                  )
                ))}
              </div>
            </>
          )}

          {/* ══ HEALTH ══════════════════════════════════════════════════ */}
          {tab==="progress"&&progressSubTab==="health"&&(
            <>
              {/* PROTEIN HERO */}
              <div style={{background:"linear-gradient(145deg,#10171C,#121C24,#14262F)",borderRadius:20,padding:"22px 20px 20px",marginBottom:12,marginTop:4,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(7,16,19,0.15)"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent)"}}/>
                <div style={{position:"absolute",top:-40,right:-30,width:160,height:160,background:"radial-gradient(circle,rgba(35,181,211,0.1),transparent 70%)"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:12}}>Daily Protein</div>
                  <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:16}}>
                    {/* Ring */}
                    <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
                      <svg viewBox="0 0 80 80" style={{transform:"rotate(-90deg)"}}>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7"/>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#2B5F7D" strokeWidth="7"
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
                      <div style={{fontSize:10,fontWeight:700,color:"#2B5F7D",marginTop:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>{proteinLog.length} entries today</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{height:2,background:"rgba(255,255,255,0.1)",borderRadius:0,overflow:"hidden"}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,#2B5F7D,#6B8494)",width:`${Math.min((todayProtein/proteinTarget)*100,100)}%`,transition:"width 0.6s"}}/>
                  </div>
                </div>
              </div>

              {/* QUICK ADD */}
              <div className="sec"><div className="sec-title">Quick Add</div><div className="sec-sub">Tap to log</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {PROTEIN_PRESETS.filter(p=>p.grams>0).map(p=>(
                  <button key={p.label} onClick={()=>logProtein(p)} style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.15)",borderRadius:12,padding:"12px 8px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 2px 8px rgba(7,16,19,0.05)",textAlign:"center"}}>
                    <div style={{fontSize:22,marginBottom:4}}>{p.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#10171C",lineHeight:1.2,marginBottom:2}}>{p.label}</div>
                    <div style={{fontSize:12,fontWeight:800,color:"#2B5F7D"}}>{p.grams}g</div>
                  </button>
                ))}
                <button onClick={()=>setShowCustom(p=>!p)} style={{background:showCustom?"#EDF1F3":"#FFFFFF",border:`1.5px ${showCustom?"solid #2B5F7D":"solid rgba(35,181,211,0.15)"}`,borderRadius:12,padding:"12px 8px",cursor:"pointer",textAlign:"center",boxShadow:"0 2px 8px rgba(7,16,19,0.05)"}}>
                  <div style={{fontSize:22,marginBottom:4}}>✏️</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#10171C",marginBottom:2}}>Custom</div>
                  <div style={{fontSize:11,color:"#8B99A3"}}>any amount</div>
                </button>
              </div>

              {/* CUSTOM INPUT */}
              {showCustom&&(
                <div style={{background:"#FFFFFF",border:"1.5px solid #2B5F7D",borderRadius:12,padding:"14px 16px",marginBottom:12,display:"flex",gap:10,alignItems:"center",boxShadow:"0 0 0 3px rgba(35,181,211,0.1)"}}>
                  <input
                    type="number" placeholder="Enter grams…"
                    value={customGrams} onChange={e=>setCustomGrams(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&logCustomProtein()}
                    style={{flex:1,border:"none",outline:"none",fontSize:17,fontWeight:700,color:"#10171C",background:"transparent"}}
                    autoFocus
                  />
                  <span style={{fontSize:14,fontWeight:700,color:"#8B99A3"}}>g</span>
                  <button onClick={logCustomProtein} style={{background:"#2B5F7D",border:"none",borderRadius:8,padding:"9px 16px",color:"#FFFFFF",fontSize:13,fontWeight:800,cursor:"pointer"}}>Add</button>
                  <button onClick={()=>{setShowCustom(false);setCustomGrams("");}} style={{background:"none",border:"none",color:"#8B99A3",fontSize:18,cursor:"pointer"}}>✕</button>
                </div>
              )}

              {/* TODAY'S LOG */}
              {proteinLog.length>0&&(
                <>
                  <div className="sec"><div className="sec-title">Today's Log</div><button onClick={async()=>{setProteinLog([]);await save(`wb-protein-${todayKey()}`,[]);}} style={{background:"none",border:"none",fontSize:11,fontWeight:800,color:"#8B99A3",cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase"}}>Clear all</button></div>
                  <div style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.12)",borderRadius:14,overflow:"hidden",marginBottom:16,boxShadow:"0 2px 10px rgba(7,16,19,0.05)"}}>
                    {proteinLog.map((e,i)=>(
                      <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<proteinLog.length-1?"1px solid rgba(35,181,211,0.07)":"none"}}>
                        <div style={{width:36,height:36,borderRadius:8,background:"#EDF1F3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                          {PROTEIN_PRESETS.find(p=>p.label===e.label)?.icon||"🍽️"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#10171C"}}>{e.label}</div>
                          <div style={{fontSize:11,color:"#8B99A3",marginTop:1}}>{new Date(e.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                        </div>
                        <div style={{fontSize:15,fontWeight:800,color:"#2B5F7D",marginRight:4}}>{e.grams}g</div>
                        <button onClick={()=>deleteProteinEntry(e.id)} style={{background:"none",border:"none",color:"#DCE2E6",fontSize:18,cursor:"pointer",padding:"2px 4px",lineHeight:1}}>×</button>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"rgba(35,181,211,0.04)",borderTop:"1px solid rgba(35,181,211,0.1)"}}>
                      <div style={{fontSize:12,fontWeight:800,color:"#3E525E",letterSpacing:"0.08em",textTransform:"uppercase"}}>Total Today</div>
                      <div style={{fontSize:18,fontWeight:900,color:"#2B5F7D"}}>{todayProtein}g <span style={{fontSize:12,color:"#8B99A3",fontWeight:600}}>/ {proteinTarget}g</span></div>
                    </div>
                  </div>
                </>
              )}

              {/* WORKOUT SECTION */}
              <div style={{background:"linear-gradient(145deg,#10171C,#121C24,#14262F)",borderRadius:20,padding:"22px 20px 20px",marginBottom:12,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(7,16,19,0.15)"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(35,181,211,0.5),transparent)"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>This Week</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}}>
                    <div style={{fontSize:48,fontWeight:900,color:"#FFFFFF",lineHeight:1,letterSpacing:"-0.04em"}}>{Object.keys(workoutLog).length}</div>
                    <div style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>of 3 workouts</div>
                  </div>
                  <div style={{height:2,background:"rgba(255,255,255,0.1)",marginBottom:16,overflow:"hidden"}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,#2B5F7D,#6B8494)",width:`${Math.min((Object.keys(workoutLog).length/3)*100,100)}%`,transition:"width 0.6s"}}/>
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
                              background:done?"#2B5F7D":isToday?"rgba(35,181,211,0.15)":"rgba(255,255,255,0.06)",
                              border:`1px solid ${done?"#2B5F7D":isToday?"rgba(35,181,211,0.4)":"rgba(255,255,255,0.1)"}`,
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
                      style={{background:isLogged?"#EDF1F3":"#FFFFFF",border:`1.5px solid ${isLogged?"#2B5F7D":"rgba(35,181,211,0.15)"}`,borderRadius:12,padding:"14px 8px",cursor:"pointer",textAlign:"center",boxShadow:"0 2px 8px rgba(7,16,19,0.05)",transition:"all 0.15s"}}>
                      <div style={{fontSize:24,marginBottom:4}}>{icons[type]}</div>
                      <div style={{fontSize:12,fontWeight:700,color:isLogged?"#17384A":"#10171C"}}>{type}</div>
                      {isLogged&&<div style={{fontSize:9,fontWeight:800,color:"#2B5F7D",marginTop:2,letterSpacing:"0.08em"}}>DONE ✓</div>}
                    </button>
                  );
                })}
              </div>

              {/* MINIMUM PROTOCOL */}
              <div className="sec"><div className="sec-title">The Protocol</div><div className="sec-sub">When time is short</div></div>
              <div style={{background:"#FFFFFF",border:"1px solid rgba(35,181,211,0.12)",borderRadius:14,padding:18,marginBottom:12,boxShadow:"0 2px 10px rgba(7,16,19,0.05)"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#2B5F7D",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>12-Minute Minimum</div>
                <div style={{fontSize:12,color:"#3E525E",lineHeight:1.7,marginBottom:12}}>When the day closes in, this is non-negotiable. 12 minutes. No equipment. Gets it done.</div>
                {[["0:00–3:00","5 push-ups, 5 squats, 5 hip hinges × 3 sets. No rest. Get the blood moving."],["3:00–7:00","10 push-ups, 10 lunges (each leg), 10 pike push-ups. One set each."],["7:00–10:00","Max push-ups, max bodyweight squats, 30-sec plank. One round."],["10:00–12:00","Dead hang or doorframe pull-up hold. Finish with 10 slow deep breaths."]].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:12,paddingBottom:10,marginBottom:10,borderBottom:"1px solid rgba(35,181,211,0.07)"}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#2B5F7D",letterSpacing:"0.06em",width:56,flexShrink:0,paddingTop:2}}>{t}</div>
                    <div style={{fontSize:13,color:"#10171C",lineHeight:1.6}}>{d}</div>
                  </div>
                ))}
                <div style={{fontSize:11,fontWeight:700,color:"#6E7F8A",fontStyle:"italic",marginTop:4}}>Done is better than perfect. Log it. Streak protected.</div>
              </div>

              {/* WEEKLY CONSISTENCY TIP */}
              <div style={{background:"#EDF1F3",border:"1px solid rgba(35,181,211,0.2)",borderRadius:14,padding:16,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:800,color:"#17384A",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>The Real Fix</div>
                <div style={{fontSize:13,color:"#2C3A44",lineHeight:1.7}}>The workout isn't the problem — the schedule is. Block 6:00–6:30am in your calendar as immovable. Before the day exists. Before email. Before anyone needs anything from you. Everything else is a negotiation. This block isn't.</div>
              </div>
            </>
          )}

          {/* VERSION FOOTER — unobtrusive, for fast visual validation between deploys */}
          <div style={{textAlign:"center",padding:"18px 0 8px",fontSize:10,fontWeight:600,color:"#C7CDD3",letterSpacing:"0.06em"}}>
            Meridian v{APP_VERSION}
          </div>
        </div>

        {/* BOTTOM NAV — SVG line icons */}
        <div className="bottom-nav">
          {[
            {id:"today",lbl:"Today",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 13"/></svg>},
            {id:"progress",lbl:"Progress",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>},
            {id:"planner",lbl:"Plan",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 7h8M8 12h8M8 17h5"/></svg>},
            {id:"journal",lbl:"Journal",path:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>},
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
