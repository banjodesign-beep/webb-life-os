import { useState, useEffect, useCallback, useRef } from "react";
import { load, save } from "./lib/supabase.js";

// ── DATA ──────────────────────────────────────────────────────────────

const CHECKLIST_HOME = {
  daily: [
    { id:"d0", text:"30 min stillness",        sub:"Prayer before the day opens.",              xp:10, icon:"🕊️" },
    { id:"d1", text:"Morning anchor",           sub:"Identity before activity.",                 xp:5,  icon:"☀️" },
    { id:"d2", text:"No caffeine after 12pm",   sub:"Slow metabolizer — protect sleep.",        xp:3,  icon:"☕" },
    { id:"d3", text:"Present with family",      sub:"Eye contact. No phone at dinner.",          xp:5,  icon:"🏠" },
    { id:"d4", text:"Push-ups done",            sub:"Every day. No excuse.",                     xp:4,  icon:"💪" },
    { id:"d5", text:"No decisions after 9pm",   sub:"Hard problems get morning slots.",          xp:2,  icon:"🌙" },
  ],
  weekly: [
    { id:"w0", text:"One platform action",      sub:"Write, note, draft, or reply.",            xp:15, icon:"✍️" },
    { id:"w1", text:"LinkedIn or book page",    sub:"Monday priority.",                         xp:15, icon:"📝" },
    { id:"w2", text:"Financial dashboard",      sub:"Friday. 5 minutes.",                       xp:10, icon:"📊" },
    { id:"w3", text:"River transport",          sub:"Practices handled.",                        xp:10, icon:"⚽" },
    { id:"w4", text:"Real connection — Jules",  sub:"Not logistics. Actual presence.",          xp:15, icon:"💍" },
    { id:"w5", text:"Physical training 3×",     sub:"Strength and sprint.",                     xp:15, icon:"🏋️" },
    { id:"w6", text:"Music practice session",   sub:"1 minimum. 3 is the target.",             xp:12, icon:"🎸" },
  ],
  ijm: [
    { id:"i0", text:"Strategic thinking hour",  sub:"Uninterrupted. Big picture only.",         xp:20, icon:"🧠" },
    { id:"i1", text:"Team health pulse",        sub:"How is my team? Am I leading well?",       xp:15, icon:"👥" },
    { id:"i2", text:"Platform capture",         sub:"What from IJM this week feeds the books?", xp:20, icon:"📚" },
    { id:"i3", text:"Global impact moment",     sub:"One thing that reminded me why.",          xp:10, icon:"🌍" },
  ],
  monthly: [
    { id:"m0",  text:"Financial review — Jules",  sub:"30 min. Both present.",                 xp:30, icon:"💼" },
    { id:"m1",  text:"LinkedIn article",          sub:"Test a book idea.",                      xp:40, icon:"📱" },
    { id:"m2",  text:"Focused time — both kids",  sub:"Annie + River. Intentional.",            xp:25, icon:"👨‍👧‍👦" },
    { id:"m3",  text:"Annie Boba date",           sub:"Her space, her pace.",                   xp:20, icon:"🧋" },
    { id:"m4",  text:"Parent contact — Australia",sub:"Call, video, or message.",              xp:20, icon:"🌏" },
    { id:"m5",  text:"Personal reflection",       sub:"Am I moving toward 55?",                 xp:25, icon:"🪞" },
    { id:"m6",  text:"Platform audit",            sub:"What moved this month?",                 xp:30, icon:"🚀" },
    { id:"m7",  text:"Album session — 1hr min",   sub:"Dedicated time on the record.",          xp:35, icon:"🎵" },
    { id:"m8",  text:"Something fun",             sub:"Concert, event, experience.",            xp:20, icon:"🎉" },
    { id:"m9",  text:"Sabbath 1 of 3",            sub:"Three per month minimum.",              xp:25, icon:"🕊️" },
    { id:"m10", text:"Sabbath 2 of 3",            sub:"Three per month minimum.",              xp:25, icon:"🕊️" },
    { id:"m11", text:"Sabbath 3 of 3",            sub:"Three per month minimum.",              xp:25, icon:"🕊️" },
  ],
  annual: [
    { id:"a0", text:"Annual physical",           sub:"Full bloodwork. Ferritin included.",     xp:100, icon:"🩺" },
    { id:"a1", text:"Ferritin & iron checked",   sub:"HFE variant. Rule it in or out.",       xp:50,  icon:"🔬" },
    { id:"a2", text:"Dental checkup",            sub:"Twice yearly ideally.",                 xp:40,  icon:"🦷" },
    { id:"a3", text:"Financial planner meeting", sub:"529, platform income, parents.",        xp:75,  icon:"🏦" },
    { id:"a4", text:"Estate/will reviewed",      sub:"Jules knows where everything is.",      xp:60,  icon:"📋" },
    { id:"a5", text:"Goal architecture review",  sub:"Full year. Reset the vision.",          xp:75,  icon:"🗺️" },
    { id:"a6", text:"Family adventure booked",   sub:"Next year's trip decided by June.",     xp:50,  icon:"✈️" },
    { id:"a7", text:"Anniversary intentional",   sub:"December 2. Not a calendar entry.",    xp:60,  icon:"💍" },
    { id:"a8", text:"Parent care plan reviewed", sub:"Australia. Aging considerations.",      xp:50,  icon:"🌏" },
  ],
};

const CHECKLIST_TRAVEL = {
  daily: [
    { id:"td0", text:"Morning anchor — non-negotiable", sub:"The compass doesn't change with the timezone.", xp:12, icon:"🕊️" },
    { id:"td1", text:"30 min stillness",              sub:"Especially on the road.",                       xp:10, icon:"☀️" },
    { id:"td2", text:"No caffeine after 12pm local",  sub:"Jet lag + slow metabolizer. Protect sleep.",    xp:5,  icon:"☕" },
    { id:"td3", text:"Sleep kit deployed",            sub:"Eye mask, earplugs, room dark.",                xp:5,  icon:"😴" },
    { id:"td4", text:"Called Jules and the kids",     sub:"Connection doesn't stop at the gate.",          xp:10, icon:"📱" },
    { id:"td5", text:"20 min movement",               sub:"Hotel gym or bodyweight.",                      xp:5,  icon:"🏃" },
    { id:"td6", text:"Hydration — water first",       sub:"Not just airport coffee.",                      xp:3,  icon:"💧" },
    { id:"td7", text:"IJM intention set",             sub:"Why am I here today?",                          xp:8,  icon:"🎯" },
    { id:"td8", text:"Platform capture",              sub:"What from today feeds the books or 151?",      xp:10, icon:"✍️" },
    { id:"td9", text:"No decisions after 9pm local",  sub:"Jet lag impairs judgment.",                     xp:3,  icon:"🌙" },
  ],
  weekly: [
    { id:"tw0", text:"Team touchpoint from the field",sub:"Lead well from wherever you are.",              xp:15, icon:"👥" },
    { id:"tw1", text:"Mission clarity set",           sub:"Why am I here? What does success look like?",  xp:15, icon:"🎯" },
    { id:"tw2", text:"Platform material captured",    sub:"What feeds Recalibrated, The Sequence, 151?",  xp:20, icon:"📚" },
    { id:"tw3", text:"IJM deliverable progressed",    sub:"Something moved this week.",                    xp:15, icon:"📊" },
    { id:"tw4", text:"Recovery window protected",     sub:"One genuine rest block.",                       xp:10, icon:"🛌" },
    { id:"tw5", text:"Jules informed and aligned",    sub:"She knows the plan. No surprises.",             xp:10, icon:"💍" },
  ],
};

const GOALS_INIT = [
  { id:"g0",  domain:"family",    title:"Annie's college pathway — depth over compliance", detail:"Theatre/Arts as spike.",              target:"2029",     progress:20 },
  { id:"g1",  domain:"family",    title:"River's ceiling limited only by talent",          detail:"Pride Club, BC, daily training.",      target:"Ongoing",  progress:35 },
  { id:"g2",  domain:"family",    title:"Parents feel cared for",                          detail:"Conversation guide. Regular contact.", target:"2027",     progress:15 },
  { id:"g3",  domain:"family",    title:"20th anniversary marked",                         detail:"December 2, 2026.",                    target:"Dec 2026", progress:10 },
  { id:"g4",  domain:"platform",  title:"The Sequence — manuscript complete",              detail:"LinkedIn monthly. Ken Caldwell.",      target:"Q1 2027",  progress:20 },
  { id:"g5",  domain:"platform",  title:"Recalibrated — publisher secured",                detail:"Zondervan, IVP, WaterBrook.",         target:"2027",     progress:30 },
  { id:"g6",  domain:"platform",  title:"BenWebb.com live",                                detail:"One home for all three projects.",     target:"Q2 2026",  progress:5  },
  { id:"g7",  domain:"platform",  title:"One Five One — podcast launched",                 detail:"After books establish platform.",      target:"2028",     progress:10 },
  { id:"g8",  domain:"financial", title:"529 accounts open — Annie & River",              detail:"Colorado CollegeInvest.",              target:"Q2 2026",  progress:0  },
  { id:"g9",  domain:"financial", title:"Fee-only fiduciary engaged",                     detail:"Call script ready.",                   target:"Q2 2026",  progress:10 },
  { id:"g10", domain:"health",    title:"Strength/sprint as primary modality",            detail:"3× per week minimum.",                 target:"Ongoing",  progress:40 },
  { id:"g11", domain:"health",    title:"Sleep kit optimized for travel",                 detail:"Eye mask, earplugs. Every trip.",      target:"Q2 2026",  progress:50 },
];

const TRACKS_INIT = [
  { id:"t0", title:"Track 01", stage:"Recording",  priority:true,  notes:"" },
  { id:"t1", title:"Track 02", stage:"Demo",        priority:false, notes:"" },
  { id:"t2", title:"Track 03", stage:"Written",     priority:false, notes:"" },
  { id:"t3", title:"Track 04", stage:"Demo",        priority:false, notes:"" },
  { id:"t4", title:"Track 05", stage:"Written",     priority:false, notes:"" },
  { id:"t5", title:"Track 06", stage:"Written",     priority:false, notes:"" },
  { id:"t6", title:"Track 07", stage:"Not Started", priority:false, notes:"" },
  { id:"t7", title:"Track 08", stage:"Not Started", priority:false, notes:"" },
  { id:"t8", title:"Track 09", stage:"Not Started", priority:false, notes:"" },
  { id:"t9", title:"Track 10", stage:"Not Started", priority:false, notes:"" },
];

const STAGES = ["Not Started","Written","Demo","Recording","Mixing","Complete"];
const STAGE_PCT = {"Not Started":0,"Written":20,"Demo":40,"Recording":60,"Mixing":80,"Complete":100};
const INSTRUMENTS = ["Bass","Guitar","Piano","Drums"];

