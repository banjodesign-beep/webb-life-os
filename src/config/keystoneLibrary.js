// keystoneLibrary.js — the pool Meridian draws today's keystone from.
//
// WHY THIS EXISTS: the keystone used to be "first unchecked item on today's
// checklist", which meant it just echoed the daily maintenance list. A keystone
// should be the one thing that moves the larger life forward — drawn from the
// bigger arcs (family, platform, health, money, faith, leadership, identity),
// not from the recurring chores that already have their own card.
//
// Each entry:
//   domain — buckets to DOMAIN_CFG plus "faith" / "leadership" / "identity"
//   text   — the ask, stated as an action
//   why    — why it matters (shown on the card)
//   min    — the smallest honest version, for low-capacity days
//   modes  — which day types it may surface on
//              "weekday"  normal working day
//              "saturday" family day
//              "travel"   travel mode active
//            NOTE: no entry is ever tagged "sunday". Sabbath deliberately has
//            no keystone — see SABBATH_INVITATIONS below.
//   heavy  — true if it needs real capacity; suppressed on travel days

export const KEYSTONE_LIBRARY = [
  // ── IDENTITY (the three questions → secure humility) ──────────────
  { id: "id1", domain: "identity", modes: ["weekday", "travel"],
    text: "Name which posture you woke up in",
    why: "Fragile insecurity, arrogant pride, or secure humility. You lead out of whichever one you haven't named.",
    min: "One word in the journal." },
  { id: "id2", domain: "identity", modes: ["weekday"],
    text: "Ask whose approval you're chasing today",
    why: "The answer to 'what am I worth' gets outsourced quietly, usually to the room you're most afraid of.",
    min: "Name the person or room. Don't fix it yet." },
  { id: "id3", domain: "identity", modes: ["weekday", "travel"],
    text: "Find where you led from fear this week",
    why: "Fear-led decisions look like urgency. They're the tell that safety got answered wrong.",
    min: "One decision. No self-flagellation." },
  { id: "id4", domain: "identity", modes: ["weekday"],
    text: "Confess one thing you're managing instead of surrendering",
    why: "Systems thinking is a gift until it becomes a way to avoid dependence.",
    min: "Say it out loud once, alone." },
  { id: "id5", domain: "identity", modes: ["weekday"],
    text: "Do one thing today that no one will see",
    why: "Secure humility doesn't need the credit. Practice it deliberately or it stays theoretical.",
    min: "Anything unwitnessed and useful." },

  // ── FAITH ──────────────────────────────────────────────────────────
  { id: "fa1", domain: "faith", modes: ["weekday", "travel"],
    text: "Pray before the first email",
    why: "Order matters more than duration. What comes first sets who you're working for.",
    min: "Ninety seconds before the screen." },
  { id: "fa2", domain: "faith", modes: ["weekday", "travel"],
    text: "Read one psalm slowly",
    why: "Slowly is the whole instruction. You already read fast for a living.",
    min: "Six verses. Out loud if you can." },
  { id: "fa3", domain: "faith", modes: ["weekday"],
    text: "Practice the worship set without performing it",
    why: "Playing for the room and playing before God feel identical from the outside and nothing alike from the inside.",
    min: "One song, eyes closed." },
  { id: "fa4", domain: "faith", modes: ["weekday", "travel"],
    text: "Protect next Sabbath on the calendar now",
    why: "Three full Sabbaths a month doesn't survive contact with a travel schedule unless it's defended in advance.",
    min: "Block one Sunday. Decline one thing." },
  { id: "fa5", domain: "faith", modes: ["weekday"],
    text: "Pray for one person at IJM by name",
    why: "The mission is easier to love in aggregate than one person at a time. Reverse that today.",
    min: "One name, one minute." },

  // ── FAMILY — Jules ─────────────────────────────────────────────────
  { id: "fj1", domain: "family", modes: ["weekday", "saturday"],
    text: "One conversation with Jules that isn't logistics",
    why: "Household operations will happily eat every square inch of a marriage if you let them.",
    min: "Ten minutes. No calendar talk." },
  { id: "fj2", domain: "family", modes: ["weekday", "saturday"],
    text: "Ask Jules what she's carrying that you haven't noticed",
    why: "Tutoring business, homeschooling, the household. Most of it is invisible by design.",
    min: "Ask. Then don't problem-solve." },
  { id: "fj3", domain: "family", modes: ["weekday", "saturday"],
    text: "Ask what would make her next week lighter",
    why: "Then actually remove the thing. Asking without acting is worse than not asking.",
    min: "One question, one thing removed." },
  { id: "fj4", domain: "family", modes: ["weekday", "saturday"],
    text: "Take one household decision off her plate entirely",
    why: "Not help with it. Own it, decide it, close it.",
    min: "Pick the smallest one and finish it." },
  { id: "fj5", domain: "family", modes: ["saturday"],
    text: "Cook so Jules doesn't have to think about food",
    why: "The thinking is the labor, not the cooking.",
    min: "Even if it's takeout you chose and ordered." },

  // ── FAMILY — River ─────────────────────────────────────────────────
  { id: "fr1", domain: "family", modes: ["weekday", "saturday"],
    text: "Train with River — touches, not drills",
    why: "Ceiling limited only by talent means volume on the ball, not your coaching.",
    min: "Fifteen minutes in the yard." },
  { id: "fr2", domain: "family", modes: ["weekday", "saturday"],
    text: "Ask River what he wants to get better at",
    why: "Then be quiet. His answer is more useful than your assessment.",
    min: "Ask once. Resist adding to it." },
  { id: "fr3", domain: "family", modes: ["weekday"],
    text: "Watch a River match without coaching from the sideline",
    why: "He has a coach. What he needs from you is different and rarer.",
    min: "One half, mouth closed." },
  { id: "fr4", domain: "family", modes: ["weekday"],
    text: "One honest exchange with Brian about River's development",
    why: "Coach relationships compound. So do the ones you let go quiet.",
    min: "A single specific question, sent." },
  { id: "fr5", domain: "family", modes: ["weekday", "saturday"],
    text: "Tell River the specific thing you're proud of",
    why: "Specific beats general by an order of magnitude, and he'll remember the sentence.",
    min: "One sentence. Name the actual thing." },

  // ── FAMILY — Annie ─────────────────────────────────────────────────
  { id: "fa6", domain: "family", modes: ["weekday", "saturday"],
    text: "Ask Annie about the work, not the outcome",
    why: "Theatre as a spike means depth. Depth questions signal you take it seriously as craft.",
    min: "One question about a choice she made." },
  { id: "fa7", domain: "family", modes: ["weekday"],
    text: "Move the College Pathways decision one step",
    why: "Full enrollment with better course selection is live and shouldn't drift by default.",
    min: "One email or one question to Annie." },
  { id: "fa8", domain: "family", modes: ["weekday", "saturday"],
    text: "Watch Annie rehearse and give no notes",
    why: "You are very good at notes. That's exactly why this one is hard and worth doing.",
    min: "Twenty minutes. Applaud. Leave it." },
  { id: "fa9", domain: "family", modes: ["weekday", "saturday"],
    text: "Tell Annie the specific thing you're proud of",
    why: "Different child, same principle, and the arts kid hears it less often than the athlete.",
    min: "One sentence. Name the actual thing." },

  // ── FAMILY — wider ─────────────────────────────────────────────────
  { id: "fw1", domain: "family", modes: ["weekday", "travel"],
    text: "Call your parents with no agenda",
    why: "'Feel cared for' is not a project with a deadline. It's a frequency.",
    min: "Ten minutes from the car." },
  { id: "fw2", domain: "family", modes: ["weekday"],
    text: "Move the 20th anniversary from diary entry to plan",
    why: "December 2. Twenty years earns more than a calendar block and a late reservation.",
    min: "One booking, one decision, today." },
  { id: "fw3", domain: "family", modes: ["saturday"],
    text: "One-on-one with one child, phone in another room",
    why: "Presence is measured by where the phone is, not where you are.",
    min: "One hour, one child, no device." },
  { id: "fw4", domain: "family", modes: ["weekday", "travel"],
    text: "Text home from the gate, not the hotel",
    why: "The gap between leaving and landing is where they feel the absence most.",
    min: "One message before boarding." },

  // ── HEALTH ─────────────────────────────────────────────────────────
  { id: "he1", domain: "health", modes: ["weekday", "saturday"], heavy: true,
    text: "Bulgarian split squats — the high-leverage lift",
    why: "Lower body is the variable that actually moves the plateau, and it's shoulder-safe.",
    min: "Two sets. Bodyweight counts." },
  { id: "he2", domain: "health", modes: ["weekday", "saturday"], heavy: true,
    text: "RDLs — hinge, don't reach",
    why: "Posterior chain without loading the shoulder. Form over load, always.",
    min: "One light set of ten." },
  { id: "he3", domain: "health", modes: ["weekday", "travel"],
    text: "Glute bridges before the day starts",
    why: "No equipment, no shoulder involvement, works in a hotel room.",
    min: "Thirty reps on the floor." },
  { id: "he4", domain: "health", modes: ["weekday", "travel"],
    text: "Hit protein before noon, not at 9pm",
    why: "Back-loading protein is why the target gets missed. Front-load it and the day takes care of itself.",
    min: "One shake or three eggs, early." },
  { id: "he5", domain: "health", modes: ["weekday", "saturday", "travel"],
    text: "Walk thirty minutes with nothing in your ears",
    why: "You already walk. Doing it without input turns exercise into thinking time.",
    min: "Fifteen minutes, no podcast." },
  { id: "he6", domain: "health", modes: ["weekday", "travel"],
    text: "Respect the shoulder — no overhead, no ego",
    why: "The bursitis episode is a warning, not a memory. Aggressive self-treatment is how it comes back.",
    min: "Substitute one movement today." },
  { id: "he7", domain: "health", modes: ["weekday", "travel"],
    text: "Stop eating at 8pm",
    why: "Simple lever, no tracking required, and it improves sleep as a side effect.",
    min: "Kitchen closed. That's the whole rule." },
  { id: "he8", domain: "health", modes: ["weekday", "saturday"],
    text: "Do the twelve-minute minimum",
    why: "On the days you don't want to, the point is the streak of identity, not the stimulus.",
    min: "Twelve minutes. Then stop, guilt-free." },
  { id: "he9", domain: "health", modes: ["travel"],
    text: "Walk the terminal instead of sitting at the gate",
    why: "Travel days are where the routine quietly dies. This is the cheapest possible save.",
    min: "One lap before boarding." },
  { id: "he10", domain: "health", modes: ["weekday", "travel"],
    text: "Water before caffeine",
    why: "Small, unglamorous, and it changes how the first two hours feel.",
    min: "One full glass first." },
  { id: "he11", domain: "health", modes: ["weekday"],
    text: "Log the weight without editorializing",
    why: "The number is data on a plateau, not a verdict on you.",
    min: "Log it. Close the app." },

  // ── PLATFORM ───────────────────────────────────────────────────────
  { id: "pl1", domain: "platform", modes: ["weekday"], heavy: true,
    text: "The Sequence — 500 ugly words",
    why: "Manuscripts die from editing before drafting. Volume first, quality later.",
    min: "200 words. Bad ones are fine." },
  { id: "pl2", domain: "platform", modes: ["weekday", "travel"],
    text: "Recalibrated — capture one story from this month",
    why: "The book is built from lived material. Unrecorded experience is lost material.",
    min: "Three sentences into the journal." },
  { id: "pl3", domain: "platform", modes: ["weekday"],
    text: "One Five One — message one man directly",
    why: "A movement is a series of individual invitations before it's anything else.",
    min: "One text. Not a broadcast." },
  { id: "pl4", domain: "platform", modes: ["weekday", "travel"],
    text: "Post the thing you've been editing",
    why: "The marginal edit is procrastination wearing a craftsman's coat.",
    min: "Publish it as-is." },
  { id: "pl5", domain: "platform", modes: ["weekday"],
    text: "One name off the publisher list, one email",
    why: "Zondervan, IVP, WaterBrook. A list isn't progress until someone's been contacted.",
    min: "One email. Short is better." },
  { id: "pl6", domain: "platform", modes: ["weekday"],
    text: "Outline a chapter — don't write it",
    why: "Separating structure from prose is how the manuscript stops stalling mid-chapter.",
    min: "Five bullets." },
  { id: "pl7", domain: "platform", modes: ["weekday"],
    text: "BenWebb.com — one decision, not a redesign",
    why: "The site is stalled on scope, not on effort. Decide one thing and ship it.",
    min: "Pick the homepage headline." },
  { id: "pl8", domain: "platform", modes: ["weekday", "travel"],
    text: "Read twenty minutes outside marketing",
    why: "The Sequence will be better for what you read that isn't about its own subject.",
    min: "Ten pages of anything else." },
  { id: "pl9", domain: "platform", modes: ["weekday"],
    text: "Reconnect with Ken Caldwell",
    why: "Relationships that helped once decay silently if they're only touched when needed.",
    min: "One message, no ask attached." },

  // ── LEADERSHIP ─────────────────────────────────────────────────────
  { id: "le1", domain: "leadership", modes: ["weekday"],
    text: "Do first the one thing only you can do",
    why: "As CMO the calendar fills with things others could do. That's the whole trap.",
    min: "Name it. Do thirty minutes of it before anything else." },
  { id: "le2", domain: "leadership", modes: ["weekday"], heavy: true,
    text: "Design yourself out of one bottleneck",
    why: "You already do this for household and financial systems. Do it for your own role.",
    min: "Identify the bottleneck. That's step one." },
  { id: "le3", domain: "leadership", modes: ["weekday"],
    text: "Have the conversation you've been avoiding",
    why: "Avoidance compounds at a worse rate than almost any other leadership debt.",
    min: "Schedule it, if you can't have it today." },
  { id: "le4", domain: "leadership", modes: ["weekday"],
    text: "Ask your team what you're the constraint on",
    why: "They know. The only question is whether you've made it safe to say.",
    min: "Ask one person privately." },
  { id: "le5", domain: "leadership", modes: ["weekday"],
    text: "Hand Katy one thing you're still holding",
    why: "Holding things an EA could own is a status habit disguised as diligence.",
    min: "One handoff, fully delegated." },
  { id: "le6", domain: "leadership", modes: ["weekday"],
    text: "Give someone else the credit, publicly",
    why: "Cheap for you, disproportionately valuable to them. That's the definition of leverage.",
    min: "One message where others can see it." },
  { id: "le7", domain: "leadership", modes: ["weekday"], heavy: true,
    text: "Defend one block of deep work — decline something",
    why: "Deep work isn't found, it's defended. The decline is the actual work.",
    min: "Say no to one thing." },
  { id: "le8", domain: "leadership", modes: ["weekday"],
    text: "Write the decision down so it can't be relitigated",
    why: "Undocumented decisions get relitigated. That's where the week goes.",
    min: "Three lines in the right channel." },
  { id: "le9", domain: "leadership", modes: ["weekday"],
    text: "End one meeting early",
    why: "Giving time back is the most immediately felt thing a leader can do.",
    min: "One meeting, ten minutes back." },

  // ── FINANCIAL ──────────────────────────────────────────────────────
  { id: "fi1", domain: "financial", modes: ["weekday"],
    text: "Spousal Roth for Jules — one step",
    why: "Identified as untapped and still untapped. It only stays that way by default.",
    min: "Open the tab. Read the eligibility rules." },
  { id: "fi2", domain: "financial", modes: ["weekday"],
    text: "Confirm the 529 step-up actually happened",
    why: "Automated contributions fail silently. Verification is the whole value of automation.",
    min: "Log into CollegeInvest. Look once." },
  { id: "fi3", domain: "financial", modes: ["weekday"],
    text: "Fiduciary planner — send one inquiry",
    why: "Fee-only, fiduciary. The search doesn't start itself once surplus exists.",
    min: "One email to one firm." },
  { id: "fi4", domain: "financial", modes: ["weekday"],
    text: "Check the actual DTI before assuming the refi",
    why: "The truck refi depends on a number, not a feeling about the number.",
    min: "Calculate it once, write it down." },
  { id: "fi5", domain: "financial", modes: ["weekday", "saturday"],
    text: "Twenty-minute money review with Jules — no blame",
    why: "The dashboard exists so this conversation can be about facts instead of anxiety.",
    min: "Open it together. Look at one tab." },
  { id: "fi6", domain: "financial", modes: ["weekday"],
    text: "Leave the mortgage rate alone",
    why: "Below-market rate is a structural asset. Today's keystone is deliberately not touching it.",
    min: "Just acknowledge it and move on." },

  // ── TRAVEL ─────────────────────────────────────────────────────────
  { id: "tr1", domain: "health", modes: ["travel"],
    text: "Sleep kit packed before you're tired",
    why: "Eye mask and earplugs only work if packing happened when you had judgment.",
    min: "Put it in the bag now." },
  { id: "tr2", domain: "leadership", modes: ["travel", "weekday"],
    text: "Book the flight that protects the Sabbath",
    why: "The cheapest itinerary is rarely the cheapest once you price the recovery.",
    min: "Compare two options with that as the filter." },
  { id: "tr3", domain: "identity", modes: ["travel"],
    text: "Decide now what you won't do on this trip",
    why: "Trips expand to fill available energy unless the edges are set in advance.",
    min: "Name one thing you're skipping." },
];

