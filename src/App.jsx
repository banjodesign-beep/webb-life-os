import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase, dbGet, dbSet } from './supabase.js'

const LOGO_URL = 'https://assets.football-logos.cc/logos/tournaments/1500x1500/fifa-world-cup-2026.31d2489d.png'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--blue:#002868;--red:#BF0A30;--gold:#E8A900;--blue-lt:#E8EEFF;--gold-lt:#FFFBEA;--bg:#F6F8FD;--card:#fff;--border:#D6E0F5;--text:#0A0F2A;--muted:#5B6688;--green:#16a34a;--green-lt:#EAFBF0;--amber:#D97706}
body{background:var(--bg);font-family:'Barlow',sans-serif;color:var(--text);}

/* SPLASH */
.splash{position:fixed;inset:0;z-index:999;background:linear-gradient(135deg,var(--blue),#001030 50%,#3A0010);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;transition:opacity .5s;}
.splash.out{opacity:0;pointer-events:none;}
.confetti-p{position:absolute;border-radius:2px;animation:fall linear infinite;}
@keyframes fall{0%{transform:translateY(-30px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
.sp-ball{font-size:72px;animation:spbounce .65s ease-in-out infinite alternate;margin-bottom:10px;filter:drop-shadow(0 12px 20px rgba(0,0,0,.5));}
@keyframes spbounce{from{transform:translateY(0) rotate(-10deg)}to{transform:translateY(-48px) rotate(20deg)}}
.sp-eye{font-family:'Barlow Condensed';font-size:12px;letter-spacing:.45em;color:rgba(255,255,255,.5);text-transform:uppercase;margin-bottom:5px;animation:sup .6s .2s both;}
.sp-title{font-family:'Bebas Neue';font-size:clamp(50px,12vw,96px);line-height:.92;text-align:center;color:#fff;text-shadow:5px 5px 0 rgba(0,0,0,.3);animation:sup .6s .4s both;}
.sp-title b{color:var(--gold);}
.sp-logo{width:84px;height:84px;object-fit:contain;margin:16px 0 12px;animation:spop .5s .85s both;filter:drop-shadow(0 4px 14px rgba(0,0,0,.4));}
@keyframes spop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
.sp-crew{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;animation:sup .6s 1.05s both;}
.sp-pill{font-family:'Barlow Condensed';font-size:13px;letter-spacing:.15em;color:rgba(255,255,255,.85);padding:4px 13px;border:1px solid rgba(255,255,255,.3);border-radius:20px;background:rgba(255,255,255,.1);text-transform:uppercase;}
.sp-hint{position:absolute;bottom:26px;font-family:'Barlow Condensed';font-size:12px;letter-spacing:.25em;color:rgba(255,255,255,.4);text-transform:uppercase;animation:sblink 1.6s 1.5s ease infinite;}
@keyframes sup{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes sblink{0%,100%{opacity:.3}50%{opacity:.85}}

/* GOAL CELEBRATION */
.goal-overlay{position:fixed;inset:0;z-index:998;background:rgba(0,40,104,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:gfade 1.8s forwards;}
@keyframes gfade{0%{opacity:0}15%{opacity:1}75%{opacity:1}100%{opacity:0;pointer-events:none}}
.goal-ball-anim{font-size:80px;animation:gball 1.8s forwards;}
@keyframes gball{0%{transform:translateX(-100vw) rotate(0deg)}40%{transform:translateX(0) rotate(360deg)}70%{transform:translateX(0) rotate(360deg) scale(1.2)}100%{transform:translateX(100vw) rotate(720deg)}}
.goal-txt{font-family:'Bebas Neue';font-size:clamp(60px,15vw,120px);color:var(--gold);text-shadow:4px 4px 0 rgba(0,0,0,.4);animation:gpop .3s .4s both;}
@keyframes gpop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
.goal-sub{font-family:'Barlow Condensed';font-size:20px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#fff;margin-top:8px;animation:gpop .3s .6s both;}

.ball-roll{position:fixed;bottom:56px;left:-50px;font-size:30px;z-index:997;pointer-events:none;animation:broll .55s ease-in forwards;}
@keyframes broll{from{left:-50px;transform:rotate(0deg)}to{left:110vw;transform:rotate(720deg)}}

.confetti-leader{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:12px;}
.cl-piece{position:absolute;top:-10px;border-radius:2px;animation:clfall linear infinite;}
@keyframes clfall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(220px) rotate(720deg);opacity:0}}

/* HEADER */
.hdr{background:#fff;border-bottom:4px solid var(--blue);padding:14px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 14px rgba(0,40,104,.1);position:sticky;top:0;z-index:50;}
.hdr-logo{width:46px;height:46px;object-fit:contain;flex-shrink:0;}
.hdr-t{font-family:'Bebas Neue';font-size:clamp(17px,4.6vw,28px);line-height:1;color:var(--blue);letter-spacing:1px;}
.hdr-t em{color:var(--red);font-style:normal;}
.hdr-s{font-family:'Barlow Condensed';font-size:10px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-top:3px;}
.live-badge{display:flex;align-items:center;gap:4px;font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--green);padding:3px 9px;border:1px solid var(--green);border-radius:12px;margin-left:auto;flex-shrink:0;}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:ldot 1.5s ease infinite;}
@keyframes ldot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}

/* TABS */
.tabs{display:flex;background:#fff;border-bottom:3px solid var(--border);position:sticky;top:74px;z-index:40;overflow-x:auto;}
.tbtn{flex:1;min-width:80px;padding:13px 6px;font-family:'Bebas Neue';font-size:16px;letter-spacing:1px;border:none;cursor:pointer;background:transparent;color:var(--muted);transition:all .18s;white-space:nowrap;}
.tbtn.on{color:var(--blue);border-bottom:3px solid var(--blue);margin-bottom:-3px;background:var(--blue-lt);}
.tbtn:hover:not(.on){color:var(--blue);background:#F0F4FF;}

.subtabs{display:flex;gap:8px;margin-bottom:20px;}
.substab{padding:9px 18px;font-family:'Barlow Condensed';font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:2px solid var(--border);background:#fff;color:var(--muted);cursor:pointer;border-radius:24px;transition:all .15s;}
.substab.on{background:var(--blue);color:#fff;border-color:var(--blue);}

/* USER MODAL */
.umodal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
.umodal{background:#fff;border-radius:18px;padding:32px 26px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3);}
.um-title{font-family:'Bebas Neue';font-size:34px;color:var(--blue);margin-bottom:6px;}
.um-sub{font-family:'Barlow Condensed';font-size:13px;color:var(--muted);letter-spacing:.05em;margin-bottom:22px;}
.um-presets{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;}
.um-preset{padding:9px 16px;font-family:'Barlow Condensed';font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:2px solid var(--border);background:#fff;color:var(--muted);cursor:pointer;border-radius:8px;transition:all .15s;}
.um-preset:hover{border-color:var(--blue);color:var(--blue);}
.um-preset.on{background:var(--blue);color:#fff;border-color:var(--blue);}
.um-or{text-align:center;font-family:'Barlow Condensed';font-size:11px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin:14px 0;}
.um-input{width:100%;font-family:'Barlow Condensed';font-size:16px;font-weight:700;border:2px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);margin-bottom:18px;}
.um-input:focus{border-color:var(--blue);outline:none;}
.um-btn{width:100%;padding:15px;font-family:'Bebas Neue';font-size:22px;letter-spacing:1px;background:var(--blue);color:#fff;border:none;border-radius:10px;cursor:pointer;transition:background .15s;}
.um-btn:hover{background:#001a4d;}
.um-btn:disabled{background:var(--border);color:var(--muted);cursor:not-allowed;}

/* STREAM GUIDE */
.stream-guide{background:var(--blue);color:#fff;padding:16px 18px;}
.sg-title{font-family:'Bebas Neue';font-size:17px;letter-spacing:1px;margin-bottom:12px;color:var(--gold);}
.sg-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.sg-col-title{font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:8px;}
.sg-item{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
.sg-badge{font-family:'Barlow Condensed';font-size:10px;font-weight:700;padding:3px 7px;border-radius:4px;white-space:nowrap;}
.sg-badge.free{background:var(--green);color:#fff;}
.sg-badge.cable{background:rgba(255,255,255,.2);color:#fff;}
.sg-badge.stream{background:var(--gold);color:var(--text);}
.sg-desc{font-family:'Barlow Condensed';font-size:11px;color:rgba(255,255,255,.7);}

/* SCHEDULE */
.sched{padding:20px 16px;max-width:960px;margin:0 auto;}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px;padding:12px 16px;background:#fff;border-radius:10px;border:1.5px solid var(--border);}
.leg-item{display:flex;align-items:center;gap:6px;font-family:'Barlow Condensed';font-size:11px;font-weight:700;}
.leg-dot{width:11px;height:11px;border-radius:2px;display:inline-block;flex-shrink:0;}
.fbar{display:flex;flex-direction:column;gap:10px;margin-bottom:20px;}
.frow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.flbl{font-family:'Barlow Condensed';font-size:10px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;min-width:48px;}
.fbtn{padding:6px 11px;border-radius:4px;cursor:pointer;font-family:'Barlow Condensed';font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;border:1.5px solid var(--border);background:#fff;color:var(--muted);transition:all .13s;}
.fbtn.on{background:var(--blue);color:#fff;border-color:var(--blue);}
.fbtn:hover:not(.on){border-color:var(--blue);color:var(--blue);}
.dh{font-family:'Barlow Condensed';font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:6px;margin:22px 0 12px;}
.gc{background:#fff;border-radius:10px;border:1.5px solid var(--border);border-left:5px solid var(--border);padding:14px 16px;margin-bottom:10px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;box-shadow:0 1px 5px rgba(0,40,104,.05);transition:transform .1s,box-shadow .1s;}
.gc:hover{transform:translateY(-1px);box-shadow:0 3px 12px rgba(0,40,104,.1);}
.gc.usa{border-left:5px solid var(--red);background:linear-gradient(to right,#FFF5F5,#F5F5FF);border-color:rgba(191,10,48,.2);}
.gc.feat{border-left:5px solid var(--gold);background:var(--gold-lt);border-color:rgba(232,169,0,.25);}
.gc.ko{border-left-color:var(--blue);}
.gc.fin{border-left:5px solid var(--gold);background:linear-gradient(to right,#FFFBEA,#FFF5F5);}
.gc.done{opacity:.88;}
.gbadge{width:36px;height:36px;border-radius:9px;font-family:'Bebas Neue';font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--blue);color:#fff;}
.gbadge.usa-b{background:linear-gradient(135deg,var(--red),var(--blue));font-size:12px;}
.gbadge.feat-b{background:var(--gold);color:var(--text);font-size:12px;}
.gbadge.ko-b{background:var(--blue);font-size:12px;}
.gbadge.fin-b{background:var(--gold);color:var(--text);}
.minfo{min-width:0;}
.usa-banner{display:inline-flex;align-items:center;gap:4px;font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;border-radius:4px;margin-bottom:5px;background:linear-gradient(90deg,var(--red),var(--blue));color:#fff;}
.feat-banner{display:inline-flex;align-items:center;gap:4px;font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:4px;margin-bottom:5px;background:var(--gold);color:var(--text);}
.ft-banner{display:inline-flex;align-items:center;gap:4px;font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;border-radius:4px;margin-bottom:5px;background:var(--green);color:#fff;}
.mteams{font-family:'Barlow Condensed';font-weight:700;font-size:clamp(13px,3.5vw,17px);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mteams .vs{color:var(--muted);font-weight:400;margin:0 5px;}
.mteams .score{color:var(--blue);font-weight:800;}
.mmeta{font-size:10px;color:var(--muted);margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 10px;font-family:'Barlow Condensed';}
.mtime{font-weight:700;color:var(--blue);}
.cright{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;}
.sbadge{font-family:'Barlow Condensed';font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;background:var(--blue);color:#fff;white-space:nowrap;}
.sbadge.fs1{background:var(--red);}
.sbadge.free{background:var(--green);}
.sbadge-es{font-family:'Barlow Condensed';font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(0,40,104,.08);color:var(--blue);white-space:nowrap;}
.hlbl{font-size:9px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px;text-align:right;}
.hsel{font-family:'Barlow Condensed';font-size:11px;font-weight:600;border:1.5px solid var(--border);background:#fff;color:var(--text);border-radius:5px;padding:5px 7px;cursor:pointer;min-width:100px;}
.hsel.set{border-color:var(--blue);background:var(--blue-lt);color:var(--blue);}

/* BRACKET */
.brk{padding:20px 16px;max-width:960px;margin:0 auto;}
.you-banner{background:var(--blue-lt);border:1.5px solid var(--blue);border-radius:10px;padding:10px 16px;margin-bottom:18px;font-family:'Barlow Condensed';font-size:13px;font-weight:700;color:var(--blue);}
.rtabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;}
.rtab{padding:7px 13px;font-family:'Barlow Condensed';font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid var(--border);background:#fff;color:var(--muted);cursor:pointer;border-radius:5px;transition:all .14s;}
.rtab.on{background:var(--blue);color:#fff;border-color:var(--blue);}
.secttitle{font-family:'Bebas Neue';font-size:23px;letter-spacing:1px;color:var(--blue);margin-bottom:16px;display:flex;align-items:center;gap:10px;}
.secttitle::after{content:'';flex:1;height:2px;background:var(--border);}
.statsbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;padding:16px 18px;background:#fff;border-radius:10px;border:1.5px solid var(--border);}
.stat{text-align:center;flex:1;min-width:60px;}
.statnum{font-family:'Bebas Neue';font-size:30px;color:var(--blue);}
.statlbl{font-family:'Barlow Condensed';font-size:9px;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;}
.champbox{text-align:center;padding:22px;margin-bottom:20px;background:linear-gradient(135deg,var(--blue),#001030);border-radius:12px;color:#fff;}
.ctrophy{font-size:34px;margin-bottom:6px;}
.clbl{font-family:'Barlow Condensed';font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:4px;}
.cname{font-family:'Bebas Neue';font-size:36px;color:var(--gold);}

.ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;}
.gcard{background:#fff;border-radius:10px;border:1.5px solid var(--border);overflow:hidden;box-shadow:0 1px 5px rgba(0,40,104,.06);}
.gcardh{background:var(--blue);color:#fff;padding:9px 14px;font-family:'Bebas Neue';font-size:17px;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center;}
.greset{font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,.4);color:rgba(255,255,255,.8);background:transparent;cursor:pointer;padding:3px 8px;border-radius:4px;}
.gteam{display:flex;align-items:center;gap:9px;padding:11px 14px;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--border);}
.gteam:last-child{border-bottom:none;}
.gteam:hover{background:var(--blue-lt);}
.gteam.f1{background:#EBF2FF;}
.gteam.f2{background:var(--gold-lt);}
.gteam.out{opacity:.5;}
.grnk{width:23px;height:23px;border-radius:50%;flex-shrink:0;font-family:'Bebas Neue';font-size:13px;display:flex;align-items:center;justify-content:center;}
.grnk.r1{background:var(--blue);color:#fff;}
.grnk.r2{background:var(--gold);color:var(--text);}
.grnk.empty{background:var(--border);color:var(--muted);font-size:10px;}
.grnk.out{background:#eee;color:#ccc;}
.gtnm{font-family:'Barlow Condensed';font-size:13px;font-weight:700;flex:1;}
.gteam.out .gtnm{text-decoration:line-through;color:#aaa;}
.gadv{padding:7px 12px;background:#EBF2FF;font-family:'Barlow Condensed';font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);}

.kogrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;}
.kocard{background:#fff;border-radius:14px;border:1.5px solid var(--border);overflow:hidden;box-shadow:0 2px 10px rgba(0,40,104,.08);}
.koh{background:var(--blue);color:#fff;padding:9px 16px;font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;}
.ko-teams{padding:6px 0 0;}
.ko-team-btn{width:100%;padding:16px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;background:transparent;border:none;text-align:left;transition:background .12s;border-bottom:1px solid var(--border);}
.ko-team-btn:last-of-type{border-bottom:none;}
.ko-team-btn:hover{background:var(--blue-lt);}
.ko-team-btn.picked{background:#EBF2FF;}
.ko-team-btn.picked .ko-tname{color:var(--blue);font-weight:800;}
.ko-flag{font-size:24px;flex-shrink:0;}
.ko-tname{font-family:'Barlow Condensed';font-size:16px;font-weight:700;flex:1;color:var(--text);}
.ko-tname.tbd{color:var(--muted);font-style:italic;font-weight:400;font-size:13px;}
.ko-radio{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .12s;}
.ko-radio.on{background:var(--blue);border-color:var(--blue);}
.ko-radio.on::after{content:'';width:8px;height:8px;background:#fff;border-radius:50%;}
.adv-tag{font-family:'Barlow Condensed';font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:4px;background:var(--blue);color:#fff;}
.score-section{padding:12px 16px 16px;border-top:1px solid var(--border);background:#FAFBFF;}
.score-lbl{font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
.score-inputs{display:flex;align-items:center;gap:10px;}
.score-num{width:54px;font-family:'Bebas Neue';font-size:22px;text-align:center;border:2px solid var(--border);border-radius:7px;padding:5px;color:var(--text);background:#fff;}
.score-num:focus{border-color:var(--blue);outline:none;}
.score-dash{font-family:'Bebas Neue';font-size:20px;color:var(--muted);}
.pick-hint{font-size:10px;font-family:'Barlow Condensed';color:var(--muted);margin-top:6px;letter-spacing:.05em;}

.rules-card{background:linear-gradient(135deg,var(--blue),#001a4d);border-radius:12px;padding:18px;margin-bottom:20px;color:#fff;}
.rules-title{font-family:'Bebas Neue';font-size:20px;letter-spacing:1px;color:var(--gold);margin-bottom:12px;}
.rules-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.rule-item{background:rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;}
.rule-pts{font-family:'Bebas Neue';font-size:22px;color:var(--gold);}
.rule-desc{font-family:'Barlow Condensed';font-size:11px;color:rgba(255,255,255,.75);letter-spacing:.05em;}
.rule-caveat{font-family:'Barlow Condensed';font-size:10px;color:rgba(255,255,255,.45);margin-top:10px;letter-spacing:.03em;}

/* STANDINGS */
.stnd{padding:20px 16px;max-width:960px;margin:0 auto;}
.leaderboard{display:flex;flex-direction:column;gap:12px;margin-bottom:28px;}
.lb-card{background:#fff;border-radius:12px;border:1.5px solid var(--border);padding:16px 18px;display:flex;align-items:center;gap:16px;box-shadow:0 1px 5px rgba(0,40,104,.06);position:relative;overflow:hidden;transition:transform .1s;}
.lb-card:hover{transform:translateY(-1px);}
.lb-card.first{border-color:var(--gold);background:linear-gradient(to right,#FFFBEA,#fff);}
.lb-rank{font-family:'Bebas Neue';font-size:28px;color:var(--muted);width:38px;text-align:center;flex-shrink:0;}
.lb-avatar{width:44px;height:44px;border-radius:50%;background:var(--blue);color:#fff;font-family:'Bebas Neue';font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.lb-avatar.gold{background:linear-gradient(135deg,var(--gold),#c47d00);}
.lb-name{font-family:'Barlow Condensed';font-size:18px;font-weight:800;flex:1;color:var(--text);}
.lb-pts{text-align:right;}
.lb-pts-num{font-family:'Bebas Neue';font-size:34px;color:var(--blue);}
.lb-pts-lbl{font-family:'Barlow Condensed';font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);}
.lb-detail{font-family:'Barlow Condensed';font-size:11px;color:var(--muted);margin-top:3px;}
.lb-crown{font-size:20px;position:absolute;top:12px;right:16px;}

.results-section{background:#fff;border-radius:12px;border:1.5px solid var(--border);padding:20px;margin-bottom:20px;}
.rs-title{font-family:'Bebas Neue';font-size:19px;color:var(--blue);letter-spacing:1px;margin-bottom:5px;}
.rs-sub{font-family:'Barlow Condensed';font-size:11px;color:var(--muted);margin-bottom:18px;letter-spacing:.05em;}
.rs-form{display:flex;flex-direction:column;gap:14px;}
.rs-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;}
.rs-field{display:flex;flex-direction:column;gap:5px;flex:1;min-width:140px;}
.rs-field label{font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}
.rs-select{font-family:'Barlow Condensed';font-size:13px;font-weight:600;border:1.5px solid var(--border);background:#fff;color:var(--text);border-radius:7px;padding:8px 10px;cursor:pointer;}
.rs-select:focus{border-color:var(--blue);outline:none;}
.rs-input{width:64px;font-family:'Bebas Neue';font-size:20px;text-align:center;border:1.5px solid var(--border);border-radius:7px;padding:6px;}
.rs-input:focus{border-color:var(--blue);outline:none;}
.rs-dash{font-family:'Bebas Neue';font-size:20px;color:var(--muted);padding-bottom:6px;}
.rs-btn{padding:10px 20px;font-family:'Barlow Condensed';font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:var(--blue);color:#fff;border:none;border-radius:7px;cursor:pointer;}
.rs-btn:hover{background:#001a4d;}
.rs-btn:disabled{background:var(--border);color:var(--muted);cursor:not-allowed;}
.rs-success{font-family:'Barlow Condensed';font-size:12px;font-weight:700;color:var(--green);letter-spacing:.1em;}
.no-results-note{text-align:center;padding:24px;font-family:'Barlow Condensed';font-size:13px;color:var(--muted);letter-spacing:.05em;background:#FAFBFF;border-radius:10px;margin-bottom:20px;line-height:1.6;}
.crew-compare{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;}
.ccrd{flex:1 1 120px;border-radius:8px;padding:12px;text-align:center;border:2px solid var(--border);background:#fff;}
.ccrd.me{border-color:var(--blue);background:var(--blue-lt);}
.ccn{font-family:'Barlow Condensed';font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;}
.ccp{font-family:'Bebas Neue';font-size:18px;color:var(--blue);}
.hint{font-family:'Barlow Condensed';font-size:11px;color:var(--muted);margin-bottom:16px;line-height:1.5;}
.loading{display:flex;align-items:center;justify-content:center;padding:60px;font-family:'Barlow Condensed';font-size:16px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;gap:10px;}

/* GROUP STANDINGS / PROBABILITY */
.grp-standings-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px;}
.gs-card{background:#fff;border-radius:12px;border:1.5px solid var(--border);overflow:hidden;box-shadow:0 1px 5px rgba(0,40,104,.06);}
.gs-head{background:var(--blue);color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;}
.gs-head-title{font-family:'Bebas Neue';font-size:18px;letter-spacing:1px;}
.gs-head-status{font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6);}
.gs-table{width:100%;border-collapse:collapse;font-family:'Barlow Condensed';}
.gs-table th{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:center;padding:8px 4px;border-bottom:1.5px solid var(--border);}
.gs-table th:first-child{text-align:left;padding-left:14px;}
.gs-table td{font-size:12px;text-align:center;padding:8px 4px;border-bottom:1px solid #F0F4FA;}
.gs-table td:first-child{text-align:left;padding-left:14px;font-weight:700;}
.gs-table tr.qualified td:first-child{border-left:3px solid var(--green);}
.gs-table tr.qualified{background:var(--green-lt);}
.gs-pts{font-weight:800;color:var(--blue);}
.prob-section{padding:12px 16px 16px;}
.prob-row{margin-bottom:12px;}
.prob-row:last-child{margin-bottom:0;}
.prob-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
.prob-team{font-family:'Barlow Condensed';font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;}
.prob-pct{font-family:'Bebas Neue';font-size:18px;}
.prob-bar-track{height:8px;background:#EEF2FA;border-radius:4px;overflow:hidden;}
.prob-bar-fill{height:100%;border-radius:4px;transition:width .6s ease;}
.prob-status{font-family:'Barlow Condensed';font-size:10px;color:var(--muted);margin-top:4px;letter-spacing:.03em;}
.prob-status.q{color:var(--green);font-weight:700;}
.prob-status.e{color:var(--red);font-weight:700;}

/* NEWS */
.news{padding:20px 16px;max-width:760px;margin:0 auto;}
.news-note{font-family:'Barlow Condensed';font-size:11px;color:var(--muted);margin-bottom:20px;letter-spacing:.03em;line-height:1.5;background:#fff;border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;}
.news-card{display:block;background:#fff;border-radius:12px;border:1.5px solid var(--border);padding:18px 20px;margin-bottom:14px;text-decoration:none;color:inherit;transition:transform .1s,box-shadow .1s;box-shadow:0 1px 5px rgba(0,40,104,.05);}
.news-card:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,40,104,.12);border-color:var(--blue);}
.news-source{font-family:'Barlow Condensed';font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--blue);margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.news-title{font-family:'Barlow Condensed';font-size:17px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:6px;}
.news-desc{font-family:'Barlow';font-size:13px;color:var(--muted);line-height:1.5;}
.news-more{display:block;text-align:center;padding:14px;font-family:'Barlow Condensed';font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);background:var(--blue-lt);border-radius:10px;text-decoration:none;margin-top:8px;}

select:focus,input:focus{outline:none;}
`

/* ─── FLAGS ─── */
const FLAGS = {
  'USA':'🇺🇸','Mexico':'🇲🇽','Canada':'🇨🇦','Brazil':'🇧🇷','Argentina':'🇦🇷',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','France':'🇫🇷','Germany':'🇩🇪','Spain':'🇪🇸','Netherlands':'🇳🇱',
  'Portugal':'🇵🇹','Belgium':'🇧🇪','Australia':'🇦🇺','Japan':'🇯🇵','South Korea':'🇰🇷',
  'Morocco':'🇲🇦','Senegal':'🇸🇳','Ghana':'🇬🇭','Ivory Coast':'🇨🇮','Egypt':'🇪🇬',
  'South Africa':'🇿🇦','Uruguay':'🇺🇾','Colombia':'🇨🇴','Ecuador':'🇪🇨','Paraguay':'🇵🇾',
  'Switzerland':'🇨🇭','Croatia':'🇭🇷','Sweden':'🇸🇪','Denmark':'🇩🇰','Norway':'🇳🇴',
  'Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Saudi Arabia':'🇸🇦','Iran':'🇮🇷','Qatar':'🇶🇦','Türkiye':'🇹🇷',
  'Tunisia':'🇹🇳','Algeria':'🇩🇿','Jordan':'🇯🇴','Iraq':'🇮🇶','Austria':'🇦🇹',
  'Haiti':'🇭🇹','Panama':'🇵🇦','DR Congo':'🇨🇩','Uzbekistan':'🇺🇿','New Zealand':'🇳🇿',
  'Cape Verde':'🇨🇻','Bosnia & Herz.':'🇧🇦','Curaçao':'🇨🇼','Czechia':'🇨🇿',
}
const flag = t => FLAGS[t] || '🏳️'

/* ─── DATA ─── */
const INIT_USERS = ['Ben','Marcus','CJ','Praveen','Steve']
const GROUP_TEAMS = {
  A:['Mexico','South Africa','South Korea','Czechia'],
  B:['Canada','Bosnia & Herz.','Qatar','Switzerland'],
  C:['Brazil','Morocco','Haiti','Scotland'],
  D:['USA','Paraguay','Australia','Türkiye'],
  E:['Germany','Curaçao','Ivory Coast','Ecuador'],
  F:['Netherlands','Japan','Sweden','Tunisia'],
  G:['Belgium','Egypt','Iran','New Zealand'],
  H:['Spain','Cape Verde','Saudi Arabia','Uruguay'],
  I:['France','Senegal','Iraq','Norway'],
  J:['Argentina','Algeria','Austria','Jordan'],
  K:['Portugal','DR Congo','Uzbekistan','Colombia'],
  L:['England','Croatia','Ghana','Panama'],
}
const ALL_TEAMS = ['',...Object.values(GROUP_TEAMS).flat().sort()]
const FEAT = ['England','Australia','Argentina']
const GROUPS_LIST = 'ABCDEFGHIJKL'.split('')
const STAGES = ['Group Stage','Round of 32','Round of 16','Quarterfinal','Semifinal','Final']
const ROUND_ORDER = ['groups','r32','r16','qf','sf','final']
const ROUND_COUNTS = {r32:16,r16:8,qf:4,sf:2,final:1}
const ROUND_LABELS = {r32:'Round of 32',r16:'Round of 16',qf:'Quarterfinals',sf:'Semifinals',final:'🏆 The Final'}
const SCORE_PTS = {r32:{w:2,e:4},r16:{w:3,e:5},qf:{w:4,e:6},sf:{w:5,e:7},final:{w:6,e:8}}
const roundIdxToScheduleId = (round,idx) => {
  if(round==='r32')return 73+idx
  if(round==='r16')return 89+idx
  if(round==='qf')return 97+idx
  if(round==='sf')return 101+idx
  if(round==='final')return 104
  return null
}

const R32S = [
  {id:0,s1:'R-up A',s2:'R-up B'},{id:1,s1:'Winner C',s2:'R-up F'},
  {id:2,s1:'Winner E',s2:'Best 3rd'},{id:3,s1:'Winner F',s2:'R-up C'},
  {id:4,s1:'R-up E',s2:'R-up I'},{id:5,s1:'Winner I',s2:'Best 3rd'},
  {id:6,s1:'Winner A',s2:'Best 3rd'},{id:7,s1:'Winner L',s2:'Best 3rd'},
  {id:8,s1:'Winner G',s2:'Best 3rd'},{id:9,s1:'Winner D',s2:'Best 3rd'},
  {id:10,s1:'Winner H',s2:'R-up J'},{id:11,s1:'R-up K',s2:'R-up L'},
  {id:12,s1:'Winner B',s2:'Best 3rd'},{id:13,s1:'R-up D',s2:'R-up G'},
  {id:14,s1:'Winner J',s2:'R-up H'},{id:15,s1:'Winner K',s2:'Best 3rd'},
]

const SCHEDULE = [
  {id:1,date:'Thu, Jun 11',time:'1:00 PM',grp:'A',stage:'Group Stage',home:'Mexico',away:'South Africa',venue:'Estadio Azteca, Mexico City',stream:'FOX',es:'Telemundo',tubi:true,note:'🎉 Tournament opener'},
  {id:2,date:'Thu, Jun 11',time:'8:00 PM',grp:'A',stage:'Group Stage',home:'South Korea',away:'Czechia',venue:'Estadio Akron, Guadalajara',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:3,date:'Fri, Jun 12',time:'1:00 PM',grp:'B',stage:'Group Stage',home:'Canada',away:'Bosnia & Herz.',venue:'BMO Field, Toronto',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:4,date:'Fri, Jun 12',time:'7:00 PM',grp:'D',stage:'Group Stage',home:'USA',away:'Paraguay',venue:'SoFi Stadium, Los Angeles',stream:'FOX',es:'Telemundo',tubi:true,note:''},
  {id:5,date:'Sat, Jun 13',time:'1:00 PM',grp:'B',stage:'Group Stage',home:'Qatar',away:'Switzerland',venue:"Levi's Stadium, Santa Clara",stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:6,date:'Sat, Jun 13',time:'4:00 PM',grp:'C',stage:'Group Stage',home:'Brazil',away:'Morocco',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:7,date:'Sat, Jun 13',time:'7:00 PM',grp:'C',stage:'Group Stage',home:'Haiti',away:'Scotland',venue:'Gillette Stadium, Foxborough',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:8,date:'Sun, Jun 14',time:'10:00 AM',grp:'D',stage:'Group Stage',home:'Australia',away:'Türkiye',venue:'BC Place, Vancouver',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:9,date:'Sun, Jun 14',time:'11:00 AM',grp:'E',stage:'Group Stage',home:'Germany',away:'Curaçao',venue:'NRG Stadium, Houston',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:10,date:'Sun, Jun 14',time:'2:00 PM',grp:'F',stage:'Group Stage',home:'Netherlands',away:'Japan',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:11,date:'Sun, Jun 14',time:'5:00 PM',grp:'E',stage:'Group Stage',home:'Ivory Coast',away:'Ecuador',venue:'Lincoln Financial, Philadelphia',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:12,date:'Sun, Jun 14',time:'8:00 PM',grp:'F',stage:'Group Stage',home:'Sweden',away:'Tunisia',venue:'Estadio BBVA, Monterrey',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:13,date:'Mon, Jun 15',time:'10:00 AM',grp:'H',stage:'Group Stage',home:'Spain',away:'Cape Verde',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:14,date:'Mon, Jun 15',time:'1:00 PM',grp:'G',stage:'Group Stage',home:'Belgium',away:'Egypt',venue:'Lumen Field, Seattle',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:15,date:'Mon, Jun 15',time:'4:00 PM',grp:'H',stage:'Group Stage',home:'Saudi Arabia',away:'Uruguay',venue:'Hard Rock Stadium, Miami',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:16,date:'Mon, Jun 15',time:'7:00 PM',grp:'G',stage:'Group Stage',home:'Iran',away:'New Zealand',venue:'SoFi Stadium, Los Angeles',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:17,date:'Tue, Jun 16',time:'1:00 PM',grp:'I',stage:'Group Stage',home:'France',away:'Senegal',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:18,date:'Tue, Jun 16',time:'4:00 PM',grp:'I',stage:'Group Stage',home:'Iraq',away:'Norway',venue:'Gillette Stadium, Foxborough',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:19,date:'Tue, Jun 16',time:'7:00 PM',grp:'J',stage:'Group Stage',home:'Argentina',away:'Algeria',venue:'Arrowhead Stadium, Kansas City',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:20,date:'Tue, Jun 16',time:'10:00 PM',grp:'J',stage:'Group Stage',home:'Austria',away:'Jordan',venue:"Levi's Stadium, Santa Clara",stream:'FS1',es:'Telemundo',tubi:false,note:'Late kick'},
  {id:21,date:'Wed, Jun 17',time:'11:00 AM',grp:'K',stage:'Group Stage',home:'Portugal',away:'DR Congo',venue:'NRG Stadium, Houston',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:22,date:'Wed, Jun 17',time:'2:00 PM',grp:'L',stage:'Group Stage',home:'England',away:'Croatia',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:23,date:'Wed, Jun 17',time:'5:00 PM',grp:'L',stage:'Group Stage',home:'Ghana',away:'Panama',venue:'BMO Field, Toronto',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:24,date:'Wed, Jun 17',time:'8:00 PM',grp:'K',stage:'Group Stage',home:'Uzbekistan',away:'Colombia',venue:'Estadio Azteca, Mexico City',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:25,date:'Thu, Jun 18',time:'10:00 AM',grp:'A',stage:'Group Stage',home:'Czechia',away:'South Africa',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:26,date:'Thu, Jun 18',time:'1:00 PM',grp:'B',stage:'Group Stage',home:'Switzerland',away:'Bosnia & Herz.',venue:'SoFi Stadium, Los Angeles',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:27,date:'Thu, Jun 18',time:'4:00 PM',grp:'B',stage:'Group Stage',home:'Canada',away:'Qatar',venue:'BC Place, Vancouver',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:28,date:'Thu, Jun 18',time:'7:00 PM',grp:'A',stage:'Group Stage',home:'Mexico',away:'South Korea',venue:'Estadio Akron, Guadalajara',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:29,date:'Fri, Jun 19',time:'1:00 PM',grp:'D',stage:'Group Stage',home:'USA',away:'Australia',venue:'Lumen Field, Seattle',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:30,date:'Fri, Jun 19',time:'4:00 PM',grp:'C',stage:'Group Stage',home:'Scotland',away:'Morocco',venue:'Gillette Stadium, Foxborough',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:31,date:'Fri, Jun 19',time:'6:30 PM',grp:'C',stage:'Group Stage',home:'Brazil',away:'Haiti',venue:'Lincoln Financial, Philadelphia',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:32,date:'Fri, Jun 19',time:'9:00 PM',grp:'D',stage:'Group Stage',home:'Türkiye',away:'Paraguay',venue:"Levi's Stadium, Santa Clara",stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:33,date:'Sat, Jun 20',time:'11:00 AM',grp:'F',stage:'Group Stage',home:'Netherlands',away:'Sweden',venue:'NRG Stadium, Houston',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:34,date:'Sat, Jun 20',time:'2:00 PM',grp:'E',stage:'Group Stage',home:'Germany',away:'Ivory Coast',venue:'BMO Field, Toronto',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:35,date:'Sat, Jun 20',time:'6:00 PM',grp:'E',stage:'Group Stage',home:'Ecuador',away:'Curaçao',venue:'Arrowhead Stadium, Kansas City',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:36,date:'Sat, Jun 20',time:'10:00 PM',grp:'F',stage:'Group Stage',home:'Tunisia',away:'Japan',venue:'Estadio BBVA, Monterrey',stream:'FS1',es:'Telemundo',tubi:false,note:'Late kick'},
  {id:37,date:'Sun, Jun 21',time:'10:00 AM',grp:'H',stage:'Group Stage',home:'Spain',away:'Saudi Arabia',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:38,date:'Sun, Jun 21',time:'1:00 PM',grp:'G',stage:'Group Stage',home:'Belgium',away:'Iran',venue:'SoFi Stadium, Los Angeles',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:39,date:'Sun, Jun 21',time:'4:00 PM',grp:'H',stage:'Group Stage',home:'Uruguay',away:'Cape Verde',venue:'Hard Rock Stadium, Miami',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:40,date:'Sun, Jun 21',time:'7:00 PM',grp:'G',stage:'Group Stage',home:'New Zealand',away:'Egypt',venue:'BC Place, Vancouver',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:41,date:'Mon, Jun 22',time:'11:00 AM',grp:'J',stage:'Group Stage',home:'Argentina',away:'Austria',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:42,date:'Mon, Jun 22',time:'3:00 PM',grp:'I',stage:'Group Stage',home:'France',away:'Iraq',venue:'Lincoln Financial, Philadelphia',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:43,date:'Mon, Jun 22',time:'6:00 PM',grp:'I',stage:'Group Stage',home:'Norway',away:'Senegal',venue:'MetLife Stadium, E. Rutherford',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:44,date:'Mon, Jun 22',time:'9:00 PM',grp:'J',stage:'Group Stage',home:'Jordan',away:'Algeria',venue:"Levi's Stadium, Santa Clara",stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:45,date:'Tue, Jun 23',time:'11:00 AM',grp:'K',stage:'Group Stage',home:'Portugal',away:'Uzbekistan',venue:'NRG Stadium, Houston',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:46,date:'Tue, Jun 23',time:'2:00 PM',grp:'L',stage:'Group Stage',home:'England',away:'Ghana',venue:'Gillette Stadium, Foxborough',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:47,date:'Tue, Jun 23',time:'5:00 PM',grp:'L',stage:'Group Stage',home:'Panama',away:'Croatia',venue:'BMO Field, Toronto',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:48,date:'Tue, Jun 23',time:'8:00 PM',grp:'K',stage:'Group Stage',home:'Colombia',away:'DR Congo',venue:'Estadio Akron, Guadalajara',stream:'FS1',es:'Telemundo',tubi:false,note:''},
  {id:49,date:'Wed, Jun 24',time:'1:00 PM',grp:'B',stage:'Group Stage',home:'Switzerland',away:'Canada',venue:'BC Place, Vancouver',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:50,date:'Wed, Jun 24',time:'1:00 PM',grp:'B',stage:'Group Stage',home:'Bosnia & Herz.',away:'Qatar',venue:'Lumen Field, Seattle',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:51,date:'Wed, Jun 24',time:'4:00 PM',grp:'C',stage:'Group Stage',home:'Scotland',away:'Brazil',venue:'Hard Rock Stadium, Miami',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:52,date:'Wed, Jun 24',time:'4:00 PM',grp:'C',stage:'Group Stage',home:'Morocco',away:'Haiti',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:53,date:'Wed, Jun 24',time:'7:00 PM',grp:'A',stage:'Group Stage',home:'Czechia',away:'Mexico',venue:'Estadio Azteca, Mexico City',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:54,date:'Wed, Jun 24',time:'7:00 PM',grp:'A',stage:'Group Stage',home:'South Africa',away:'South Korea',venue:'Estadio BBVA, Monterrey',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:55,date:'Thu, Jun 25',time:'2:00 PM',grp:'E',stage:'Group Stage',home:'Curaçao',away:'Ivory Coast',venue:'Lincoln Financial, Philadelphia',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:56,date:'Thu, Jun 25',time:'2:00 PM',grp:'E',stage:'Group Stage',home:'Ecuador',away:'Germany',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:57,date:'Thu, Jun 25',time:'5:00 PM',grp:'F',stage:'Group Stage',home:'Japan',away:'Sweden',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:58,date:'Thu, Jun 25',time:'5:00 PM',grp:'F',stage:'Group Stage',home:'Tunisia',away:'Netherlands',venue:'Arrowhead Stadium, Kansas City',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:59,date:'Thu, Jun 25',time:'8:00 PM',grp:'D',stage:'Group Stage',home:'Türkiye',away:'USA',venue:'SoFi Stadium, Los Angeles',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:60,date:'Thu, Jun 25',time:'8:00 PM',grp:'D',stage:'Group Stage',home:'Paraguay',away:'Australia',venue:"Levi's Stadium, Santa Clara",stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:61,date:'Fri, Jun 26',time:'1:00 PM',grp:'I',stage:'Group Stage',home:'Norway',away:'France',venue:'Gillette Stadium, Foxborough',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:62,date:'Fri, Jun 26',time:'1:00 PM',grp:'I',stage:'Group Stage',home:'Senegal',away:'Iraq',venue:'BMO Field, Toronto',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:63,date:'Fri, Jun 26',time:'6:00 PM',grp:'H',stage:'Group Stage',home:'Cape Verde',away:'Saudi Arabia',venue:'NRG Stadium, Houston',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:64,date:'Fri, Jun 26',time:'6:00 PM',grp:'H',stage:'Group Stage',home:'Uruguay',away:'Spain',venue:'Estadio Akron, Guadalajara',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:65,date:'Fri, Jun 26',time:'9:00 PM',grp:'G',stage:'Group Stage',home:'Egypt',away:'Iran',venue:'Lumen Field, Seattle',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:66,date:'Fri, Jun 26',time:'9:00 PM',grp:'G',stage:'Group Stage',home:'New Zealand',away:'Belgium',venue:'BC Place, Vancouver',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:67,date:'Sat, Jun 27',time:'3:00 PM',grp:'L',stage:'Group Stage',home:'Panama',away:'England',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:68,date:'Sat, Jun 27',time:'3:00 PM',grp:'L',stage:'Group Stage',home:'Croatia',away:'Ghana',venue:'Lincoln Financial, Philadelphia',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:69,date:'Sat, Jun 27',time:'5:30 PM',grp:'K',stage:'Group Stage',home:'Colombia',away:'Portugal',venue:'Hard Rock Stadium, Miami',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:70,date:'Sat, Jun 27',time:'5:30 PM',grp:'K',stage:'Group Stage',home:'DR Congo',away:'Uzbekistan',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:71,date:'Sat, Jun 27',time:'8:00 PM',grp:'J',stage:'Group Stage',home:'Algeria',away:'Austria',venue:'Arrowhead Stadium, Kansas City',stream:'FS1',es:'Universo',tubi:false,note:'Concurrent'},
  {id:72,date:'Sat, Jun 27',time:'8:00 PM',grp:'J',stage:'Group Stage',home:'Jordan',away:'Argentina',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:'Concurrent'},
  {id:73,date:'Sun, Jun 28',time:'1:00 PM',grp:'',stage:'Round of 32',home:'R-up A',away:'R-up B',venue:'SoFi Stadium, Los Angeles',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:74,date:'Mon, Jun 29',time:'11:00 AM',grp:'',stage:'Round of 32',home:'Winner C',away:'R-up F',venue:'NRG Stadium, Houston',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:75,date:'Mon, Jun 29',time:'2:30 PM',grp:'',stage:'Round of 32',home:'Winner E',away:'Best 3rd',venue:'Gillette Stadium, Foxborough',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:76,date:'Mon, Jun 29',time:'7:00 PM',grp:'',stage:'Round of 32',home:'Winner F',away:'R-up C',venue:'Estadio BBVA, Monterrey',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:77,date:'Tue, Jun 30',time:'11:00 AM',grp:'',stage:'Round of 32',home:'R-up E',away:'R-up I',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:78,date:'Tue, Jun 30',time:'3:00 PM',grp:'',stage:'Round of 32',home:'Winner I',away:'Best 3rd',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:79,date:'Tue, Jun 30',time:'7:00 PM',grp:'',stage:'Round of 32',home:'Winner A',away:'Best 3rd',venue:'Estadio Azteca, Mexico City',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:80,date:'Wed, Jul 1',time:'10:00 AM',grp:'',stage:'Round of 32',home:'Winner L',away:'Best 3rd',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:81,date:'Wed, Jul 1',time:'2:00 PM',grp:'',stage:'Round of 32',home:'Winner G',away:'Best 3rd',venue:'Lumen Field, Seattle',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:82,date:'Wed, Jul 1',time:'6:00 PM',grp:'',stage:'Round of 32',home:'Winner D',away:'Best 3rd',venue:"Levi's Stadium, Santa Clara",stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:83,date:'Thu, Jul 2',time:'1:00 PM',grp:'',stage:'Round of 32',home:'Winner H',away:'R-up J',venue:'SoFi Stadium, Los Angeles',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:84,date:'Thu, Jul 2',time:'5:00 PM',grp:'',stage:'Round of 32',home:'R-up K',away:'R-up L',venue:'BMO Field, Toronto',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:85,date:'Thu, Jul 2',time:'9:00 PM',grp:'',stage:'Round of 32',home:'Winner B',away:'Best 3rd',venue:'BC Place, Vancouver',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:86,date:'Fri, Jul 3',time:'12:00 PM',grp:'',stage:'Round of 32',home:'R-up D',away:'R-up G',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:87,date:'Fri, Jul 3',time:'4:00 PM',grp:'',stage:'Round of 32',home:'Winner J',away:'R-up H',venue:'Hard Rock Stadium, Miami',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:88,date:'Fri, Jul 3',time:'7:30 PM',grp:'',stage:'Round of 32',home:'Winner K',away:'Best 3rd',venue:'Arrowhead Stadium, Kansas City',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:89,date:'Sat, Jul 4',time:'11:00 AM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'NRG Stadium, Houston',stream:'FOX',es:'Telemundo',tubi:false,note:'🇺🇸 4th of July!'},
  {id:90,date:'Sat, Jul 4',time:'3:00 PM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'Lincoln Financial, Philadelphia',stream:'FOX',es:'Telemundo',tubi:false,note:'🇺🇸 4th of July!'},
  {id:91,date:'Sun, Jul 5',time:'2:00 PM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:92,date:'Sun, Jul 5',time:'6:00 PM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'Estadio Azteca, Mexico City',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:93,date:'Mon, Jul 6',time:'1:00 PM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:94,date:'Mon, Jul 6',time:'6:00 PM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'Lumen Field, Seattle',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:95,date:'Tue, Jul 7',time:'10:00 AM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:96,date:'Tue, Jul 7',time:'2:00 PM',grp:'',stage:'Round of 16',home:'TBD',away:'TBD',venue:'BC Place, Vancouver',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:97,date:'Thu, Jul 9',time:'2:00 PM',grp:'',stage:'Quarterfinal',home:'TBD',away:'TBD',venue:'Gillette Stadium, Foxborough',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:98,date:'Fri, Jul 10',time:'1:00 PM',grp:'',stage:'Quarterfinal',home:'TBD',away:'TBD',venue:'SoFi Stadium, Los Angeles',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:99,date:'Sat, Jul 11',time:'3:00 PM',grp:'',stage:'Quarterfinal',home:'TBD',away:'TBD',venue:'Hard Rock Stadium, Miami',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:100,date:'Sat, Jul 11',time:'7:00 PM',grp:'',stage:'Quarterfinal',home:'TBD',away:'TBD',venue:'Arrowhead Stadium, Kansas City',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:101,date:'Tue, Jul 14',time:'1:00 PM',grp:'',stage:'Semifinal',home:'TBD',away:'TBD',venue:'AT&T Stadium, Arlington',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:102,date:'Wed, Jul 15',time:'1:00 PM',grp:'',stage:'Semifinal',home:'TBD',away:'TBD',venue:'Mercedes-Benz Stadium, Atlanta',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:103,date:'Sat, Jul 18',time:'3:00 PM',grp:'',stage:'3rd Place',home:'TBD',away:'TBD',venue:'Hard Rock Stadium, Miami',stream:'FOX',es:'Telemundo',tubi:false,note:''},
  {id:104,date:'Sun, Jul 19',time:'1:00 PM',grp:'',stage:'Final',home:'TBD',away:'TBD',venue:'MetLife Stadium, E. Rutherford',stream:'FOX',es:'Telemundo',tubi:false,note:'🏆 THE WORLD CUP FINAL'},
]

const NEWS_ITEMS = [
  {source:'ESPN',title:'World Cup 2026 Live Updates: Day-by-Day Tracker',desc:"Rolling live blog covering every match day — results, big moments, and storylines as they happen.",url:'https://www.espn.com/soccer/story/_/id/49123861/world-cup-2026-today-blog-20-06-2026-live-updates-news-fixtures-schedule-results-scotland-morocco-brazil'},
  {source:'NBC News',title:'USMNT Through to the Round of 32',desc:"The Americans improved to 2-0-0 with a win over Australia, and fans are starting to believe in this squad.",url:'https://www.nbcnews.com/sports/world-cup'},
  {source:'FOX Sports',title:'Knockout-Round Scenarios: What Every Team Needs',desc:"A breakdown of standings and clinching scenarios for the Round of 32 across all 12 groups.",url:'https://www.foxsports.com/soccer/fifa-world-cup/news'},
  {source:'Al Jazeera',title:'World Cup 2026 Daily Coverage Hub',desc:"Match previews, team news, and broader stories from around the tournament.",url:'https://www.aljazeera.com/fifa-world-cup-2026/'},
  {source:'FIFA.com',title:'Official Match Reports & Team Profiles',desc:"Official recaps, player features, and team-by-team World Cup history from FIFA.",url:'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/news'},
  {source:'Yahoo Sports',title:'Day-by-Day Schedule & Scores Tracker',desc:"A running schedule with scores and live updates as the group stage unfolds.",url:'https://sports.yahoo.com/soccer/live/world-cup-2026-scores-results-schedule-live-updates-135432982.html'},
]

/* ─── HELPERS ─── */
const isUSA = g => g.home==='USA'||g.away==='USA'
const isFeat = g => !isUSA(g)&&FEAT.some(t=>g.home===t||g.away===t)
const isFin = g => g.stage==='Final'
const isKO = g => ['Round of 32','Round of 16','Quarterfinal','Semifinal','3rd Place'].includes(g.stage)
const isDesc = t => t&&(t.startsWith('Winner')||t.startsWith('R-up')||t.startsWith('Best'))
function byDate(games){const m={};games.forEach(g=>{if(!m[g.date])m[g.date]=[];m[g.date].push(g)});return m}
const CC=['#BF0A30','#002868','#FFD700','#fff','#FF6B6B','#4ECDC4']

function computeGroupTable(grp, matchResults){
  const teams=GROUP_TEAMS[grp]
  const stats={}
  teams.forEach(t=>stats[t]={team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0})
  SCHEDULE.filter(g=>g.grp===grp).forEach(g=>{
    const r=matchResults[g.id]
    if(!r||!r.final)return
    const hs=r.homeScore,as=r.awayScore
    const H=stats[g.home],A=stats[g.away]
    if(!H||!A)return
    H.p++;A.p++;H.gf+=hs;H.ga+=as;A.gf+=as;A.ga+=hs
    if(hs>as){H.w++;H.pts+=3;A.l++}
    else if(hs<as){A.w++;A.pts+=3;H.l++}
    else{H.d++;A.d++;H.pts++;A.pts++}
  })
  return teams.map(t=>stats[t]).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)
}
function isGroupComplete(grp,matchResults){
  return SCHEDULE.filter(g=>g.grp===grp).every(g=>matchResults[g.id]&&matchResults[g.id].final)
}
function simulateGroup(grp,matchResults,overrides={},iterations=1200){
  const teams=GROUP_TEAMS[grp]
  const groupGames=SCHEDULE.filter(g=>g.grp===grp)
  const base={}
  teams.forEach(t=>base[t]={pts:0,gf:0,ga:0})
  const remaining=[]
  groupGames.forEach(g=>{
    const r=matchResults[g.id]
    if(r&&r.final){
      base[g.home].gf+=r.homeScore;base[g.home].ga+=r.awayScore
      base[g.away].gf+=r.awayScore;base[g.away].ga+=r.homeScore
      if(r.homeScore>r.awayScore)base[g.home].pts+=3
      else if(r.homeScore<r.awayScore)base[g.away].pts+=3
      else{base[g.home].pts++;base[g.away].pts++}
    }else remaining.push(g)
  })
  if(remaining.length===0){
    const table=computeGroupTable(grp,matchResults)
    const out={};table.forEach((t,i)=>out[t.team]=i<2?100:0)
    return out
  }
  const strength={}
  teams.forEach(t=>{strength[t]=base[t].pts*3+(base[t].gf-base[t].ga)})
  const advanceCount={};teams.forEach(t=>advanceCount[t]=0)
  for(let iter=0;iter<iterations;iter++){
    const sim={};teams.forEach(t=>sim[t]={pts:base[t].pts,gf:base[t].gf,ga:base[t].ga})
    remaining.forEach(g=>{
      let forced=overrides[g.id]
      let hs,as
      if(forced==='home'){hs=Math.floor(Math.random()*2)+1;as=Math.floor(Math.random()*2)}
      else if(forced==='away'){as=Math.floor(Math.random()*2)+1;hs=Math.floor(Math.random()*2)}
      else{
        const diff=strength[g.home]-strength[g.away]
        let pH=0.40+Math.max(-0.22,Math.min(0.22,diff*0.025))
        let pD=0.26
        let pA=1-pH-pD
        if(pA<0.1){pA=0.1;pH=1-pD-pA}
        const r=Math.random()
        if(r<pH){hs=Math.floor(Math.random()*2)+1;as=Math.floor(Math.random()*2)}
        else if(r<pH+pD){const s=Math.floor(Math.random()*3);hs=s;as=s}
        else{as=Math.floor(Math.random()*2)+1;hs=Math.floor(Math.random()*2)}
      }
      sim[g.home].gf+=hs;sim[g.home].ga+=as;sim[g.away].gf+=as;sim[g.away].ga+=hs
      if(hs>as)sim[g.home].pts+=3
      else if(hs<as)sim[g.away].pts+=3
      else{sim[g.home].pts++;sim[g.away].pts++}
    })
    const ranked=teams.slice().sort((a,b)=>{
      const A=sim[a],B=sim[b]
      if(B.pts!==A.pts)return B.pts-A.pts
      const gdA=A.gf-A.ga,gdB=B.gf-B.ga
      if(gdB!==gdA)return gdB-gdA
      return B.gf-A.gf
    })
    advanceCount[ranked[0]]++;advanceCount[ranked[1]]++
  }
  const out={}
  teams.forEach(t=>out[t]=Math.round((advanceCount[t]/iterations)*100))
  return out
}
function nextGroupGameFor(team,grp,matchResults){
  return SCHEDULE.filter(g=>g.grp===grp&&(g.home===team||g.away===team)&&!(matchResults[g.id]&&matchResults[g.id].final))[0]||null
}

function calcScore(username,picks,groupPicks,scores,matchResults){
  let pts=0,correct=0,exact=0
  const ug=groupPicks[username]||{}
  const up=picks[username]||{}
  const us=scores[username]||{}
  GROUPS_LIST.forEach(grp=>{
    if(!isGroupComplete(grp,matchResults))return
    const table=computeGroupTable(grp,matchResults)
    const pred=ug[grp]||{}
    if(pred.first===table[0].team){pts+=3;correct++}
    if(pred.second===table[1].team){pts+=2;correct++}
  })
  ;['r32','r16','qf','sf','final'].forEach(rnd=>{
    const count=ROUND_COUNTS[rnd]
    for(let idx=0;idx<count;idx++){
      const sid=roundIdxToScheduleId(rnd,idx)
      const r=matchResults[sid]
      if(!r||!r.final||!r.winner)continue
      const predicted=up[rnd]?.[idx]
      if(predicted&&predicted===r.winner){
        pts+=SCORE_PTS[rnd].w;correct++
        const scoreStr=us[rnd]?.[idx]||''
        const parts=scoreStr.split('-').map(n=>parseInt(n?.trim()))
        if(parts.length===2&&!isNaN(parts[0])&&!isNaN(parts[1])){
          const predSet=[parts[0],parts[1]].sort().join(',')
          const actSet=[r.homeScore,r.awayScore].sort().join(',')
          if(predSet===actSet){pts+=SCORE_PTS[rnd].e-SCORE_PTS[rnd].w;exact++}
        }
      }
    }
  })
  return{pts,correct,exact}
}

/* ─── LIVE SCORE SYNC (best-effort, free, no API key) ───
   Pulls from ESPN's public scoreboard feed. Unofficial endpoint — not
   guaranteed to stay online forever, so manual entry always remains
   available as a reliable fallback. Never overwrites a manually-entered
   result (marked source:'manual'). */
const ESPN_ALIASES = {
  'United States':'USA','USA':'USA',
  'Korea Republic':'South Korea','South Korea':'South Korea','Korea':'South Korea',
  'Czech Republic':'Czechia','Czechia':'Czechia',
  'Bosnia and Herzegovina':'Bosnia & Herz.','Bosnia-Herzegovina':'Bosnia & Herz.','Bosnia & Herzegovina':'Bosnia & Herz.',
  'Turkey':'Türkiye','Türkiye':'Türkiye',
  "Côte d'Ivoire":'Ivory Coast','Ivory Coast':'Ivory Coast','Cote d Ivoire':'Ivory Coast',
  'Curacao':'Curaçao','Curaçao':'Curaçao',
  'IR Iran':'Iran','Iran':'Iran',
  'Cabo Verde':'Cape Verde','Cape Verde':'Cape Verde',
  'DR Congo':'DR Congo','Congo DR':'DR Congo','DRC':'DR Congo','Congo':'DR Congo',
}
function normalizeEspnName(name){
  if(!name)return''
  if(ESPN_ALIASES[name])return ESPN_ALIASES[name]
  return name
}
function matchEspnEventToSchedule(event){
  const comp=event.competitions?.[0]
  if(!comp)return null
  const competitors=comp.competitors||[]
  const home=competitors.find(c=>c.homeAway==='home')
  const away=competitors.find(c=>c.homeAway==='away')
  if(!home||!away)return null
  const homeName=normalizeEspnName(home.team?.displayName||home.team?.name||'')
  const awayName=normalizeEspnName(away.team?.displayName||away.team?.name||'')
  const homeScore=parseInt(home.score)
  const awayScore=parseInt(away.score)
  if(isNaN(homeScore)||isNaN(awayScore))return null
  let sched=SCHEDULE.find(g=>g.grp&&((g.home===homeName&&g.away===awayName)||(g.home===awayName&&g.away===homeName)))
  if(!sched){
    const venueName=comp.venue?.fullName||''
    if(venueName){
      sched=SCHEDULE.find(g=>!g.grp&&g.venue&&(g.venue.includes(venueName.split(',')[0])||venueName.includes(g.venue.split(',')[0])))
    }
  }
  if(!sched)return null
  return{sched,homeName,awayName,homeScore,awayScore}
}
async function syncLiveScores(currentResults){
  try{
    const url='https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300'
    const res=await fetch(url)
    if(!res.ok)return{ok:false,changed:false,results:currentResults}
    const data=await res.json()
    const events=data.events||[]
    let changed=false
    const nr={...currentResults}
    events.forEach(ev=>{
      const completed=ev.status?.type?.completed
      if(!completed)return
      const m=matchEspnEventToSchedule(ev)
      if(!m)return
      const existing=nr[m.sched.id]
      if(existing&&existing.source==='manual')return
      let winner=null
      if(isKO(m.sched)){
        if(m.homeScore>m.awayScore)winner=m.homeName
        else if(m.awayScore>m.homeScore)winner=m.awayName
        else winner=existing?.winner||null
      }
      const entry={homeScore:m.homeScore,awayScore:m.awayScore,homeTeam:m.homeName,awayTeam:m.awayName,winner,final:true,source:'auto'}
      if(!existing||existing.homeScore!==entry.homeScore||existing.awayScore!==entry.awayScore||existing.winner!==entry.winner){
        nr[m.sched.id]=entry;changed=true
      }
    })
    return{ok:true,changed,results:nr}
  }catch(e){
    return{ok:false,changed:false,results:currentResults}
  }
}

/* ─── ANIMATIONS ─── */
function GoalCelebration({team,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,1900);return()=>clearTimeout(t)},[])
  return(
    <div className="goal-overlay" onClick={onDone}>
      <div className="goal-ball-anim">⚽</div>
      <div className="goal-txt">GOAL!</div>
      <div className="goal-sub">{team} advances! 🎉</div>
    </div>
  )
}
function AnimatedCounter({value,duration=900}){
  const [count,setCount]=useState(0)
  useEffect(()=>{
    if(value===0){setCount(0);return}
    let start=0;const step=value/(duration/16)
    const timer=setInterval(()=>{
      start+=step
      if(start>=value){setCount(value);clearInterval(timer)}
      else setCount(Math.floor(start))
    },16)
    return()=>clearInterval(timer)
  },[value])
  return <span>{count}</span>
}
function ConfettiLeader(){
  const pieces=Array.from({length:20},(_,i)=>({id:i,c:CC[i%CC.length],l:`${5+i*5}%`,del:`${Math.random()*2}s`,dur:`${1.5+Math.random()*1.5}s`,w:Math.random()>.5?6:4,h:Math.random()>.5?12:6}))
  return(<div className="confetti-leader">{pieces.map(p=>(<div key={p.id} className="cl-piece" style={{left:p.l,background:p.c,width:p.w,height:p.h,animationDuration:p.dur,animationDelay:p.del}}/>))}</div>)
}
function BallRoll(){return <div className="ball-roll">⚽</div>}

function Splash({users,onDone}){
  const [out,setOut]=useState(false)
  useEffect(()=>{const t=setTimeout(()=>{setOut(true);setTimeout(onDone,500)},4200);return()=>clearTimeout(t)},[])
  const go=()=>{setOut(true);setTimeout(onDone,400)}
  const pieces=Array.from({length:55},(_,i)=>({id:i,c:CC[i%CC.length],l:`${Math.random()*100}%`,del:`${Math.random()*3}s`,dur:`${2+Math.random()*3}s`,w:Math.random()>.5?8:5,h:Math.random()>.5?14:8}))
  return(
    <div className={`splash${out?' out':''}`} onClick={go}>
      {pieces.map(p=><div key={p.id} className="confetti-p" style={{left:p.l,top:'-20px',background:p.c,width:p.w,height:p.h,animationDuration:p.dur,animationDelay:p.del}}/>)}
      <div className="sp-eye">The Crew Presents</div>
      <div className="sp-ball">⚽</div>
      <div className="sp-title">THE <b>CREW'S</b><br/>WORLD CUP<br/>GUIDE</div>
      <img src={LOGO_URL} className="sp-logo" alt="FIFA WC 2026"/>
      <div className="sp-crew">{(users.length?users:INIT_USERS).map(m=><span key={m} className="sp-pill">{m}</span>)}</div>
      <div className="sp-hint">Tap anywhere to kick off ⚽</div>
    </div>
  )
}

function UserModal({users,onJoin}){
  const [selected,setSelected]=useState('')
  const [custom,setCustom]=useState('')
  const name=custom.trim()||selected
  return(
    <div className="umodal-bg">
      <div className="umodal">
        <div className="um-title">⚽ Join The Crew</div>
        <div className="um-sub">Pick your name to make bracket picks. Anyone can join!</div>
        <div className="um-presets">
          {users.map(u=>(<button key={u} className={`um-preset${selected===u?' on':''}`} onClick={()=>{setSelected(u);setCustom('')}}>{flag(u)} {u}</button>))}
        </div>
        <div className="um-or">— or enter a new name —</div>
        <input className="um-input" placeholder="Your name..." value={custom} onChange={e=>{setCustom(e.target.value);setSelected('')}}/>
        <button className="um-btn" disabled={!name} onClick={()=>onJoin(name)}>Let's Go! 🚀</button>
      </div>
    </div>
  )
}

function StreamingGuide(){
  return(
    <div className="stream-guide">
      <div className="sg-title">📺 How to Watch — All Channels</div>
      <div className="sg-grid">
        <div>
          <div className="sg-col-title">🇺🇸 English</div>
          {[{b:'FOX',cls:'free',d:'Free over the air (antenna)'},{b:'FS1',cls:'cable',d:'Cable / satellite'},{b:'FOX One',cls:'stream',d:'Stream — $19.99/mo'},{b:'Tubi',cls:'free',d:'Select games FREE'},{b:'Fubo / YouTube TV',cls:'cable',d:'Live TV streaming'}].map(({b,cls,d})=>(
            <div key={b} className="sg-item"><span className={`sg-badge ${cls}`}>{b}</span><span className="sg-desc">{d}</span></div>
          ))}
        </div>
        <div>
          <div className="sg-col-title">🇪🇸 Spanish</div>
          {[{b:'Telemundo',cls:'free',d:'92 games free, over the air'},{b:'Universo',cls:'cable',d:'12 games (cable)'},{b:'Peacock',cls:'stream',d:'All 104 games — $10.99/mo'},{b:'Telemundo App',cls:'cable',d:'With cable login'}].map(({b,cls,d})=>(
            <div key={b} className="sg-item"><span className={`sg-badge ${cls}`}>{b}</span><span className="sg-desc">{d}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── SCHEDULE TAB ─── */
function ScheduleTab({watchHosts,saveHost,users,matchResults}){
  const [sf,setSf]=useState('all')
  const [gf,setGf]=useState('all')
  const [hl,setHl]=useState('all')
  const [showCompleted,setShowCompleted]=useState(false)

  const isCompleted=g=>matchResults[g.id]&&matchResults[g.id].final

  const filtered=SCHEDULE.filter(g=>{
    if(sf!=='all'&&g.stage!==sf)return false
    if(gf!=='all'&&g.grp!==gf)return false
    if(hl==='usa'&&!isUSA(g))return false
    if(hl==='feat'&&!isFeat(g)&&!isUSA(g))return false
    if(!showCompleted&&isCompleted(g))return false
    return true
  })
  const grouped=byDate(filtered)
  const completedCount=SCHEDULE.filter(isCompleted).length

  function cc(g){if(isCompleted(g))return'gc done';if(isFin(g))return'gc fin';if(isUSA(g))return'gc usa';if(isFeat(g))return'gc feat';if(isKO(g))return'gc ko';return'gc'}
  function bc(g){if(isFin(g))return'gbadge fin-b';if(isUSA(g))return'gbadge usa-b';if(isFeat(g))return'gbadge feat-b';if(isKO(g))return'gbadge ko-b';return'gbadge'}
  function bt(g){
    if(g.stage==='Final')return'🏆';if(g.stage==='Semifinal')return'SF'
    if(g.stage==='Quarterfinal')return'QF';if(g.stage==='Round of 16')return'R16'
    if(g.stage==='Round of 32')return'R32';if(g.stage==='3rd Place')return'3rd';return g.grp
  }
  function featFlag(g){
    if(g.home==='England'||g.away==='England')return'🏴󠁧󠁢󠁥󠁮󠁧󠁿'
    if(g.home==='Australia'||g.away==='Australia')return'🇦🇺'
    return'🇦🇷'
  }

  return(
    <>
      <StreamingGuide/>
      <div className="sched">
        <div className="legend">
          <span className="leg-item"><span className="leg-dot" style={{background:'linear-gradient(var(--red),var(--blue))'}}/>🇺🇸 USA</span>
          <span className="leg-item"><span className="leg-dot" style={{background:'var(--gold)'}}/>⭐ England / Aus / Arg</span>
          <span className="leg-item"><span className="leg-dot" style={{background:'var(--blue)'}}/>Knockout</span>
          <span className="leg-item"><span className="leg-dot" style={{background:'var(--green)'}}/>🆓 Tubi Free</span>
        </div>
        <div className="fbar">
          <div className="frow">
            <span className="flbl">Show:</span>
            {[['all','All'],['usa','🇺🇸 USA'],['feat','⭐ Key']].map(([v,l])=>(
              <button key={v} className={`fbtn${hl===v?' on':''}`} onClick={()=>{setHl(v);setGf('all')}}>{l}</button>
            ))}
            <button className={`fbtn${showCompleted?' on':''}`} onClick={()=>setShowCompleted(s=>!s)} style={{marginLeft:'auto'}}>
              {showCompleted?'✓ ':''}Completed ({completedCount})
            </button>
          </div>
          <div className="frow">
            <span className="flbl">Stage:</span>
            <button className={`fbtn${sf==='all'?' on':''}`} onClick={()=>setSf('all')}>All</button>
            {STAGES.map(s=>(
              <button key={s} className={`fbtn${sf===s?' on':''}`} onClick={()=>setSf(s)}>
                {s==='Group Stage'?'Groups':s==='Round of 32'?'R32':s==='Round of 16'?'R16':s==='Quarterfinal'?'QF':s==='Semifinal'?'SF':s}
              </button>
            ))}
          </div>
          {(sf==='all'||sf==='Group Stage')&&hl==='all'&&(
            <div className="frow">
              <span className="flbl">Group:</span>
              <button className={`fbtn${gf==='all'?' on':''}`} onClick={()=>setGf('all')}>All</button>
              {GROUPS_LIST.map(g=><button key={g} className={`fbtn${gf===g?' on':''}`} onClick={()=>setGf(g)}>Grp {g}</button>)}
            </div>
          )}
        </div>
        {!showCompleted&&completedCount>0&&(
          <div className="hint">📦 {completedCount} finished game{completedCount!==1?'s':''} archived — tap "Completed" above to see final scores.</div>
        )}
        {Object.keys(grouped).length===0&&<div style={{textAlign:'center',padding:40,color:'var(--muted)',fontFamily:'Barlow Condensed'}}>No games match</div>}
        {Object.entries(grouped).map(([date,games])=>(
          <div key={date}>
            <div className="dh">📅 {date}</div>
            {games.map(g=>{
              const usa=isUSA(g),feat=isFeat(g),done=isCompleted(g)
              const result=matchResults[g.id]
              const homeT=done&&result.homeTeam?result.homeTeam:g.home
              const awayT=done&&result.awayTeam?result.awayTeam:g.away
              return(
                <div key={g.id} className={cc(g)}>
                  <div className={bc(g)}>{bt(g)}</div>
                  <div className="minfo">
                    {done&&<div className="ft-banner">✅ Final{result.winner?` · ${result.winner} won`:''}</div>}
                    {!done&&usa&&<div className="usa-banner">🇺🇸 USA · Must Watch</div>}
                    {!done&&feat&&<div className="feat-banner">{featFlag(g)} Featured</div>}
                    <div className="mteams">
                      {flag(homeT)} {homeT}
                      {done?<span className="score"> &nbsp;{result.homeScore} - {result.awayScore}&nbsp; </span>:<span className="vs">vs</span>}
                      {flag(awayT)} {awayT}
                    </div>
                    <div className="mmeta">
                      {!done&&<span className="mtime">⏰ {g.time} MT</span>}
                      <span>📍 {g.venue}</span>
                      {g.note&&<span style={{color:'var(--red)',fontWeight:700}}>• {g.note}</span>}
                    </div>
                  </div>
                  <div className="cright">
                    <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                      <div className={`sbadge${g.stream==='FS1'?' fs1':''}`}>{g.stream} / FOX One</div>
                      {g.tubi&&<div className="sbadge free">🆓 Tubi</div>}
                      <div className="sbadge-es">🇪🇸 {g.es} / Peacock</div>
                    </div>
                    <div>
                      <div className="hlbl">Watch party</div>
                      <select className={`hsel${watchHosts[g.id]?' set':''}`} value={watchHosts[g.id]||''} onChange={e=>saveHost(g.id,e.target.value)}>
                        <option value=''>No party yet</option>
                        {users.map(m=><option key={m} value={m}>🏠 {m}'s</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

/* ─── BRACKET TAB ─── */
function BracketTab({currentUser,users,picks,setPicks,groupPicks,setGroupPicks,scores,setScores,setCelebration}){
  const [round,setRound]=useState('groups')
  const mp=picks[currentUser]||{}
  const mg=groupPicks[currentUser]||{}
  const ms=scores[currentUser]||{}

  const resolve=slot=>{
    const wm=slot.match(/^Winner ([A-L])$/);if(wm)return mg[wm[1]]?.first||slot
    const rm=slot.match(/^R-up ([A-L])$/);if(rm)return mg[rm[1]]?.second||slot
    return slot
  }
  const getTeam=(rnd,idx,sl)=>{
    if(rnd==='r32'){
      const def=sl===0?R32S[idx].s1:R32S[idx].s2
      const res=resolve(def)
      return res!==def?res:def
    }
    const prev=ROUND_ORDER[ROUND_ORDER.indexOf(rnd)-1]
    return mp[prev]?.[idx*2+sl]||null
  }
  const clearDown=(nmp,rnd,idx)=>{
    const ri=ROUND_ORDER.indexOf(rnd);if(ri<0||ri>=ROUND_ORDER.length-1)return
    const nxt=ROUND_ORDER[ri+1];if(!nmp[nxt])nmp[nxt]={}
    nmp[nxt][Math.floor(idx/2)]=null;clearDown(nmp,nxt,Math.floor(idx/2))
  }
  const pick=async(rnd,idx,winner)=>{
    const nmp={...mp};if(!nmp[rnd])nmp[rnd]={}
    nmp[rnd][idx]=nmp[rnd][idx]===winner?null:winner
    clearDown(nmp,rnd,idx)
    const np={...picks,[currentUser]:nmp};setPicks(np)
    await dbSet('b_picks',np)
    if(nmp[rnd][idx])setCelebration(winner)
  }
  const setScore=async(rnd,idx,home,away)=>{
    const cur=ms[rnd]?.[idx]||'';const parts=cur.split('-')
    const h=home!==undefined?home:(parts[0]||'')
    const a=away!==undefined?away:(parts[1]||'')
    const ns={...scores,[currentUser]:{...(scores[currentUser]||{}),[rnd]:{...(ms[rnd]||{}),[idx]:`${h}-${a}`}}}
    setScores(ns);await dbSet('b_scores',ns)
  }
  const pickGroup=async(grp,team)=>{
    const curr=mg[grp]||{};let nw={...curr}
    if(!nw.first||nw.first===team){nw.first=nw.first===team?null:team;if(nw.second===team)nw.second=null}
    else{nw.second=nw.second===team?null:team;if(nw.first===team)nw.first=null}
    const ng={...groupPicks,[currentUser]:{...mg,[grp]:nw}};setGroupPicks(ng)
    const nmp={...mp};['r32','r16','qf','sf','final'].forEach(r=>{nmp[r]={}})
    const np={...picks,[currentUser]:nmp};setPicks(np)
    await dbSet('b_groups',ng);await dbSet('b_picks',np)
  }
  const resetGroup=async grp=>{
    const ng={...groupPicks,[currentUser]:{...mg,[grp]:{}}};setGroupPicks(ng)
    await dbSet('b_groups',ng)
  }

  let total=0;['r32','r16','qf','sf','final'].forEach(r=>Object.values(mp[r]||{}).forEach(v=>{if(v)total++}))
  const groupsDone=GROUPS_LIST.filter(g=>mg[g]?.first&&mg[g]?.second).length
  const champ=mp['final']?.[0]
  const getScoreParts=(rnd,idx)=>{const val=ms[rnd]?.[idx]||'';const parts=val.split('-');return{h:parts[0]||'',a:parts[1]||''}}

  return(
    <div className="brk">
      <div className="you-banner">⚽ You're picking as: {flag(currentUser)} {currentUser}</div>

      <div className="statsbar">
        <div className="stat"><div className="statnum">{groupsDone}/12</div><div className="statlbl">Groups Done</div></div>
        <div className="stat"><div className="statnum">{total}</div><div className="statlbl">KO Picks</div></div>
        <div className="stat"><div className="statnum">{31-total}</div><div className="statlbl">Left</div></div>
        <div className="stat"><div className="statnum" style={{fontSize:15,lineHeight:'30px'}}>{champ||'?'}</div><div className="statlbl">My Champion</div></div>
      </div>

      {champ&&<div className="champbox"><div className="ctrophy">🏆</div><div className="clbl">My World Cup Champion</div><div className="cname">{flag(champ)} {champ}</div></div>}

      <div className="rules-card">
        <div className="rules-title">📋 How Points Work</div>
        <div className="rules-grid">
          {[{pts:'3pts',d:'Correct group winner'},{pts:'2pts',d:'Correct runner-up'},{pts:'2-6pts',d:'Correct KO winner (rises by round)'},{pts:'+Bonus',d:'Exact score = extra points'}].map(r=>(
            <div key={r.pts} className="rule-item"><div className="rule-pts">{r.pts}</div><div className="rule-desc">{r.d}</div></div>
          ))}
        </div>
        <div className="rule-caveat">Exact score bonus counts the correct final scoreline in either order.</div>
      </div>

      <div className="rtabs">
        {[{k:'groups',l:'Groups 📋'},{k:'r32',l:'R32'},{k:'r16',l:'R16'},{k:'qf',l:'QF'},{k:'sf',l:'SF'},{k:'final',l:'🏆 Final'}].map(r=>(
          <button key={r.k} className={`rtab${round===r.k?' on':''}`} onClick={()=>setRound(r.k)}>{r.l}</button>
        ))}
      </div>

      {round==='groups'&&(
        <>
          <div className="secttitle">Pick Group Finishes</div>
          <div className="hint">Tap once → 🥇 1st · Tap another → 🥈 2nd · These auto-fill your knockout bracket</div>
          <div className="ggrid">
            {GROUPS_LIST.map(grp=>{
              const teams=GROUP_TEAMS[grp];const gd=mg[grp]||{}
              return(
                <div key={grp} className="gcard">
                  <div className="gcardh"><span>Group {grp}</span>{(gd.first||gd.second)&&<button className="greset" onClick={()=>resetGroup(grp)}>Reset</button>}</div>
                  {teams.map(t=>{
                    const f1=gd.first===t,f2=gd.second===t,out=gd.first&&gd.second&&!f1&&!f2
                    return(
                      <div key={t} className={`gteam${f1?' f1':f2?' f2':out?' out':''}`} onClick={()=>pickGroup(grp,t)}>
                        <div className={`grnk${f1?' r1':f2?' r2':out?' out':' empty'}`}>{f1?'1':f2?'2':out?'✗':'?'}</div>
                        <div className="gtnm">{flag(t)} {t}</div>
                        {f1&&<span>🥇</span>}{f2&&<span>🥈</span>}
                      </div>
                    )
                  })}
                  {(gd.first||gd.second)&&<div className="gadv">✅ {gd.first||'?'} · {gd.second||'?'} advance</div>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {round!=='groups'&&(
        <>
          <div className="secttitle">{ROUND_LABELS[round]}</div>
          {round==='r32'&&<div className="hint">Teams auto-filled from your group picks. Click a team to advance them.</div>}
          {round!=='r32'&&!total&&<div className="hint" style={{color:'var(--red)'}}>⚡ Make your R32 picks first to unlock this round!</div>}
          <div className="kogrid">
            {Array.from({length:ROUND_COUNTS[round]||1},(_,i)=>{
              const t1=getTeam(round,i,0),t2=getTeam(round,i,1)
              const winner=mp[round]?.[i]
              const {h,a}=getScoreParts(round,i)
              const t1ok=t1&&!isDesc(t1),t2ok=t2&&!isDesc(t2)
              return(
                <div key={i} className="kocard">
                  <div className="koh">Match {i+1}{round==='r32'?` · ${R32S[i].s1} vs ${R32S[i].s2}`:''}{round==='final'?' · WORLD CUP FINAL':''}</div>
                  <div className="ko-teams">
                    {[0,1].map(sl=>{
                      const tm=sl===0?t1:t2
                      const empty=!tm||tm==='TBD'||isDesc(tm)
                      const isPicked=winner===tm&&!empty
                      return(
                        <button key={sl} className={`ko-team-btn${isPicked?' picked':''}`} onClick={()=>tm&&!empty&&pick(round,i,tm)}>
                          <span className="ko-flag">{empty?'🏳️':flag(tm)}</span>
                          <span className={`ko-tname${empty?' tbd':''}`}>{empty?'TBD — finish previous round':tm}</span>
                          <div className={`ko-radio${isPicked?' on':''}`}/>
                          {isPicked&&<span className="adv-tag">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                  {(t1ok||t2ok)&&(
                    <div className="score-section">
                      <div className="score-lbl">Predict the score</div>
                      <div className="score-inputs">
                        <span style={{fontFamily:'Barlow Condensed',fontSize:11,color:'var(--muted)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t1ok?t1:'Home'}</span>
                        <input className="score-num" type="number" min="0" max="20" value={h} onChange={e=>setScore(round,i,e.target.value,undefined)} placeholder="0"/>
                        <span className="score-dash">-</span>
                        <input className="score-num" type="number" min="0" max="20" value={a} onChange={e=>setScore(round,i,undefined,e.target.value)} placeholder="0"/>
                        <span style={{fontFamily:'Barlow Condensed',fontSize:11,color:'var(--muted)',flex:1,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t2ok?t2:'Away'}</span>
                      </div>
                      {winner&&<div className="pick-hint">⭐ Exact score = bonus points!</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{marginTop:24}}>
            <div className="secttitle">The Crew's Champion Picks</div>
            <div className="crew-compare">
              {users.map(m=>(
                <div key={m} className={`ccrd${m===currentUser?' me':''}`}><div className="ccn">{flag(m)} {m}</div><div className="ccp">{picks[m]?.['final']?.[0]||'?'}</div></div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── CREW LEADERBOARD ─── */
function CrewLeaderboard({users,picks,groupPicks,scores,matchResults}){
  const standings=users.map(u=>{
    const {pts,correct,exact}=calcScore(u,picks,groupPicks,scores,matchResults)
    return{name:u,pts,correct,exact}
  }).sort((a,b)=>b.pts-a.pts||b.correct-a.correct)
  const hasAnyResults=Object.keys(matchResults).length>0

  return(
    <>
      {!hasAnyResults&&(
        <div className="no-results-note">⚽ No results entered yet. Points will update live as games are played and results get entered below.</div>
      )}
      <div className="leaderboard">
        {standings.map((u,i)=>(
          <div key={u.name} className={`lb-card${i===0?' first':''}`} style={{position:'relative'}}>
            {i===0&&<ConfettiLeader/>}
            {i===0&&<div className="lb-crown">👑</div>}
            <div className="lb-rank">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
            <div className={`lb-avatar${i===0?' gold':''}`}>{u.name[0]}</div>
            <div style={{flex:1}}>
              <div className="lb-name">{flag(u.name)} {u.name}</div>
              <div className="lb-detail">{u.correct} correct picks · {u.exact} exact scores</div>
            </div>
            <div className="lb-pts"><div className="lb-pts-num"><AnimatedCounter value={u.pts}/></div><div className="lb-pts-lbl">points</div></div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ─── TEAM STANDINGS (group tables + probability) ─── */
function GroupStandingsCard({grp,matchResults}){
  const table=useMemo(()=>computeGroupTable(grp,matchResults),[grp,matchResults])
  const complete=isGroupComplete(grp,matchResults)
  const probs=useMemo(()=>simulateGroup(grp,matchResults),[grp,matchResults])

  const whatTheyNeed=(team)=>{
    if(complete)return null
    const nextGame=nextGroupGameFor(team,grp,matchResults)
    if(!nextGame)return 'Waiting on other results'
    const opp=nextGame.home===team?nextGame.away:nextGame.home
    const side=nextGame.home===team?'home':'away'
    const overridesWin={[nextGame.id]:side}
    const overridesLose={[nextGame.id]:side==='home'?'away':'home'}
    const probIfWin=simulateGroup(grp,matchResults,overridesWin,600)[team]
    const probIfLose=simulateGroup(grp,matchResults,overridesLose,600)[team]
    if(probIfWin>=98)return `Win vs ${opp} to clinch advancement`
    if(probIfLose<=2)return `Could be eliminated with a loss to ${opp}`
    return `Match vs ${opp} is pivotal for advancing`
  }

  return(
    <div className="gs-card">
      <div className="gs-head">
        <div className="gs-head-title">Group {grp}</div>
        <div className="gs-head-status">{complete?'✅ Final':'⏳ In Progress'}</div>
      </div>
      <table className="gs-table">
        <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>
          {table.map((t,i)=>(
            <tr key={t.team} className={i<2?'qualified':''}>
              <td>{flag(t.team)} {t.team}</td>
              <td>{t.p}</td><td>{t.w}</td><td>{t.d}</td><td>{t.l}</td>
              <td>{t.gf-t.ga>0?'+':''}{t.gf-t.ga}</td>
              <td className="gs-pts">{t.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="prob-section">
        {table.map(t=>{
          const p=probs[t.team]??0
          const status=complete?(p===100?'q':'e'):(p>=70?'q':p<=15?'e':'')
          const color=p>=70?'var(--green)':p>=35?'var(--gold)':'var(--red)'
          const need=whatTheyNeed(t.team)
          return(
            <div key={t.team} className="prob-row">
              <div className="prob-top">
                <div className="prob-team">{flag(t.team)} {t.team}</div>
                <div className="prob-pct" style={{color}}>{p}%</div>
              </div>
              <div className="prob-bar-track"><div className="prob-bar-fill" style={{width:`${p}%`,background:color}}/></div>
              {!complete&&need&&<div className="prob-status">{need}</div>}
              {complete&&<div className={`prob-status ${status}`}>{p===100?'Qualified for Round of 32':'Eliminated'}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamStandingsTab({matchResults}){
  return(
    <>
      <div className="hint">⚽ Advancement chances are simulated based on current group form (points + goal difference) — not betting odds. Updates live as results come in.</div>
      <div className="grp-standings-grid">
        {GROUPS_LIST.map(grp=><GroupStandingsCard key={grp} grp={grp} matchResults={matchResults}/>)}
      </div>
    </>
  )
}

/* ─── STANDINGS TAB (sub-tabbed) ─── */
function StandingsTab({users,picks,groupPicks,scores,matchResults,setMatchResults,syncStatus,lastSynced,onManualSync}){
  const [sub,setSub]=useState('crew')
  const [selGameId,setSelGameId]=useState('')
  const [homeOverride,setHomeOverride]=useState('')
  const [awayOverride,setAwayOverride]=useState('')
  const [scoreHome,setScoreHome]=useState('')
  const [scoreAway,setScoreAway]=useState('')
  const [winnerOverride,setWinnerOverride]=useState('')
  const [saved,setSaved]=useState(false)

  const selGame=SCHEDULE.find(g=>g.id===parseInt(selGameId))
  const homeIsPlaceholder=selGame&&(isDesc(selGame.home)||selGame.home==='TBD')
  const awayIsPlaceholder=selGame&&(isDesc(selGame.away)||selGame.away==='TBD')
  const finalHome=homeIsPlaceholder?homeOverride:selGame?.home
  const finalAway=awayIsPlaceholder?awayOverride:selGame?.away
  const isDraw=scoreHome!==''&&scoreAway!==''&&parseInt(scoreHome)===parseInt(scoreAway)
  const needsWinnerOverride=selGame&&isKO(selGame)&&isDraw

  const canSave=selGame&&scoreHome!==''&&scoreAway!==''&&(!homeIsPlaceholder||homeOverride)&&(!awayIsPlaceholder||awayOverride)&&(!needsWinnerOverride||winnerOverride)

  const saveResult=async()=>{
    const hs=parseInt(scoreHome),as=parseInt(scoreAway)
    let winner=null
    if(isKO(selGame)){
      if(hs>as)winner=finalHome
      else if(as>hs)winner=finalAway
      else winner=winnerOverride
    }
    const nr={...matchResults,[selGame.id]:{homeScore:hs,awayScore:as,homeTeam:finalHome,awayTeam:finalAway,winner,final:true,source:'manual'}}
    setMatchResults(nr)
    await dbSet('match_results',nr)
    setSaved(true);setTimeout(()=>setSaved(false),2000)
    setSelGameId('');setHomeOverride('');setAwayOverride('');setScoreHome('');setScoreAway('');setWinnerOverride('')
  }

  const availableGames=SCHEDULE.filter(g=>!matchResults[g.id])

  return(
    <div className="stnd">
      <div className="subtabs">
        <button className={`substab${sub==='crew'?' on':''}`} onClick={()=>setSub('crew')}>🏆 Crew Leaderboard</button>
        <button className={`substab${sub==='teams'?' on':''}`} onClick={()=>setSub('teams')}>⚽ Team Standings</button>
      </div>

      <div className="hint" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',background:'#fff',border:'1.5px solid var(--border)',borderRadius:10,padding:'10px 14px'}}>
        <span>
          {syncStatus==='syncing'?'🔄 Checking for live scores…':
           syncStatus==='ok'?`✅ Auto-synced with live scores${lastSynced?` · last checked ${lastSynced.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}`:
           syncStatus==='error'?'⚠️ Live score source unavailable right now — manual entry below still works':
           '⚽ Starting auto-sync…'}
        </span>
        <button className="rs-btn" style={{padding:'5px 12px',fontSize:11,marginLeft:'auto'}} onClick={onManualSync}>Sync Now</button>
      </div>

      {sub==='crew'&&(
        <>
          <CrewLeaderboard users={users} picks={picks} groupPicks={groupPicks} scores={scores} matchResults={matchResults}/>
          <div className="rules-card">
            <div className="rules-title">📋 Scoring System</div>
            <div className="rules-grid">
              {[{pts:'3pts',d:'Correct group winner'},{pts:'2pts',d:'Correct runner-up'},{pts:'2→6pts',d:'KO correct winner (rises by round)'},{pts:'+Bonus',d:'Exact scoreline = extra points'}].map(r=>(
                <div key={r.pts} className="rule-item"><div className="rule-pts">{r.pts}</div><div className="rule-desc">{r.d}</div></div>
              ))}
            </div>
          </div>
        </>
      )}

      {sub==='teams'&&<TeamStandingsTab matchResults={matchResults}/>}

      <div className="results-section">
        <div className="rs-title">Enter a Match Result</div>
        <div className="rs-sub">Anyone in the crew can enter results as games finish. Updates the schedule, group tables, and everyone's points instantly.</div>
        <div className="rs-form">
          <div className="rs-row">
            <div className="rs-field" style={{flex:'1 1 100%'}}>
              <label>Select Game</label>
              <select className="rs-select" value={selGameId} onChange={e=>{setSelGameId(e.target.value);setHomeOverride('');setAwayOverride('');setScoreHome('');setScoreAway('');setWinnerOverride('')}}>
                <option value=''>Choose a game...</option>
                {availableGames.map(g=>(
                  <option key={g.id} value={g.id}>{g.date} — {g.home} vs {g.away} ({g.stage==='Group Stage'?`Grp ${g.grp}`:g.stage})</option>
                ))}
              </select>
            </div>
          </div>

          {selGame&&(
            <>
              {(homeIsPlaceholder||awayIsPlaceholder)&&(
                <div className="rs-row">
                  {homeIsPlaceholder&&(
                    <div className="rs-field">
                      <label>Actual Team ({selGame.home})</label>
                      <select className="rs-select" value={homeOverride} onChange={e=>setHomeOverride(e.target.value)}>
                        <option value=''>Select team...</option>
                        {ALL_TEAMS.filter(Boolean).map(t=><option key={t} value={t}>{flag(t)} {t}</option>)}
                      </select>
                    </div>
                  )}
                  {awayIsPlaceholder&&(
                    <div className="rs-field">
                      <label>Actual Team ({selGame.away})</label>
                      <select className="rs-select" value={awayOverride} onChange={e=>setAwayOverride(e.target.value)}>
                        <option value=''>Select team...</option>
                        {ALL_TEAMS.filter(Boolean).map(t=><option key={t} value={t}>{flag(t)} {t}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div className="rs-row">
                <div className="rs-field" style={{flex:'0 0 auto'}}>
                  <label>{finalHome||'Home'}</label>
                  <input className="rs-input" type="number" min="0" value={scoreHome} onChange={e=>setScoreHome(e.target.value)} placeholder="0"/>
                </div>
                <span className="rs-dash">-</span>
                <div className="rs-field" style={{flex:'0 0 auto'}}>
                  <label>{finalAway||'Away'}</label>
                  <input className="rs-input" type="number" min="0" value={scoreAway} onChange={e=>setScoreAway(e.target.value)} placeholder="0"/>
                </div>
              </div>
              {needsWinnerOverride&&(
                <div className="rs-row">
                  <div className="rs-field">
                    <label>Draw — who won on penalties?</label>
                    <select className="rs-select" value={winnerOverride} onChange={e=>setWinnerOverride(e.target.value)}>
                      <option value=''>Select winner...</option>
                      <option value={finalHome}>{finalHome}</option>
                      <option value={finalAway}>{finalAway}</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="rs-row">
                <button className="rs-btn" onClick={saveResult} disabled={!canSave}>Save Result</button>
                {saved&&<span className="rs-success">✓ Saved!</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── NEWS TAB ─── */
function NewsTab(){
  return(
    <div className="news">
      <div className="news-note">📰 A curated snapshot of World Cup 2026 coverage. Ask Ben to refresh this list anytime for the latest stories — or tap "More News" below for live results.</div>
      {NEWS_ITEMS.map((n,i)=>(
        <a key={i} className="news-card" href={n.url} target="_blank" rel="noopener noreferrer">
          <div className="news-source">📡 {n.source}</div>
          <div className="news-title">{n.title}</div>
          <div className="news-desc">{n.desc}</div>
        </a>
      ))}
      <a className="news-more" href="https://news.google.com/search?q=World%20Cup%202026" target="_blank" rel="noopener noreferrer">More World Cup News →</a>
    </div>
  )
}

/* ─── APP ─── */
export default function App(){
  const [splash,setSplash]=useState(true)
  const [tab,setTab]=useState('schedule')
  const [loading,setLoading]=useState(true)
  const [ballAnim,setBallAnim]=useState(false)
  const [celebration,setCelebration]=useState(null)
  const [currentUser,setCurrentUser]=useState(()=>localStorage.getItem('crewMyName')||null)
  const [showUserModal,setShowUserModal]=useState(false)
  const [users,setUsers]=useState(INIT_USERS)
  const [watchHosts,setWatchHosts]=useState({})
  const [picks,setPicks]=useState({})
  const [groupPicks,setGroupPicks]=useState({})
  const [scores,setScores]=useState({})
  const [matchResults,setMatchResults]=useState({})
  const [syncStatus,setSyncStatus]=useState('idle')
  const [lastSynced,setLastSynced]=useState(null)
  const matchResultsRef=useRef(matchResults)
  useEffect(()=>{matchResultsRef.current=matchResults},[matchResults])

  useEffect(()=>{
    async function load(){
      try{const d=await dbGet('users');if(d&&d.length)setUsers(d)}catch(e){}
      try{const d=await dbGet('w_hosts');if(d)setWatchHosts(d)}catch(e){}
      try{const d=await dbGet('b_picks');if(d)setPicks(d)}catch(e){}
      try{const d=await dbGet('b_groups');if(d)setGroupPicks(d)}catch(e){}
      try{const d=await dbGet('b_scores');if(d)setScores(d)}catch(e){}
      try{const d=await dbGet('match_results');if(d)setMatchResults(d)}catch(e){}
      setLoading(false)
    }
    load()
  },[])

  useEffect(()=>{
    const channel=supabase.channel('crew_sync')
      .on('postgres_changes',{event:'*',schema:'public',table:'crew_data'},payload=>{
        const {key,value}=payload.new||{}
        if(!key||value===undefined)return
        if(key==='users')setUsers(value)
        if(key==='w_hosts')setWatchHosts(value)
        if(key==='b_picks')setPicks(value)
        if(key==='b_groups')setGroupPicks(value)
        if(key==='b_scores')setScores(value)
        if(key==='match_results')setMatchResults(value)
      }).subscribe()
    return()=>supabase.removeChannel(channel)
  },[])

  // Auto-sync live scores from ESPN's free public scoreboard every 90s.
  // Manual entry (Standings tab) always remains available as a fallback.
  const doSync=async()=>{
    setSyncStatus('syncing')
    const r=await syncLiveScores(matchResultsRef.current)
    if(r.ok){
      if(r.changed){
        setMatchResults(r.results)
        await dbSet('match_results',r.results)
      }
      setSyncStatus('ok')
    }else{
      setSyncStatus('error')
    }
    setLastSynced(new Date())
  }
  useEffect(()=>{
    const initial=setTimeout(doSync,2500)
    const interval=setInterval(doSync,90000)
    return()=>{clearTimeout(initial);clearInterval(interval)}
  },[])

  const handleJoin=async(name)=>{
    localStorage.setItem('crewMyName',name)
    setCurrentUser(name)
    setShowUserModal(false)
    if(!users.includes(name)){
      const nu=[...users,name]
      setUsers(nu)
      await dbSet('users',nu)
    }
  }

  const handleTabChange=async(newTab)=>{
    if(newTab==='bracket'&&!currentUser){setShowUserModal(true);return}
    setBallAnim(true)
    setTimeout(()=>{setTab(newTab);setBallAnim(false)},280)
  }

  const saveHost=async(id,host)=>{
    const n={...watchHosts,[id]:host};setWatchHosts(n);await dbSet('w_hosts',n)
  }

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <style>{CSS}</style>
      {splash&&<Splash users={users} onDone={()=>setSplash(false)}/>}
      {showUserModal&&<UserModal users={users} onJoin={handleJoin}/>}
      {celebration&&<GoalCelebration team={celebration} onDone={()=>setCelebration(null)}/>}
      {ballAnim&&<BallRoll/>}

      <div className="hdr">
        <img src={LOGO_URL} className="hdr-logo" alt="FIFA WC 2026"/>
        <div style={{flex:1}}>
          <div className="hdr-t">THE CREW'S <em>WORLD CUP</em> GUIDE</div>
          <div className="hdr-s">All game times in Mountain Time ⚽</div>
        </div>
        {!loading&&<div className="live-badge"><div className="live-dot"/>Live</div>}
      </div>

      <div className="tabs">
        <button className={`tbtn${tab==='schedule'?' on':''}`} onClick={()=>handleTabChange('schedule')}>📋 Schedule</button>
        <button className={`tbtn${tab==='bracket'?' on':''}`} onClick={()=>handleTabChange('bracket')}>🏆 Bracket</button>
        <button className={`tbtn${tab==='standings'?' on':''}`} onClick={()=>handleTabChange('standings')}>📊 Standings</button>
        <button className={`tbtn${tab==='news'?' on':''}`} onClick={()=>handleTabChange('news')}>📰 News</button>
      </div>

      {loading
        ?<div className="loading">⚽ Loading...</div>
        :tab==='schedule'
          ?<ScheduleTab watchHosts={watchHosts} saveHost={saveHost} users={users} matchResults={matchResults}/>
          :tab==='bracket'
            ?currentUser
              ?<BracketTab currentUser={currentUser} users={users} picks={picks} setPicks={setPicks} groupPicks={groupPicks} setGroupPicks={setGroupPicks} scores={scores} setScores={setScores} setCelebration={setCelebration}/>
              :<div className="loading" style={{flexDirection:'column',gap:14}}>
                  <div>⚽ Who are you?</div>
                  <button className="um-btn" style={{width:'auto',padding:'12px 26px'}} onClick={()=>setShowUserModal(true)}>Join The Crew</button>
                </div>
            :tab==='standings'
              ?<StandingsTab users={users} picks={picks} groupPicks={groupPicks} scores={scores} matchResults={matchResults} setMatchResults={setMatchResults} syncStatus={syncStatus} lastSynced={lastSynced} onManualSync={doSync}/>
              :<NewsTab/>
      }
    </div>
  )
}