const ACHIEVEMENTS = [
  { id:"a0", icon:"🌱", title:"First Step",        check:s=>s.totalDaysComplete>=1   },
  { id:"a1", icon:"🔥", title:"7-Day Streak",      check:s=>s.currentStreak>=7       },
  { id:"a2", icon:"⚡", title:"30-Day Streak",     check:s=>s.currentStreak>=30      },
  { id:"a3", icon:"🕊️", title:"Sabbath Keeper",   check:s=>s.sabbathCount>=9        },
  { id:"a4", icon:"🎯", title:"Goal Crusher",      check:s=>s.goalsComplete>=1       },
  { id:"a5", icon:"🎵", title:"In the Studio",     check:s=>s.practiceSessions>=10   },
  { id:"a6", icon:"👥", title:"Well Connected",    check:s=>s.friendDinners>=6       },
  { id:"a7", icon:"✈️", title:"Global Servant",   check:s=>s.tripCount>=3           },
  { id:"a8", icon:"👑", title:"1,000 XP",          check:s=>s.totalXP>=1000          },
  { id:"a9", icon:"🌍", title:"Legacy Builder",    check:s=>s.totalXP>=2500          },
];

const DOMAIN_CFG = {
  family:    { label:"Family",    color:"#2563EB" },
  platform:  { label:"Platform",  color:"#7C3AED" },
  financial: { label:"Financial", color:"#0891B2" },
  health:    { label:"Health",    color:"#059669" },
};