// Sabbath gets invitations, never tasks. Nothing here is completable —
// that's the point. A keystone on a rest day contradicts the rest day.
export const SABBATH_INVITATIONS = [
  { text: "Nothing is required of you today.", sub: "That's not a loophole. It's the instruction." },
  { text: "Rest is a declaration of trust.", sub: "The work continues without you. That's good news, not a threat." },
  { text: "Be present with the people in the room.", sub: "No optimizing. No planning. Just here." },
  { text: "You are not what you produced this week.", sub: "Who am I? What am I worth? Am I safe? Today, answer them without reference to output." },
  { text: "Worship, then linger.", sub: "The lingering is as much the point as the service." },
  { text: "Let something stay unfinished.", sub: "Sabbath is practice for the fact that it always will be." },
  { text: "Receive the day instead of managing it.", sub: "You are very good at managing. Try the other thing." },
  { text: "Notice one thing you didn't earn.", sub: "Gratitude is the native language of secure humility." },
];

// Deterministic per-day rotation, filtered to the mode, so it doesn't
// reshuffle on every render but does move day to day. Recently-used ids are
// skipped so the same prompt doesn't reappear within the cooldown window.
export function pickKeystone({ mode, dayOfYear, recentIds = [], domainBias = null }) {
  if (mode === "sunday") return null;

  let pool = KEYSTONE_LIBRARY.filter((k) => k.modes.includes(mode));
  if (mode === "travel") pool = pool.filter((k) => !k.heavy);
  if (domainBias) {
    const biased = pool.filter((k) => k.domain === domainBias);
    if (biased.length >= 3) pool = biased;
  }
  if (pool.length === 0) pool = KEYSTONE_LIBRARY.filter((k) => k.modes.includes("weekday"));

  const fresh = pool.filter((k) => !recentIds.includes(k.id));
  const usable = fresh.length > 0 ? fresh : pool;
  return usable[dayOfYear % usable.length];
}

export function pickSabbathInvitation(dayOfYear) {
  return SABBATH_INVITATIONS[dayOfYear % SABBATH_INVITATIONS.length];
}