// ── HELPERS ───────────────────────────────────────────────────────────
const todayKey   = () => new Date().toISOString().split("T")[0];
const monthKey   = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const yearKey    = () => `${new Date().getFullYear()}`;
const weekKey    = () => { const d=new Date(),j=new Date(d.getFullYear(),0,1),w=Math.ceil((((d-j)/864e5)+j.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`; };

function getLevelInfo(xp) {
  const T=[{l:1,max:149,t:"Getting Started"},{l:2,max:349,t:"Building Rhythm"},{l:3,max:699,t:"Gaining Momentum"},{l:4,max:1249,t:"In the Flow"},{l:5,max:2499,t:"Man After God's Heart"},{l:6,max:Infinity,t:"Legacy Builder"}];
  const tier=T.find(t=>xp<=t.max)||T[T.length-1];
  const prev=T[T.indexOf(tier)-1],pm=prev?prev.max:-1;
  return {...tier,progress:tier.max===Infinity?100:Math.round(((xp-pm-1)/(tier.max-pm))*100)};
}
function summerDaysLeft(){const n=new Date(),s=new Date(n.getFullYear(),5,21);if(n>s)s.setFullYear(s.getFullYear()+1);return Math.ceil((s-n)/864e5);}
function formatDate(){return new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});}
function formatShort(iso){return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});}

// ── DAILY SCRIPTURE ───────────────────────────────────────────────────
const SCRIPTURES = [
  { verse:"For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", ref:"Jeremiah 29:11" },
  { verse:"I can do all this through him who gives me strength.", ref:"Philippians 4:13" },
  { verse:"The Lord is my shepherd, I lack nothing.", ref:"Psalm 23:1" },
  { verse:"Trust in the Lord with all your heart and lean not on your own understanding.", ref:"Proverbs 3:5" },
  { verse:"Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", ref:"Joshua 1:9" },
  { verse:"And we know that in all things God works for the good of those who love him.", ref:"Romans 8:28" },
  { verse:"The Lord is my light and my salvation — whom shall I fear?", ref:"Psalm 27:1" },
  { verse:"Come to me, all you who are weary and burdened, and I will give you rest.", ref:"Matthew 11:28" },
  { verse:"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", ref:"Philippians 4:6" },
  { verse:"He gives strength to the weary and increases the power of the weak.", ref:"Isaiah 40:29" },
  { verse:"But seek first his kingdom and his righteousness, and all these things will be given to you as well.", ref:"Matthew 6:33" },
  { verse:"The joy of the Lord is your strength.", ref:"Nehemiah 8:10" },
  { verse:"Cast all your anxiety on him because he cares for you.", ref:"1 Peter 5:7" },
  { verse:"Those who hope in the Lord will renew their strength. They will soar on wings like eagles.", ref:"Isaiah 40:31" },
  { verse:"Be still and know that I am God.", ref:"Psalm 46:10" },
  { verse:"The steadfast love of the Lord never ceases; his mercies never come to an end.", ref:"Lamentations 3:22–23" },
  { verse:"Whatever you do, work at it with all your heart, as working for the Lord.", ref:"Colossians 3:23" },
  { verse:"No, in all these things we are more than conquerors through him who loved us.", ref:"Romans 8:37" },
  { verse:"I praise you because I am fearfully and wonderfully made.", ref:"Psalm 139:14" },
  { verse:"The Lord bless you and keep you; the Lord make his face shine on you.", ref:"Numbers 6:24–25" },
  { verse:"If God is for us, who can be against us?", ref:"Romans 8:31" },
  { verse:"Blessed is the one who trusts in the Lord, whose confidence is in him.", ref:"Jeremiah 17:7" },
  { verse:"So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.", ref:"Isaiah 41:10" },
  { verse:"My grace is sufficient for you, for my power is made perfect in weakness.", ref:"2 Corinthians 12:9" },
  { verse:"He who began a good work in you will carry it on to completion.", ref:"Philippians 1:6" },
  { verse:"The Lord is close to the brokenhearted and saves those who are crushed in spirit.", ref:"Psalm 34:18" },
  { verse:"Commit to the Lord whatever you do, and he will establish your plans.", ref:"Proverbs 16:3" },
  { verse:"Now to him who is able to do immeasurably more than all we ask or imagine.", ref:"Ephesians 3:20" },
  { verse:"Your word is a lamp for my feet, a light on my path.", ref:"Psalm 119:105" },
  { verse:"This is the day the Lord has made; let us rejoice and be glad in it.", ref:"Psalm 118:24" },
  { verse:"For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.", ref:"2 Timothy 1:7" },
  { verse:"The Lord is my rock, my fortress and my deliverer.", ref:"Psalm 18:2" },
  { verse:"You will keep in perfect peace those whose minds are steadfast, because they trust in you.", ref:"Isaiah 26:3" },
  { verse:"God is our refuge and strength, an ever-present help in trouble.", ref:"Psalm 46:1" },
  { verse:"Draw near to God and he will draw near to you.", ref:"James 4:8" },
  { verse:"Set your minds on things above, not on earthly things.", ref:"Colossians 3:2" },
  { verse:"He restores my soul. He leads me in paths of righteousness for his name's sake.", ref:"Psalm 23:3" },
  { verse:"The Lord is faithful, and he will strengthen you and protect you.", ref:"2 Thessalonians 3:3" },
  { verse:"Delight yourself in the Lord and he will give you the desires of your heart.", ref:"Psalm 37:4" },
  { verse:"And the peace of God, which transcends all understanding, will guard your hearts and your minds.", ref:"Philippians 4:7" },
  { verse:"The Lord makes firm the steps of the one who delights in him.", ref:"Psalm 37:23" },
  { verse:"Every good and perfect gift is from above, coming down from the Father of the heavenly lights.", ref:"James 1:17" },
  { verse:"Taste and see that the Lord is good; blessed is the one who takes refuge in him.", ref:"Psalm 34:8" },
  { verse:"Let the morning bring me word of your unfailing love, for I have put my trust in you.", ref:"Psalm 143:8" },
  { verse:"For the Lord is good and his love endures forever; his faithfulness continues through all generations.", ref:"Psalm 100:5" },
  { verse:"Surely goodness and love will follow me all the days of my life.", ref:"Psalm 23:6" },
  { verse:"Great is the Lord and most worthy of praise; his greatness no one can fathom.", ref:"Psalm 145:3" },
  { verse:"Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.", ref:"Matthew 7:7" },
  { verse:"For God so loved the world that he gave his one and only Son.", ref:"John 3:16" },
  { verse:"I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit.", ref:"John 15:5" },
  { verse:"The Lord your God is with you, the Mighty Warrior who saves. He will take great delight in you.", ref:"Zephaniah 3:17" },
];

function getDailyScripture() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((new Date() - start) / 864e5);
  return SCRIPTURES[dayOfYear % SCRIPTURES.length];
}

// ── CONFETTI + XP FLOAT ──────────────────────────────────────────────
function Confetti() {
  const pieces=Array.from({length:60},(_,i)=>({id:i,x:Math.random()*100,color:["#2563EB","#60A5FA","#F59E0B","#34D399","#A78BFA","#FBBF24"][Math.floor(Math.random()*6)],size:Math.random()*8+4,delay:Math.random()*0.8,duration:Math.random()*1.5+1.5}));
  return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1000,overflow:"hidden"}}>{pieces.map(p=>(<div key={p.id} style={{position:"absolute",top:"-20px",left:`${p.x}%`,width:p.size,height:p.size,background:p.color,borderRadius:Math.random()>0.5?"50%":"2px",animation:`confettiFall ${p.duration}s ${p.delay}s ease-in forwards`}}/>))}</div>);
}
function XPFloat({amount,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,1200);return()=>clearTimeout(t);},[]);
  return <div style={{position:"fixed",bottom:140,right:24,fontWeight:800,fontSize:18,color:"#2563EB",animation:"xpFloat 1.2s ease-out forwards",pointerEvents:"none",zIndex:500}}>+{amount} XP</div>;
}

// ── STYLES ────────────────────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body,html{background:#EEF2F9;color:#0B1929;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}
button,input,textarea,select{font-family:inherit;}
.app{min-height:100vh;display:flex;flex-direction:column;max-width:430px;margin:0 auto;background:#EEF2F9;}
@keyframes gradShift{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}
@keyframes countUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeSlideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes bounceCheck{0%{transform:scale(1);}30%{transform:scale(0.75);}60%{transform:scale(1.25);}80%{transform:scale(0.92);}100%{transform:scale(1);}}
@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1;}100%{transform:translateY(110vh) rotate(360deg);opacity:0;}}
@keyframes xpFloat{0%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-60px);}}
@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
@keyframes fireGlow{0%,100%{text-shadow:0 0 8px rgba(251,191,36,0.4);}50%{text-shadow:0 0 20px rgba(251,191,36,0.9);}}
@keyframes travelPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.4);}50%{box-shadow:0 0 0 8px rgba(245,158,11,0);}}
@keyframes glow{0%,100%{opacity:0.6;}50%{opacity:1;}}
@keyframes slideInLeft{from{opacity:0;transform:translateX(-20px);}to{opacity:1;transform:translateX(0);}}
@keyframes fadeOut{to{opacity:0;transform:translateX(-50%) translateY(-6px);}}
.hdr{background:rgba(255,255,255,0.92);backdrop-filter:blur(24px);border-bottom:1px solid rgba(11,25,41,0.07);padding:calc(14px + env(safe-area-inset-top)) 18px 12px;position:sticky;top:0;z-index:50;}
.hdr-inner{display:flex;align-items:center;justify-content:space-between;}
.hdr-eyebrow{font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#2563EB;margin-bottom:1px;}
.hdr-date{font-size:20px;font-weight:800;color:#0B1929;letter-spacing:-0.03em;line-height:1.1;}
.travel-toggle{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:100px;border:none;cursor:pointer;font-size:13px;font-weight:700;transition:all 0.3s;}
.travel-toggle.off{background:#F1F5F9;color:#64748B;}
.travel-toggle.on{background:linear-gradient(90deg,#92400E,#D97706);color:#fff;animation:travelPulse 2s infinite;}
.modal-overlay{position:fixed;inset:0;background:rgba(11,25,41,0.5);z-index:200;display:flex;align-items:flex-end;}
.modal-sheet{background:#fff;border-radius:24px 24px 0 0;padding:28px 22px 40px;width:100%;}
.modal-title{font-size:22px;font-weight:800;color:#0B1929;margin-bottom:6px;}
.modal-sub{font-size:14px;color:#64748B;margin-bottom:20px;}
.modal-input{width:100%;background:#F0F4FA;border:2px solid transparent;border-radius:16px;padding:16px 18px;font-size:18px;font-weight:600;color:#0B1929;outline:none;transition:all 0.2s;margin-bottom:14px;}
.modal-input:focus{background:#fff;border-color:#2563EB;}
.modal-input::placeholder{color:#CBD5E1;font-weight:400;}
.modal-btn{width:100%;padding:18px;border:none;border-radius:16px;background:linear-gradient(135deg,#B45309,#D97706);color:#fff;font-size:17px;font-weight:800;cursor:pointer;}
.modal-cancel{width:100%;padding:12px;border:none;background:transparent;color:#94A3B8;font-size:15px;cursor:pointer;margin-top:8px;}
.scroll{flex:1;overflow-y:auto;padding:14px 15px 100px;}
.hero-home{background:linear-gradient(145deg,#0B1929,#1A3A6B,#1E40AF,#2563EB);background-size:300% 300%;animation:gradShift 10s ease infinite;border-radius:26px;padding:26px 22px 22px;margin-bottom:12px;position:relative;overflow:hidden;}
.hero-home::before{content:'';position:absolute;top:-60px;right:-50px;width:240px;height:240px;background:radial-gradient(circle,rgba(96,165,250,0.2),transparent 70%);animation:glow 4s ease-in-out infinite;}
.hero-travel{background:linear-gradient(145deg,#1C0A00,#78350F,#B45309,#D97706);background-size:300% 300%;animation:gradShift 8s ease infinite;border-radius:26px;padding:26px 22px 22px;margin-bottom:12px;position:relative;overflow:hidden;}
.hero-travel::before{content:'';position:absolute;top:-60px;right:-50px;width:240px;height:240px;background:radial-gradient(circle,rgba(251,191,36,0.15),transparent 70%);animation:glow 3s ease-in-out infinite;}
.h-eyebrow{font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:4px;}
.h-streak-wrap{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:18px;position:relative;z-index:1;}
.h-streak-num{font-size:86px;font-weight:900;color:#fff;line-height:1;letter-spacing:-0.06em;animation:countUp 0.6s ease;}
.h-streak-right{text-align:right;padding-bottom:8px;}
.h-fire{font-size:44px;line-height:1;animation:pulse 2s ease-in-out infinite;display:block;}
.fire-travel{animation:fireGlow 1.5s ease-in-out infinite,pulse 2s ease-in-out infinite;}
.h-best{font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:0.04em;margin-top:4px;}
.h-prog-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;position:relative;z-index:1;}
.h-prog-label{font-size:13px;font-weight:500;color:rgba(255,255,255,0.5);}
.h-prog-pct{font-size:17px;font-weight:800;color:#fff;}
.h-track{height:5px;background:rgba(255,255,255,0.12);border-radius:100px;overflow:hidden;position:relative;z-index:1;margin-bottom:18px;}
.h-fill-home{height:100%;border-radius:100px;background:linear-gradient(90deg,#60A5FA,#BAE6FD);transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.h-fill-travel{height:100%;border-radius:100px;background:linear-gradient(90deg,#FCD34D,#FDE68A);transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.h-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;position:relative;z-index:1;}
.h-stat{background:rgba(255,255,255,0.09);border-radius:14px;padding:12px 10px;backdrop-filter:blur(8px);}
.h-stat-val{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;}
.h-stat-lbl{font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;}
.travel-badge{background:linear-gradient(135deg,#78350F,#D97706);border-radius:12px;padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;}
.tb-dest{font-size:15px;font-weight:800;color:#fff;}
.tb-sub{font-size:12px;color:rgba(255,255,255,0.55);}
.xp-card{background:#fff;border-radius:18px;padding:15px 18px;margin-bottom:12px;box-shadow:0 2px 16px rgba(11,25,41,0.07);}
.xp-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.xp-level{font-size:14px;font-weight:700;color:#0B1929;}
.xp-pts{font-size:13px;font-weight:600;color:#64748B;}
.xp-track{height:6px;background:#EEF2F9;border-radius:100px;overflow:hidden;}
.xp-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#1A3A6B,#2563EB,#60A5FA);background-size:200% 100%;animation:shimmer 3s linear infinite;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.sec{margin:22px 0 10px;}
.sec-title{font-size:21px;font-weight:800;color:#0B1929;letter-spacing:-0.03em;}
.sec-sub{font-size:13px;color:#64748B;margin-top:2px;}
.scripture-card{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:1px solid #BFDBFE;border-radius:18px;padding:16px 18px;margin-bottom:12px;position:relative;overflow:hidden;}
.scripture-card::before{content:'❝';position:absolute;top:-4px;left:12px;font-size:48px;color:#BFDBFE;line-height:1;font-family:Georgia,serif;}
.scripture-verse{font-size:14px;font-weight:500;color:#1D4ED8;line-height:1.65;padding-left:8px;font-style:italic;}
.scripture-ref{font-size:11px;font-weight:800;color:#3B82F6;margin-top:8px;letter-spacing:0.06em;text-transform:uppercase;}
.todo-input-row{display:flex;gap:10px;margin-bottom:10px;}
.todo-input{flex:1;background:#fff;border:1.5px solid #E2E8F0;border-radius:14px;padding:13px 16px;font-size:15px;color:#0B1929;outline:none;transition:all 0.2s;}
.todo-input::placeholder{color:#CBD5E1;}
.todo-input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,0.08);}
.todo-add-btn{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#1A3A6B,#2563EB);border:none;color:#fff;font-size:24px;font-weight:300;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 10px rgba(37,99,235,0.3);}
.todo-circle{width:24px;height:24px;border-radius:50%;border:2px solid #CBD5E1;flex-shrink:0;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}
.todo-circle.done{background:linear-gradient(135deg,#059669,#34D399);border-color:transparent;}
.todo-circle.done::after{content:'✓';color:#fff;font-size:11px;font-weight:800;}
.todo-del{background:none;border:none;color:#CBD5E1;font-size:20px;cursor:pointer;padding:4px;line-height:1;transition:color 0.15s;flex-shrink:0;}
.todo-del:hover{color:#94A3B8;}
.prompt-card{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:1.5px solid #BFDBFE;border-radius:18px;padding:15px 17px;margin-bottom:12px;display:flex;align-items:center;gap:13px;cursor:pointer;transition:all 0.2s;}
.prompt-card:active{transform:scale(0.98);}
.prompt-icon{font-size:26px;flex-shrink:0;}
.prompt-body{flex:1;}
.prompt-title{font-size:15px;font-weight:700;color:#1D4ED8;}
.prompt-sub{font-size:12px;color:#3B82F6;margin-top:2px;}
.prompt-arrow{font-size:20px;color:#93C5FD;}
.check-card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.c-row{display:flex;align-items:center;gap:13px;padding:15px 18px;border-bottom:1px solid #F1F5F9;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.1s;}
.c-row:last-child{border-bottom:none;}
.c-row:active{background:#F8FAFD;}
.c-row.animIn{animation:fadeSlideUp 0.35s ease both;}
.c-icon-bg{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;background:#F1F5F9;transition:all 0.3s;}
.c-icon-bg.done{background:linear-gradient(135deg,#1A3A6B,#2563EB);}
.c-icon-bg.done-travel{background:linear-gradient(135deg,#78350F,#D97706);}
.c-circle{width:26px;height:26px;border-radius:50%;border:2px solid #CBD5E1;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.25s;}
.c-circle.done{background:linear-gradient(135deg,#1A3A6B,#2563EB);border-color:transparent;}
.c-circle.done-travel{background:linear-gradient(135deg,#92400E,#D97706);border-color:transparent;}
.c-circle.bounce{animation:bounceCheck 0.4s ease;}
.c-circle.done::after,.c-circle.done-travel::after{content:'✓';color:#fff;font-size:12px;font-weight:800;}
.c-body{flex:1;min-width:0;}
.c-main{font-size:15px;font-weight:600;color:#0B1929;line-height:1.25;transition:color 0.2s;}
.c-main.done{color:#CBD5E1;}
.c-hint{font-size:12px;color:#94A3B8;margin-top:2px;line-height:1.3;}
.c-ts{font-size:10px;color:#CBD5E1;margin-top:3px;}
.c-xp{font-size:12px;font-weight:700;color:#2563EB;min-width:28px;text-align:right;}
.c-xp.travel{color:#D97706;}
.c-xp.done{color:#CBD5E1;}
.ijm-header{background:linear-gradient(135deg,#0F172A,#1E293B);border-radius:16px 16px 0 0;padding:14px 18px;display:flex;align-items:center;gap:10px;}
.ijm-dot{width:8px;height:8px;border-radius:50%;background:#2563EB;box-shadow:0 0 8px rgba(37,99,235,0.6);animation:glow 2s ease-in-out infinite;}
.ijm-title{font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.06em;text-transform:uppercase;}
.ijm-sub{font-size:11px;color:rgba(255,255,255,0.35);margin-top:1px;}
.ijm-card{background:#fff;border-radius:0 0 20px 20px;overflow:hidden;margin-bottom:12px;box-shadow:0 4px 20px rgba(11,25,41,0.1);}
.r-tabs{display:flex;background:rgba(255,255,255,0.7);border-radius:14px;padding:4px;gap:2px;margin-bottom:14px;backdrop-filter:blur(10px);}
.r-tab{flex:1;padding:10px 4px;border:none;background:transparent;border-radius:10px;font-size:13px;font-weight:600;color:#64748B;cursor:pointer;transition:all 0.25s;}
.r-tab.active{background:linear-gradient(135deg,#1A3A6B,#2563EB);color:#fff;box-shadow:0 2px 10px rgba(26,58,107,0.3);}
.r-tab.travel-active{background:linear-gradient(135deg,#78350F,#D97706);color:#fff;}
.friend-list{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.friend-row{display:flex;align-items:center;gap:12px;padding:13px 17px;border-bottom:1px solid #F1F5F9;animation:slideInLeft 0.3s ease;}
.friend-row:last-child{border-bottom:none;}
.friend-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1A3A6B,#2563EB);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0;}
.friend-name{flex:1;font-size:15px;font-weight:600;color:#0B1929;}
.friend-note{font-size:12px;color:#64748B;margin-top:1px;}
.friend-date{font-size:11px;color:#CBD5E1;}
.friend-del{background:none;border:none;color:#E2E8F0;font-size:20px;cursor:pointer;padding:4px;line-height:1;}
.fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
.fin-card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 2px 16px rgba(11,25,41,0.07);}
.fin-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:6px;}
.fin-val{font-size:28px;font-weight:900;letter-spacing:-0.04em;line-height:1;margin-bottom:8px;}
.fin-bar{height:5px;background:#EEF2F9;border-radius:100px;overflow:hidden;margin-bottom:6px;}
.fin-fill{height:100%;border-radius:100px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.fin-sub{font-size:12px;color:#94A3B8;}
.fin-edit{background:#fff;border-radius:18px;padding:18px;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.fin-edit-title{font-size:16px;font-weight:700;color:#0B1929;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.fin-close{background:none;border:none;color:#94A3B8;font-size:14px;cursor:pointer;font-weight:600;}
.fin-row{display:flex;gap:10px;margin-bottom:10px;}
.fin-fw{flex:1;}
.fin-fl{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;}
.fin-fi{width:100%;background:#F0F4FA;border:1.5px solid transparent;border-radius:12px;padding:11px 13px;font-size:16px;font-weight:700;color:#0B1929;outline:none;transition:all 0.2s;}
.fin-fi:focus{background:#fff;border-color:#2563EB;}
.d-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
.d-card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 2px 16px rgba(11,25,41,0.07);}
.d-icon{font-size:22px;margin-bottom:8px;}
.d-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:6px;}
.d-pct{font-size:34px;font-weight:900;letter-spacing:-0.04em;line-height:1;margin-bottom:8px;}
.d-bar{height:4px;background:#EEF2F9;border-radius:100px;overflow:hidden;}
.d-fill{height:100%;border-radius:100px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.g-card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:10px;}
.g-card.complete{opacity:0.4;}
.g-hdr{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px;}
.g-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:6px;}
.g-title{font-size:16px;font-weight:700;color:#0B1929;line-height:1.3;flex:1;}
.g-done{width:28px;height:28px;border-radius:50%;border:2px solid #CBD5E1;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:12px;font-weight:800;transition:all 0.2s;flex-shrink:0;}
.g-done.done{background:#059669;border-color:#059669;color:#fff;}
.g-detail{font-size:13px;color:#64748B;margin-bottom:9px;line-height:1.5;}
.g-tag{display:inline-flex;font-size:11px;font-weight:700;padding:4px 10px;border-radius:100px;margin-bottom:12px;}
.g-prog-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.g-prog-track{flex:1;height:5px;background:#EEF2F9;border-radius:100px;overflow:hidden;}
.g-prog-fill{height:100%;border-radius:100px;transition:width 0.4s;}
.g-prog-pct{font-size:14px;font-weight:800;color:#0B1929;width:36px;text-align:right;}
.g-slider{width:100%;-webkit-appearance:none;height:5px;background:#EEF2F9;border-radius:100px;outline:none;cursor:pointer;margin-bottom:10px;}
.g-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#1A3A6B,#2563EB);cursor:pointer;box-shadow:0 2px 8px rgba(26,58,107,0.35);}
.g-note{width:100%;background:#F0F4FA;border:1.5px solid transparent;border-radius:12px;padding:10px 13px;font-size:13px;color:#0B1929;outline:none;resize:none;transition:all 0.2s;line-height:1.5;}
.g-note::placeholder{color:#CBD5E1;}
.g-note:focus{background:#fff;border-color:#2563EB;}
.chips{display:flex;gap:8px;margin-bottom:13px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{padding:8px 16px;border-radius:100px;border:1.5px solid #E2E8F0;background:#fff;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.2s;}
.chip.active{border-color:var(--cc);color:var(--cc);}
.music-hero{background:linear-gradient(145deg,#0F172A,#1A3A6B,#2563EB);background-size:300% 300%;animation:gradShift 12s ease infinite;border-radius:24px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden;}
.music-hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(96,165,250,0.15),transparent 70%);animation:glow 5s ease-in-out infinite;}
.mh-lbl{font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:3px;}
.mh-title{font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.03em;margin-bottom:2px;}
.mh-sub{font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:18px;}
.mh-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.mh-stat{background:rgba(255,255,255,0.1);border-radius:13px;padding:11px 9px;backdrop-filter:blur(8px);}
.mh-val{font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.03em;}
.mh-lbl2{font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-top:1px;}
.mh-acc{font-size:11px;font-weight:700;color:#60A5FA;margin-top:1px;}
.album-card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.album-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
.album-title{font-size:17px;font-weight:800;color:#0B1929;}
.album-sub{font-size:12px;color:#64748B;margin-top:2px;}
.countdown{background:linear-gradient(135deg,#FEF3C7,#FDE68A);border-radius:12px;padding:8px 13px;text-align:center;}
.cd-num{font-size:20px;font-weight:900;color:#92400E;letter-spacing:-0.03em;}
.cd-lbl{font-size:9px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.08em;}
.album-bar{height:8px;background:#EEF2F9;border-radius:100px;overflow:hidden;margin-bottom:8px;}
.album-fill{height:100%;background:linear-gradient(90deg,#1A3A6B,#2563EB,#60A5FA);background-size:200% 100%;animation:shimmer 4s linear infinite;border-radius:100px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);}
.album-footer{display:flex;justify-content:space-between;}
.album-footer-lbl{font-size:13px;color:#64748B;}
.album-footer-val{font-size:14px;font-weight:800;color:#0B1929;}
.prac-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:13px;}
.prac-card{background:#fff;border-radius:17px;padding:17px 10px;text-align:center;box-shadow:0 2px 16px rgba(11,25,41,0.07);cursor:pointer;border:2px solid transparent;transition:all 0.25s;}
.prac-card.logged{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-color:#2563EB;}
.prac-card:active{transform:scale(0.96);}
.prac-num{font-size:30px;font-weight:900;color:#CBD5E1;letter-spacing:-0.04em;margin-bottom:3px;}
.prac-num.logged{color:#1D4ED8;}
.prac-lbl{font-size:10px;font-weight:700;color:#CBD5E1;text-transform:uppercase;letter-spacing:0.06em;}
.prac-lbl.logged{color:#3B82F6;}
.prac-instr{font-size:11px;color:#94A3B8;margin-top:3px;}
.prac-instr.logged{color:#1D4ED8;font-weight:600;}
.instr-row{display:flex;gap:8px;flex-wrap:wrap;padding:14px 17px 10px;}
.instr-btn{padding:9px 16px;border-radius:100px;border:1.5px solid #E2E8F0;background:#fff;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;}
.instr-btn.sel{background:linear-gradient(135deg,#1A3A6B,#2563EB);border-color:transparent;color:#fff;}
.tog-row{display:flex;align-items:center;justify-content:space-between;padding:14px 17px;border-top:1px solid #F1F5F9;}
.tog-lbl{font-size:15px;font-weight:600;color:#0B1929;}
.tog-sub{font-size:12px;color:#64748B;margin-top:1px;}
.tog{width:50px;height:30px;border-radius:100px;background:#CBD5E1;position:relative;cursor:pointer;border:none;transition:background 0.25s;flex-shrink:0;}
.tog.on{background:linear-gradient(90deg,#1A3A6B,#2563EB);}
.tog::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform 0.25s;box-shadow:0 1px 4px rgba(0,0,0,0.15);}
.tog.on::after{transform:translateX(20px);}
.track-card{background:#fff;border-radius:16px;padding:15px;box-shadow:0 2px 12px rgba(11,25,41,0.06);margin-bottom:8px;}
.track-card.priority{border-left:3px solid #F59E0B;}
.track-hdr{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
.track-num{font-size:12px;font-weight:700;color:#CBD5E1;width:24px;}
.track-title{font-size:15px;font-weight:700;color:#0B1929;flex:1;cursor:pointer;}
.track-title-input{flex:1;border:none;border-bottom:2px solid #2563EB;background:transparent;font-size:15px;font-weight:700;color:#0B1929;outline:none;padding-bottom:2px;}
.stage-sel{-webkit-appearance:none;background:#EEF2F9;border:none;border-radius:100px;padding:6px 12px;font-size:12px;font-weight:700;color:#1D4ED8;cursor:pointer;outline:none;}
.stage-sel.complete{background:#DCFCE7;color:#059669;}
.track-bar{height:3px;background:#EEF2F9;border-radius:100px;overflow:hidden;margin-bottom:9px;}
.track-fill{height:100%;background:linear-gradient(90deg,#1A3A6B,#60A5FA);border-radius:100px;transition:width 0.5s;}
.track-note{width:100%;background:#F0F4FA;border:none;border-radius:10px;padding:9px 12px;font-size:12px;color:#0B1929;outline:none;resize:none;line-height:1.4;}
.track-note::placeholder{color:#CBD5E1;}
.stat-card{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.s-row{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid #F1F5F9;}
.s-row:last-child{border-bottom:none;}
.s-lbl{font-size:15px;color:#0B1929;}
.s-val{font-size:15px;font-weight:800;color:#2563EB;}
.ach-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;}
.ach-card{background:#fff;border-radius:14px;padding:12px 4px;display:flex;flex-direction:column;align-items:center;gap:5px;box-shadow:0 2px 10px rgba(11,25,41,0.06);opacity:0.2;transition:all 0.3s;}
.ach-card.unlocked{opacity:1;box-shadow:0 4px 20px rgba(37,99,235,0.15);}
.ach-icon{font-size:24px;line-height:1;}
.ach-name{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;text-align:center;line-height:1.3;}
.quote-hero{background:linear-gradient(145deg,#0B1929,#1A3A6B,#2563EB);background-size:300% 300%;animation:gradShift 12s ease infinite;border-radius:24px;padding:26px;margin-bottom:12px;}
.q-lbl{font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:10px;}
.q-text{font-size:17px;font-weight:500;color:#fff;line-height:1.55;font-style:italic;}
.q-attr{font-size:11px;font-weight:700;color:rgba(255,255,255,0.3);margin-top:12px;letter-spacing:0.08em;text-transform:uppercase;}
.insight-card{background:#fff;border-radius:18px;padding:20px;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.i-body{font-size:14px;line-height:1.8;color:#334155;white-space:pre-wrap;}
.i-placeholder{font-size:14px;line-height:1.7;color:#94A3B8;}
.coach-btn{width:100%;padding:18px;border:none;border-radius:18px;background:linear-gradient(135deg,#0B1929,#1A3A6B,#2563EB);background-size:200% 200%;animation:gradShift 5s ease infinite;color:#fff;font-size:16px;font-weight:800;cursor:pointer;transition:transform 0.15s;box-shadow:0 6px 24px rgba(37,99,235,0.35);margin-bottom:14px;}
.coach-btn:active{transform:scale(0.98);}
.coach-btn:disabled{opacity:0.4;cursor:not-allowed;animation:none;}
.vision-card{background:#fff;border-radius:18px;padding:20px;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:10px;}
.v-title{font-size:17px;font-weight:800;color:#0B1929;margin-bottom:7px;}
.v-body{font-size:14px;line-height:1.7;color:#334155;}
.tenet-row{display:flex;align-items:flex-start;gap:13px;padding:13px 0;border-bottom:1px solid #F1F5F9;}
.tenet-row:last-child{border-bottom:none;}
.tenet-s{font-size:24px;font-weight:900;color:#2563EB;width:26px;flex-shrink:0;line-height:1.15;}
.tenet-name{font-size:15px;font-weight:700;color:#0B1929;margin-bottom:2px;}
.tenet-desc{font-size:13px;color:#64748B;line-height:1.4;}
.add-form{background:#fff;border-radius:18px;padding:20px;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:14px;}
.add-title{font-size:18px;font-weight:800;color:#0B1929;margin-bottom:16px;}
.field{width:100%;background:#EEF2F9;border:1.5px solid transparent;border-radius:14px;padding:13px 16px;font-size:15px;color:#0B1929;outline:none;margin-bottom:10px;transition:all 0.2s;}
.field::placeholder{color:#CBD5E1;}
.field:focus{background:#fff;border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,0.08);}
select.field{-webkit-appearance:none;cursor:pointer;}
.btn-row{display:flex;gap:10px;}
.btn-p{flex:1;padding:15px;background:linear-gradient(135deg,#1A3A6B,#2563EB);border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}
.btn-s{flex:1;padding:15px;background:#EEF2F9;border:none;border-radius:14px;color:#64748B;font-size:15px;font-weight:600;cursor:pointer;}
.fab{position:fixed;bottom:88px;right:17px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#1A3A6B,#2563EB);border:none;color:#fff;font-size:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(37,99,235,0.45);z-index:40;transition:transform 0.15s;}
.fab:active{transform:scale(0.92);}
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(255,255,255,0.95);backdrop-filter:blur(24px);border-top:1px solid rgba(11,25,41,0.07);display:flex;z-index:50;padding:8px 0 calc(8px + env(safe-area-inset-bottom));}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 2px;cursor:pointer;border:none;background:transparent;color:#CBD5E1;transition:color 0.2s;}
.nav-btn.active{color:#2563EB;}
.nav-btn.active.travel{color:#D97706;}
.nav-icon{font-size:21px;line-height:1;}
.nav-lbl{font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;}
.toast{position:fixed;top:82px;left:50%;transform:translateX(-50%);background:#0B1929;border-radius:100px;padding:11px 22px;font-size:13px;font-weight:600;color:#fff;z-index:300;white-space:nowrap;animation:fadeSlideUp 0.3s ease,fadeOut 0.4s ease 2.1s forwards;box-shadow:0 4px 20px rgba(11,25,41,0.3);}
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:#EEF2F9;}
.loading-title{font-size:20px;font-weight:800;color:#0B1929;}
.loading-sub{font-size:14px;color:#94A3B8;}
.trip-card{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 2px 16px rgba(11,25,41,0.07);margin-bottom:12px;}
.trip-row{display:flex;align-items:center;gap:12px;padding:13px 17px;border-bottom:1px solid #F1F5F9;}
.trip-row:last-child{border-bottom:none;}
.trip-dest{font-size:15px;font-weight:700;color:#0B1929;}
.trip-date{font-size:12px;color:#94A3B8;margin-top:1px;}
.trip-badge{font-size:11px;font-weight:700;background:#FEF3C7;color:#B45309;padding:3px 9px;border-radius:100px;}
`;

// ── MAIN APP ──────────────────────────────────────────────────────────
export default function App() {
  const [tab,        setTab]        = useState("today");
  const [rhythmTab,  setRhythmTab]  = useState("weekly");
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);
  const [domainFilter,setDomFilter] = useState("all");
  const [showAddGoalForm,setShowAGF]= useState(false);
  const [newGoal,    setNewGoal]    = useState({title:"",detail:"",domain:"family",target:""});
  const [insightText,setInsight]    = useState("");
  const [insightLoad,setInsightLoad]= useState(false);
  const [editTrack,  setEditTrack]  = useState(null);
  const [activeInstr,setActiveInstr]= useState("Bass");
  const [friendInput,setFriendInput]= useState({name:"",note:""});
  const [showFF,     setShowFF]     = useState(false);
  const [showFinForm,setShowFinForm]= useState(false);
  const [xpFloat,    setXpFloat]    = useState(null);
  const [showConfetti,setShowConfetti]=useState(false);
  const [bouncing,   setBouncing]   = useState(null);
  const [animStreak, setAnimStreak] = useState(0);
  const confettiShown = useRef(false);
  const [travelMode, setTravelMode] = useState(false);
  const [travelDest, setTravelDest] = useState("");
  const [showTM,     setShowTM]     = useState(false);
  const [tempDest,   setTempDest]   = useState("");
  const [tripLog,    setTripLog]    = useState([]);
  const [todos,      setTodos]      = useState([]);
  const [daily,     setDaily]     = useState({});
  const [weekly,    setWeekly]    = useState({});
  const [monthly,   setMonthly]   = useState({});
  const [annual,    setAnnual]    = useState({});
  const [ijm,       setIjm]       = useState({});
  const [travelDaily,  setTravelDaily]  = useState({});
  const [travelWeekly, setTravelWeekly] = useState({});
  const [goals,       setGoals]       = useState(GOALS_INIT);
  const [tracks,      setTracks]      = useState(TRACKS_INIT);
  const [practiceLogs,setPracticeLogs]= useState({});
  const [churchRoster,setChurchRoster]= useState(false);
  const [friendLog,   setFriendLog]   = useState([]);
  const [financials,  setFinancials]  = useState({debtStart:50000,debtCurrent:50000,savingsTarget:100000,savingsCurrent:0});
  const [totalXP,     setTotalXP]     = useState(0);
  const [streaks,     setStreaks]     = useState({current:0,longest:0,lastDate:null,totalDaysComplete:0,sabbathCount:0,practiceSessions:0,friendDinners:0,tripCount:0});
  const [unlockedAch, setUnlockedAch] = useState({});

  const showToast = useCallback((msg)=>{setToast(msg);setTimeout(()=>setToast(null),2600);},[]);

  // ── LOAD FROM SUPABASE ─────────────────────────────────────────────
  useEffect(()=>{
    async function loadAll(){
      try {
        const [d,w,m,a,ij,td,tw,g,tr,pl,cr,fl,fin,xp,s,ach,tl,tm,dest] = await Promise.all([
          load(`cl-daily-${todayKey()}`),
          load(`cl-weekly-${weekKey()}`),
          load(`cl-monthly-${monthKey()}`),
          load(`cl-annual-${yearKey()}`),
          load(`cl-ijm-${weekKey()}`),
          load(`cl-tdaily-${todayKey()}`),
          load(`cl-tweekly-${weekKey()}`),
          load("wb-goals-v4"),
          load("wb-tracks-v3"),
          load(`wb-prac-${weekKey()}`),
          load(`wb-church-${weekKey()}`),
          load("wb-friends-v2"),
          load("wb-fin-v2"),
          load("wb-totalxp"),
          load("wb-streaks-v3"),
          load("wb-ach-v3"),
          load("wb-trips-v1"),
          load("wb-travel-mode"),
          load("wb-travel-dest"),
          load("wb-todos-v1"),
        ]);
        if(d)setDaily(d); if(w)setWeekly(w); if(m)setMonthly(m); if(a)setAnnual(a);
        if(ij)setIjm(ij); if(td)setTravelDaily(td); if(tw)setTravelWeekly(tw);
        if(g)setGoals(g); if(tr)setTracks(tr); if(pl)setPracticeLogs(pl);
        if(cr!==null)setChurchRoster(cr); if(fl)setFriendLog(fl);
        if(fin)setFinancials(fin); if(xp)setTotalXP(xp); if(s)setStreaks(s);
        if(ach)setUnlockedAch(ach); if(tl)setTripLog(tl);
        if(tm)setTravelMode(tm); if(dest)setTravelDest(dest);
        const tod=await load("wb-todos-v1"); if(tod)setTodos(tod);
      } catch(e) { console.error("Load error:", e); }
      setLoading(false);
    }
    loadAll();
  },[]);

  useEffect(()=>{
    if(loading)return;
    const target=streaks.current;
    if(target===0){setAnimStreak(0);return;}
    let cur=0;
    const step=()=>{cur=Math.min(cur+Math.ceil(target/20),target);setAnimStreak(cur);if(cur<target)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  },[loading,streaks.current]);

  const CL=travelMode?CHECKLIST_TRAVEL:CHECKLIST_HOME;
  const curDaily=travelMode?travelDaily:daily;
  const curWeekly=travelMode?travelWeekly:weekly;
  const setCD=travelMode?setTravelDaily:setDaily;
  const setCW=travelMode?setTravelWeekly:setWeekly;

  const dailyPct=Math.round((Object.values(curDaily).filter(v=>v?.checked).length/CL.daily.length)*100);
  const weeklyPct=Math.round((Object.values(curWeekly).filter(v=>v?.checked).length/CL.weekly.length)*100);
  const monthlyPct=Math.round((Object.values(monthly).filter(v=>v?.checked).length/CHECKLIST_HOME.monthly.length)*100);
  const annualPct=Math.round((Object.values(annual).filter(v=>v?.checked).length/CHECKLIST_HOME.annual.length)*100);
  const wkSessions=Object.keys(practiceLogs).length;
  const completedTracks=tracks.filter(t=>t.stage==="Complete").length;
  const albumProgress=Math.round(tracks.reduce((s,t)=>s+(STAGE_PCT[t.stage]||0),0)/tracks.length);
  const goalsComplete=goals.filter(g=>g.completed).length;
  const debtPct=financials.debtStart>0?Math.round(((financials.debtStart-financials.debtCurrent)/financials.debtStart)*100):0;
  const savPct=financials.savingsTarget>0?Math.min(100,Math.round((financials.savingsCurrent/financials.savingsTarget)*100)):0;
  const domainProgress=Object.keys(DOMAIN_CFG).reduce((acc,d)=>{const dg=goals.filter(g=>g.domain===d);acc[d]=dg.length?Math.round(dg.reduce((s,g)=>s+(g.progress||0),0)/dg.length):0;return acc;},{});
  const stats={currentStreak:streaks.current,totalDaysComplete:streaks.totalDaysComplete||0,sabbathCount:streaks.sabbathCount||0,goalsComplete,practiceSessions:streaks.practiceSessions||0,friendDinners:streaks.friendDinners||0,tripCount:streaks.tripCount||0,totalXP};

  useEffect(()=>{
    if(loading)return;
    const nu={...unlockedAch};let changed=false;
    ACHIEVEMENTS.forEach(a=>{if(!nu[a.id]&&a.check(stats)){nu[a.id]=true;changed=true;showToast(`🏆 ${a.title} unlocked!`);}});
    if(changed){setUnlockedAch(nu);save("wb-ach-v3",nu);}
  },[totalXP,streaks.current,goalsComplete,streaks.practiceSessions,streaks.friendDinners,streaks.tripCount]);

  useEffect(()=>{
    if(dailyPct===100&&!confettiShown.current){confettiShown.current=true;setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);}
    if(dailyPct<100)confettiShown.current=false;
  },[dailyPct]);

  async function toggleCheck(type,id,item){
    let curState,setCurState,saveKey;
    if(type==="daily"){curState=curDaily;setCurState=setCD;saveKey=travelMode?`cl-tdaily-${todayKey()}`:`cl-daily-${todayKey()}`;}
    else if(type==="weekly"){curState=curWeekly;setCurState=setCW;saveKey=travelMode?`cl-tweekly-${weekKey()}`:`cl-weekly-${weekKey()}`;}
    else if(type==="monthly"){curState=monthly;setCurState=setMonthly;saveKey=`cl-monthly-${monthKey()}`;}
    else if(type==="annual"){curState=annual;setCurState=setAnnual;saveKey=`cl-annual-${yearKey()}`;}
    else if(type==="ijm"){curState=ijm;setCurState=setIjm;saveKey=`cl-ijm-${weekKey()}`;}
    const cur=curState[id];const nowChecked=!cur?.checked;
    const ns={...curState,[id]:{checked:nowChecked,at:new Date().toISOString()}};
    setCurState(ns);
    await save(saveKey,ns);
    const nxp=Math.max(0,totalXP+(nowChecked?item.xp:-item.xp));
    setTotalXP(nxp);
    await save("wb-totalxp",nxp);
    if(nowChecked){setBouncing(id);setTimeout(()=>setBouncing(null),450);setXpFloat(item.xp);setTimeout(()=>setXpFloat(null),1300);}
    if(type==="daily"&&!travelMode){
      const ac=CHECKLIST_HOME.daily.every(i=>(i.id===id?nowChecked:ns[i.id]?.checked));
      if(ac){
        const today=todayKey(),y=new Date();y.setDate(y.getDate()-1);const yk=y.toISOString().split("T")[0];
        if(streaks.lastDate!==today){
          const nc=streaks.lastDate===yk?streaks.current+1:1;
          const nst={...streaks,current:nc,longest:Math.max(nc,streaks.longest||0),lastDate:today,totalDaysComplete:(streaks.totalDaysComplete||0)+1};
          setStreaks(nst);await save("wb-streaks-v3",nst);
          if(nc>1)showToast(`🔥 ${nc}-day streak!`);
        }
      }
    }
    if(type==="monthly"&&["m9","m10","m11"].includes(id)&&nowChecked){
      const nst={...streaks,sabbathCount:(streaks.sabbathCount||0)+1};setStreaks(nst);await save("wb-streaks-v3",nst);
    }
  }

  async function enableTravel(){
    if(!tempDest.trim())return;
    setTravelMode(true);setTravelDest(tempDest.trim());setShowTM(false);
    const trip={id:`trip-${Date.now()}`,dest:tempDest.trim(),start:new Date().toISOString()};
    const nl=[trip,...tripLog];setTripLog(nl);
    await save("wb-trips-v1",nl);
    await save("wb-travel-mode",true);
    await save("wb-travel-dest",tempDest.trim());
    const nst={...streaks,tripCount:(streaks.tripCount||0)+1};setStreaks(nst);await save("wb-streaks-v3",nst);
    setTempDest("");showToast(`✈️ Travel mode — ${tempDest.trim()}`);
  }

  async function disableTravel(){
    setTravelMode(false);setTravelDest("");
    await save("wb-travel-mode",false);
    await save("wb-travel-dest","");
    showToast("🏠 Home mode restored");
  }

  async function logPractice(){
    const key=`s-${Date.now()}`;const nl={...practiceLogs,[key]:{instrument:activeInstr,at:new Date().toISOString()}};
    setPracticeLogs(nl);await save(`wb-prac-${weekKey()}`,nl);
    const nst={...streaks,practiceSessions:(streaks.practiceSessions||0)+1};setStreaks(nst);await save("wb-streaks-v3",nst);
    const nxp=totalXP+10;setTotalXP(nxp);await save("wb-totalxp",nxp);
    setXpFloat(10);setTimeout(()=>setXpFloat(null),1300);
    showToast(`🎸 ${activeInstr} logged +10 XP`);
  }

  async function addFriend(){
    if(!friendInput.name.trim())return;
    const e={id:`f-${Date.now()}`,name:friendInput.name.trim(),note:friendInput.note.trim(),date:new Date().toISOString()};
    const nl=[e,...friendLog];setFriendLog(nl);await save("wb-friends-v2",nl);
    const nst={...streaks,friendDinners:(streaks.friendDinners||0)+1};setStreaks(nst);await save("wb-streaks-v3",nst);
    const nxp=totalXP+15;setTotalXP(nxp);await save("wb-totalxp",nxp);
    setFriendInput({name:"",note:""});setShowFF(false);showToast(`👥 ${e.name} logged +15 XP`);
  }
  async function deleteFriend(id){const nl=friendLog.filter(f=>f.id!==id);setFriendLog(nl);await save("wb-friends-v2",nl);}
  async function saveFinancials(u){const nf={...financials,...u};setFinancials(nf);await save("wb-fin-v2",nf);}
  async function updateTrack(id,changes){const u=tracks.map(t=>t.id===id?{...t,...changes}:t);setTracks(u);await save("wb-tracks-v3",u);}

  async function toggleGoalDone(id){
    const g=goals.find(g=>g.id===id);const was=g.completed;
    const u=goals.map(g=>g.id===id?{...g,completed:!g.completed,progress:!was?100:g.progress}:g);
    setGoals(u);await save("wb-goals-v4",u);
    if(!was){const nxp=totalXP+100;setTotalXP(nxp);await save("wb-totalxp",nxp);showToast("🎯 Goal complete! +100 XP");}
  }
  function updateGoalProgress(id,progress){const u=goals.map(g=>g.id===id?{...g,progress}:g);setGoals(u);}
  async function saveGoalProgress(){await save("wb-goals-v4",goals);}
  async function updateGoalNote(id,notes){const u=goals.map(g=>g.id===id?{...g,notes}:g);setGoals(u);await save("wb-goals-v4",u);}

  async function addGoal(){
    if(!newGoal.title.trim())return;
    const g={...newGoal,id:`c-${Date.now()}`,progress:0};
    const u=[...goals,g];setGoals(u);await save("wb-goals-v4",u);
    setNewGoal({title:"",detail:"",domain:"family",target:""});setShowAGF(false);showToast("Goal added ✓");
  }

  async function getInsights(){
    setInsightLoad(true);
    const ctx=`Ben Webb Life OS — ${formatDate()}. Travel mode: ${travelMode?"YES — "+travelDest:"No"}. Daily: ${dailyPct}% | Weekly: ${weeklyPct}% | Monthly: ${monthlyPct}% | Annual: ${annualPct}%. Streak: ${streaks.current} days (best: ${streaks.longest}) | XP: ${totalXP}. Goals: ${goalsComplete}/${goals.length}. Domain — Family: ${domainProgress.family}%, Platform: ${domainProgress.platform}%, Financial: ${domainProgress.financial}%, Health: ${domainProgress.health}%. Music: ${wkSessions} sessions this week, album ${albumProgress}% complete. Friend connections: ${friendLog.length} this year. Trips: ${tripLog.length} this year. Debt reduction: ${debtPct}% | Savings: ${savPct}%. Ben is CMO at IJM, writing Recalibrated + The Sequence, building One Five One men's movement. Core thesis: "Really chasing the Lord means great sacrifice but great outcomes." Give 3 specific, direct coaching observations. Reference actual numbers. Max 180 words. Plain prose.`;
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:ctx}]})});
      const data=await r.json();
      setInsight(data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"Unable to generate insights.");
    }catch{setInsight("Unable to connect. Try again.");}
    setInsightLoad(false);
  }

  const levelInfo=getLevelInfo(totalXP);
  const filteredGoals=domainFilter==="all"?goals:goals.filter(g=>g.domain===domainFilter);


  function TodoList({todos, setTodos}) {
    const [input, setInput] = useState("");
    async function addTodo(){
      if(!input.trim())return;
      const updated=[...todos,{id:`t-${Date.now()}`,text:input.trim(),done:false}];
      setTodos(updated);await save("wb-todos-v1",updated);setInput("");
    }
    async function toggleTodo(id){
      const updated=todos.map(t=>t.id===id?{...t,done:!t.done}:t);
      setTodos(updated);await save("wb-todos-v1",updated);
    }
    async function deleteTodo(id){
      const updated=todos.filter(t=>t.id!==id);
      setTodos(updated);await save("wb-todos-v1",updated);
    }
    async function clearDone(){
      const updated=todos.filter(t=>!t.done);
      setTodos(updated);await save("wb-todos-v1",updated);
    }
    const doneCount=todos.filter(t=>t.done).length;
    return(
      <div style={{marginBottom:24}}>
        <div className="sec" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div><div className="sec-title">Today's Tasks</div>{doneCount>0&&<div className="sec-sub">{doneCount} of {todos.length} done</div>}</div>
          {doneCount>0&&<button onClick={clearDone} style={{background:"none",border:"none",fontSize:11,fontWeight:700,color:"#94A3B8",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Clear done</button>}
        </div>
        <div className="todo-input-row">
          <input className="todo-input" placeholder="Add a task…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()}/>
          <button className="todo-add-btn" onClick={addTodo}>+</button>
        </div>
        {todos.length>0&&(
          <div className="check-card">
            {todos.map(todo=>(
              <div key={todo.id} className="c-row">
                <div className={`todo-circle ${todo.done?"done":""}`} onClick={()=>toggleTodo(todo.id)}/>
                <div className="c-body" onClick={()=>toggleTodo(todo.id)} style={{cursor:"pointer"}}>
                  <div className="c-main" style={{color:todo.done?"#CBD5E1":"#0B1929",textDecoration:todo.done?"line-through":"none"}}>{todo.text}</div>
                </div>
                <button className="todo-del" onClick={()=>deleteTodo(todo.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function CheckGroup({items,state,type,travel=false}){
    return(
      <div className="check-card">
        {items.map((item,idx)=>{
          const val=state[item.id];const isDone=val?.checked;const isBouncing=bouncing===item.id;
          return(
            <div key={item.id} className="c-row animIn" style={{animationDelay:`${idx*0.04}s`}} onClick={()=>toggleCheck(type,item.id,item)}>
              <div className={`c-icon-bg ${isDone?(travel?"done-travel":"done"):""}`}>{item.icon}</div>
              <div className={`c-circle ${isDone?(travel?"done-travel":"done"):""} ${isBouncing?"bounce":""}`}/>
              <div className="c-body">
                <div className={`c-main ${isDone?"done":""}`}>{item.text}</div>
                <div className="c-hint">{item.sub}</div>
                {isDone&&<div className="c-ts">{new Date(val.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
              </div>
              <div className={`c-xp ${isDone?"done":travel?"travel":""}`}>{isDone?"✓":`+${item.xp}`}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if(loading) return(
    <>
      <style>{CSS}</style>
      <div className="loading">
        <div style={{fontSize:40}}>⚡</div>
        <div className="loading-title">Webb Life OS</div>
        <div className="loading-sub">Connecting to database…</div>
      </div>
    </>
  );

  return(
    <>
      <style>{CSS}</style>
      {showConfetti&&<Confetti/>}
      {xpFloat!==null&&<XPFloat amount={xpFloat} onDone={()=>setXpFloat(null)}/>}

      {showTM&&(
        <div className="modal-overlay" onClick={()=>setShowTM(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">✈️ Travel Mode</div>
            <div className="modal-sub">Where are you headed? Your checklist switches to travel-optimised mode.</div>
            <input className="modal-input" placeholder="e.g. Ghana, Mumbai, DC…" value={tempDest} onChange={e=>setTempDest(e.target.value)} onKeyDown={e=>e.key==="Enter"&&enableTravel()} autoFocus/>
            <button className="modal-btn" onClick={enableTravel}>Activate Travel Mode</button>
            <button className="modal-cancel" onClick={()=>setShowTM(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="app">
        {toast&&<div className="toast">{toast}</div>}

        <div className="hdr">
          <div className="hdr-inner">
            <div>
              <div className="hdr-eyebrow">{travelMode?`✈️ ${travelDest}`:"Webb Life OS"}</div>
              <div className="hdr-date">{formatDate()}</div>
            </div>
            <button className={`travel-toggle ${travelMode?"on":"off"}`} onClick={travelMode?disableTravel:()=>setShowTM(true)}>
              ✈️ {travelMode?"On the road":"Travel"}
            </button>
          </div>
        </div>

        <div className="scroll">

          {tab==="today"&&(
            <>
              <div className={travelMode?"hero-travel":"hero-home"} style={{marginTop:4}}>
                <div className="h-eyebrow">{travelMode?`✈️ ${travelDest}`:"Current Streak"}</div>
                <div className="h-streak-wrap">
                  <div className="h-streak-num">{animStreak}</div>
                  <div className="h-streak-right">
                    <span className={travelMode?"fire-travel h-fire":"h-fire"}>🔥</span>
                    <div className="h-best">Best: {streaks.longest}</div>
                  </div>
                </div>
                <div className="h-prog-row"><div className="h-prog-label">Today's progress</div><div className="h-prog-pct">{dailyPct}%</div></div>
                <div className="h-track"><div className={travelMode?"h-fill-travel":"h-fill-home"} style={{width:`${dailyPct}%`}}/></div>
                <div className="h-stats">
                  <div className="h-stat"><div className="h-stat-val">{totalXP}</div><div className="h-stat-lbl">XP</div></div>
                  <div className="h-stat"><div className="h-stat-val">{goalsComplete}</div><div className="h-stat-lbl">Goals</div></div>
                  <div className="h-stat"><div className="h-stat-val">{Object.values(curDaily).filter(v=>v?.checked).length}/{CL.daily.length}</div><div className="h-stat-lbl">Done</div></div>
                </div>
              </div>
              <div className="xp-card">
                <div className="xp-row"><div className="xp-level">Level {levelInfo.l} — {levelInfo.t}</div><div className="xp-pts">{totalXP} XP</div></div>
                <div className="xp-track"><div className="xp-fill" style={{width:`${levelInfo.progress}%`}}/></div>
              </div>
              {travelMode&&<div className="travel-badge"><span style={{fontSize:18}}>🗺️</span><div><div className="tb-dest">{travelDest}</div><div className="tb-sub">Travel checklist active</div></div></div>}
              {(()=>{const s=getDailyScripture();return(<div className="scripture-card"><div className="scripture-verse">{s.verse}</div><div className="scripture-ref">{s.ref}</div></div>);})()}
              <div className="prompt-card">
                <div className="prompt-icon">{travelMode?"🌍":"✨"}</div>
                <div className="prompt-body">
                  <div className="prompt-title">{travelMode?"Stay anchored on the road":"Start your day strong"}</div>
                  <div className="prompt-sub">{Object.values(curDaily).filter(v=>v?.checked).length} of {CL.daily.length} complete</div>
                </div>
                <div className="prompt-arrow">{dailyPct}%</div>
              </div>
              <div className="sec"><div className="sec-title">{travelMode?"Travel Daily":"Daily"}</div></div>
              <CheckGroup items={CL.daily} state={curDaily} type="daily" travel={travelMode}/>
              <TodoList todos={todos} setTodos={setTodos}/>
            </>
          )}

          {tab==="rhythms"&&(
            <>
              <div className="r-tabs" style={{marginTop:8}}>
                {[["weekly",travelMode?"Travel Week":"Weekly"],["monthly","Monthly"],["annual","Annual"]].map(([k,l])=>(
                  <button key={k} className={`r-tab ${rhythmTab===k?(travelMode?"travel-active":"active"):""}`} onClick={()=>setRhythmTab(k)}>{l}</button>
                ))}
              </div>
              {rhythmTab==="weekly"&&(
                <>
                  <div className="prompt-card">
                    <div className="prompt-icon">{travelMode?"✈️":"📅"}</div>
                    <div className="prompt-body">
                      <div className="prompt-title">{travelMode?"This week on the road":"This week's focus"}</div>
                      <div className="prompt-sub">{Object.values(curWeekly).filter(v=>v?.checked).length} of {CL.weekly.length} complete · {weeklyPct}%</div>
                    </div>
                    <div className="prompt-arrow">{weeklyPct}%</div>
                  </div>
                  <CheckGroup items={CL.weekly} state={curWeekly} type="weekly" travel={travelMode}/>
                  {!travelMode&&(
                    <>
                      <div className="ijm-header"><div className="ijm-dot"/><div><div className="ijm-title">IJM Leadership</div><div className="ijm-sub">Strategic + platform layer</div></div></div>
                      <div className="ijm-card"><CheckGroup items={CHECKLIST_HOME.ijm} state={ijm} type="ijm"/></div>
                    </>
                  )}
                </>
              )}
              {rhythmTab==="monthly"&&(
                <>
                  <div className="prompt-card">
                    <div className="prompt-icon">🗓️</div>
                    <div className="prompt-body">
                      <div className="prompt-title">This month's rhythm</div>
                      <div className="prompt-sub">{Object.values(monthly).filter(v=>v?.checked).length} of {CHECKLIST_HOME.monthly.length} complete</div>
                    </div>
                    <div className="prompt-arrow">{monthlyPct}%</div>
                  </div>
                  <div className="prompt-card" onClick={()=>setShowFF(true)}>
                    <div className="prompt-icon">👥</div>
                    <div className="prompt-body"><div className="prompt-title">Log a connection</div><div className="prompt-sub">{friendLog.length} logged this year</div></div>
                    <div className="prompt-arrow">+</div>
                  </div>
                  {showFF&&(
                    <div className="add-form">
                      <div className="add-title">Who did you connect with?</div>
                      <input className="field" placeholder="Friend's name…" value={friendInput.name} onChange={e=>setFriendInput(p=>({...p,name:e.target.value}))}/>
                      <input className="field" placeholder="What did you do?" value={friendInput.note} onChange={e=>setFriendInput(p=>({...p,note:e.target.value}))}/>
                      <div className="btn-row"><button className="btn-s" onClick={()=>setShowFF(false)}>Cancel</button><button className="btn-p" onClick={addFriend}>Log it</button></div>
                    </div>
                  )}
                  <CheckGroup items={CHECKLIST_HOME.monthly} state={monthly} type="monthly"/>
                </>
              )}
              {rhythmTab==="annual"&&(
                <>
                  <div style={{background:"linear-gradient(135deg,#064E3B,#059669,#34D399)",borderRadius:24,padding:22,marginBottom:12,position:"relative",overflow:"hidden"}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>{new Date().getFullYear()} Annual</div>
                    <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:2}}>Health & Foundations</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>{annualPct}% complete</div>
                  </div>
                  <CheckGroup items={CHECKLIST_HOME.annual} state={annual} type="annual"/>
                </>
              )}
            </>
          )}

          {tab==="music"&&(
            <>
              <div className="music-hero" style={{marginTop:4}}>
                <div className="mh-lbl">The Album</div>
                <div className="mh-title">Untitled Record</div>
                <div className="mh-sub">10 songs · 12 months</div>
                <div className="mh-stats">
                  <div className="mh-stat"><div className="mh-val">{completedTracks}</div><div className="mh-lbl2">Done</div><div className="mh-acc">of 10</div></div>
                  <div className="mh-stat"><div className="mh-val">{wkSessions}</div><div className="mh-lbl2">Sessions</div><div className="mh-acc">this week</div></div>
                  <div className="mh-stat"><div className="mh-val">{summerDaysLeft()}</div><div className="mh-lbl2">Days</div><div className="mh-acc">to summer</div></div>
                </div>
              </div>
              <div className="album-card">
                <div className="album-top">
                  <div><div className="album-title">Album Progress</div><div className="album-sub">Track 01 target: this summer</div></div>
                  <div className="countdown"><div className="cd-num">{summerDaysLeft()}</div><div className="cd-lbl">days left</div></div>
                </div>
                <div className="album-bar"><div className="album-fill" style={{width:`${albumProgress}%`}}/></div>
                <div className="album-footer"><div className="album-footer-lbl">Overall</div><div className="album-footer-val">{albumProgress}%</div></div>
              </div>
              <div className="sec"><div className="sec-title">Practice</div><div className="sec-sub">Target: 3 sessions per week</div></div>
              <div className="prac-grid">
                {[0,1,2].map(i=>{
                  const skeys=Object.keys(practiceLogs);const logged=i<skeys.length;const instr=logged?practiceLogs[skeys[i]]?.instrument:"";
                  return(
                    <div key={i} className={`prac-card ${logged?"logged":""}`} onClick={!logged?logPractice:undefined}>
                      <div className={`prac-num ${logged?"logged":""}`}>{i+1}</div>
                      <div className={`prac-lbl ${logged?"logged":""}`}>{logged?"Done":"Tap"}</div>
                      <div className={`prac-instr ${logged?"logged":""}`}>{logged?instr:"to log"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="check-card" style={{marginBottom:13}}>
                <div className="instr-row">{INSTRUMENTS.map(ins=><button key={ins} className={`instr-btn ${activeInstr===ins?"sel":""}`} onClick={()=>setActiveInstr(ins)}>{ins}</button>)}</div>
                <div className="tog-row">
                  <div><div className="tog-lbl">Church roster this week</div><div className="tog-sub">{churchRoster?"Covered ✓":"Requires discipline"}</div></div>
                  <button className={`tog ${churchRoster?"on":""}`} onClick={async()=>{const nc=!churchRoster;setChurchRoster(nc);await save(`wb-church-${weekKey()}`,nc);}}/>
                </div>
              </div>
              <div className="sec"><div className="sec-title">Tracks</div><div className="sec-sub">Tap title to edit</div></div>
              {tracks.map((t,i)=>{
                const pct=STAGE_PCT[t.stage]||0;const isEdit=editTrack===t.id;
                return(
                  <div key={t.id} className={`track-card ${t.priority?"priority":""}`}>
                    <div className="track-hdr">
                      <div className="track-num">{String(i+1).padStart(2,"0")}</div>
                      {isEdit?<input className="track-title-input" value={t.title} autoFocus onChange={e=>updateTrack(t.id,{title:e.target.value})} onBlur={()=>setEditTrack(null)} onKeyDown={e=>e.key==="Enter"&&setEditTrack(null)}/>
                        :<div className="track-title" onClick={()=>setEditTrack(t.id)}>{t.title}</div>}
                      {t.priority&&<span style={{fontSize:13}}>⭐</span>}
                      <select className={`stage-sel ${t.stage==="Complete"?"complete":""}`} value={t.stage} onChange={e=>updateTrack(t.id,{stage:e.target.value})}>
                        {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="track-bar"><div className="track-fill" style={{width:`${pct}%`}}/></div>
                    <textarea className="track-note" rows={1} placeholder="Notes…" value={t.notes||""} onChange={e=>updateTrack(t.id,{notes:e.target.value})}/>
                  </div>
                );
              })}
            </>
          )}

          {tab==="progress"&&(
            <>
              <div className="sec" style={{marginTop:4}}><div className="sec-title">By Domain</div></div>
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
                  <div className="fin-lbl">Debt Reduction</div>
                  <div className="fin-val" style={{color:"#059669"}}>{debtPct}%</div>
                  <div className="fin-bar"><div className="fin-fill" style={{width:`${debtPct}%`,background:"linear-gradient(90deg,#059669,#34D399)"}}/></div>
                  <div className="fin-sub">${(financials.debtStart-financials.debtCurrent).toLocaleString()} reduced</div>
                </div>
                <div className="fin-card">
                  <div className="fin-lbl">Savings</div>
                  <div className="fin-val" style={{color:"#2563EB"}}>{savPct}%</div>
                  <div className="fin-bar"><div className="fin-fill" style={{width:`${savPct}%`,background:"linear-gradient(90deg,#2563EB,#60A5FA)"}}/></div>
                  <div className="fin-sub">${financials.savingsCurrent.toLocaleString()} of ${financials.savingsTarget.toLocaleString()}</div>
                </div>
              </div>
              {!showFinForm&&<div className="prompt-card" onClick={()=>setShowFinForm(true)}><div className="prompt-icon">✏️</div><div className="prompt-body"><div className="prompt-title">Update numbers</div><div className="prompt-sub">Debt, savings, targets</div></div><div className="prompt-arrow">›</div></div>}
              {showFinForm&&(
                <div className="fin-edit">
                  <div className="fin-edit-title">Update Financials<button className="fin-close" onClick={()=>setShowFinForm(false)}>Done</button></div>
                  <div className="fin-row">
                    <div className="fin-fw"><div className="fin-fl">Debt Start</div><input className="fin-fi" type="number" value={financials.debtStart} onChange={e=>saveFinancials({debtStart:Number(e.target.value)})}/></div>
                    <div className="fin-fw"><div className="fin-fl">Debt Now</div><input className="fin-fi" type="number" value={financials.debtCurrent} onChange={e=>saveFinancials({debtCurrent:Number(e.target.value)})}/></div>
                  </div>
                  <div className="fin-row">
                    <div className="fin-fw"><div className="fin-fl">Savings Target</div><input className="fin-fi" type="number" value={financials.savingsTarget} onChange={e=>saveFinancials({savingsTarget:Number(e.target.value)})}/></div>
                    <div className="fin-fw"><div className="fin-fl">Savings Now</div><input className="fin-fi" type="number" value={financials.savingsCurrent} onChange={e=>saveFinancials({savingsCurrent:Number(e.target.value)})}/></div>
                  </div>
                </div>
              )}
              <div className="sec"><div className="sec-title">Connections</div><div className="sec-sub">{friendLog.length} this year</div></div>
              <div className="prompt-card" onClick={()=>setShowFF(true)}><div className="prompt-icon">👥</div><div className="prompt-body"><div className="prompt-title">Log a connection</div><div className="prompt-sub">Running tally across the year</div></div><div className="prompt-arrow">+</div></div>
              {showFF&&(
                <div className="add-form">
                  <div className="add-title">Who did you connect with?</div>
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
                      <div style={{flex:1}}><div className="friend-name">{f.name}</div>{f.note&&<div className="friend-note">{f.note}</div>}<div className="friend-date">{formatShort(f.date)}</div></div>
                      <button className="friend-del" onClick={()=>deleteFriend(f.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {tripLog.length>0&&(
                <>
                  <div className="sec"><div className="sec-title">Trip Log</div><div className="sec-sub">{tripLog.length} trips this year</div></div>
                  <div className="trip-card">
                    {tripLog.map(t=>(
                      <div key={t.id} className="trip-row">
                        <span style={{fontSize:22}}>✈️</span>
                        <div style={{flex:1}}><div className="trip-dest">{t.dest}</div><div className="trip-date">{formatShort(t.start)}</div></div>
                        <div className="trip-badge">IJM</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="sec"><div className="sec-title">Stats</div></div>
              <div className="stat-card">
                {[["Streak",`${streaks.current} days`],["Best Streak",`${streaks.longest} days`],["Days Complete",`${streaks.totalDaysComplete||0}`],["Sabbaths Honored",`${streaks.sabbathCount||0}`],["Practice Sessions",`${streaks.practiceSessions||0}`],["Album Progress",`${albumProgress}%`],["Trips This Year",`${tripLog.length}`],["Goals Done",`${goalsComplete}/${goals.length}`],["Total XP",`${totalXP}`]].map(([l,v])=>(
                  <div key={l} className="s-row"><div className="s-lbl">{l}</div><div className="s-val">{v}</div></div>
                ))}
              </div>
              <div className="sec"><div className="sec-title">Achievements</div></div>
              <div className="ach-grid">
                {ACHIEVEMENTS.map(a=>(
                  <div key={a.id} className={`ach-card ${unlockedAch[a.id]?"unlocked":""}`}>
                    <div className="ach-icon">{a.icon}</div>
                    <div className="ach-name">{a.title}</div>
                  </div>
                ))}
              </div>
              <div className="sec"><div className="sec-title">Goals</div></div>
              <div className="chips">
                {[["all","All"],["family","Family"],["platform","Platform"],["financial","Financial"],["health","Health"]].map(([k,l])=>(
                  <button key={k} className={`chip ${domainFilter===k?"active":""}`} style={{"--cc":k==="all"?"#2563EB":DOMAIN_CFG[k]?.color}} onClick={()=>setDomFilter(k)}>{l}</button>
                ))}
              </div>
              {filteredGoals.map(g=>{
                const dc=DOMAIN_CFG[g.domain];
                return(
                  <div key={g.id} className={`g-card ${g.completed?"complete":""}`}>
                    <div className="g-hdr"><div className="g-dot" style={{background:dc.color}}/><div className="g-title">{g.title}</div><button className={`g-done ${g.completed?"done":""}`} onClick={()=>toggleGoalDone(g.id)}>✓</button></div>
                    <div className="g-detail">{g.detail}</div>
                    <div className="g-tag" style={{background:`${dc.color}18`,color:dc.color}}>Target: {g.target}</div>
                    {!g.completed&&(
                      <>
                        <div className="g-prog-row"><div className="g-prog-track"><div className="g-prog-fill" style={{width:`${g.progress}%`,background:dc.color}}/></div><div className="g-prog-pct">{g.progress}%</div></div>
                        <input type="range" className="g-slider" min={0} max={100} value={g.progress} onChange={e=>updateGoalProgress(g.id,parseInt(e.target.value))} onMouseUp={saveGoalProgress} onTouchEnd={saveGoalProgress}/>
                        <textarea className="g-note" rows={2} placeholder="Add a note…" value={g.notes||""} onChange={e=>updateGoalNote(g.id,e.target.value)}/>
                      </>
                    )}
                  </div>
                );
              })}
              {showAddGoalForm&&(
                <div className="add-form">
                  <div className="add-title">New Goal</div>
                  <input className="field" placeholder="Goal title…" value={newGoal.title} onChange={e=>setNewGoal(p=>({...p,title:e.target.value}))}/>
                  <input className="field" placeholder="Details…" value={newGoal.detail} onChange={e=>setNewGoal(p=>({...p,detail:e.target.value}))}/>
                  <input className="field" placeholder="Target…" value={newGoal.target} onChange={e=>setNewGoal(p=>({...p,target:e.target.value}))}/>
                  <select className="field" value={newGoal.domain} onChange={e=>setNewGoal(p=>({...p,domain:e.target.value}))}>
                    {Object.entries(DOMAIN_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div className="btn-row"><button className="btn-s" onClick={()=>setShowAGF(false)}>Cancel</button><button className="btn-p" onClick={addGoal}>Add Goal</button></div>
                </div>
              )}
              <button className="fab" onClick={()=>setShowAGF(p=>!p)}>{showAddGoalForm?"×":"+"}</button>
            </>
          )}

          {tab==="insights"&&(
            <>
              <div className="quote-hero" style={{marginTop:4}}>
                <div className="q-lbl">Core Thesis</div>
                <div className="q-text">"Really chasing the Lord means great sacrifice but great outcomes — encouraging others to dream and live a life less ordinary."</div>
                <div className="q-attr">Ben Webb</div>
              </div>
              <div className="sec"><div className="sec-title">AI Coach</div></div>
              <div className="insight-card">
                {insightText?<div className="i-body">{insightText}</div>:<div className="i-placeholder">Personalised coaching based on your live data — streaks, goals, music, financial tracking, travel, and where you're slipping.</div>}
                {insightLoad&&<div style={{textAlign:"center",padding:"14px 0",color:"#94A3B8",fontSize:14}}>Analysing your data…</div>}
              </div>
              <button className="coach-btn" disabled={insightLoad} onClick={getInsights}>{insightLoad?"Thinking…":insightText?"Refresh Coaching":"Get Coaching Insights"}</button>
              <div className="sec"><div className="sec-title">The Five Tenets</div></div>
              <div className="vision-card">
                {[["Stewardship","Care for what God entrusted: health, family, finances, talent, platform."],["Service","Act humbly. IJM. Family presence. Platform for others."],["Scale","Build and multiply. Legacy for children. Platform that outlasts the role."],["Sweat","Work hard. God-honoring things face natural resistance."],["Sabbath","Three Sundays per month minimum. Rest in sovereignty."]].map(([n,d])=>(
                  <div className="tenet-row" key={n}><div className="tenet-s">S</div><div><div className="tenet-name">{n}</div><div className="tenet-desc">{d}</div></div></div>
                ))}
              </div>
              <div className="sec"><div className="sec-title">Vision at 55</div></div>
              {[{t:"Family",b:"Annie's path built on depth. River's ceiling limited only by talent. Parents cared for. Jules and the kids have seen the world with you."},{t:"Platform",b:"Recalibrated and The Sequence published. One Five One moving. A body of work that opens doors."},{t:"Marriage",b:"Jules is the primary relationship. December 2, 2026 — the 20th anniversary — is a milestone, not a calendar entry."},{t:"Music",b:"An album completed. Songs that carry the same conviction as the books."}].map(v=>(
                <div key={v.t} className="vision-card"><div className="v-title">{v.t}</div><div className="v-body">{v.b}</div></div>
              ))}
            </>
          )}
        </div>

        <div className="bottom-nav">
          {[{id:"today",icon:"☑️",lbl:"Today"},{id:"rhythms",icon:"🔄",lbl:"Rhythms"},{id:"music",icon:"🎸",lbl:"Music"},{id:"progress",icon:"📈",lbl:"Progress"},{id:"insights",icon:"💡",lbl:"Insights"}].map(n=>(
            <button key={n.id} className={`nav-btn ${tab===n.id?"active":""} ${tab===n.id&&travelMode?"travel":""}`} onClick={()=>setTab(n.id)}>
              <div className="nav-icon">{n.icon}</div>
              <div className="nav-lbl">{n.lbl}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
