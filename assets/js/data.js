/* Qualia — seed data (demo only; no backend). Attaches to window.QUALIA_DATA */
(function(){

  var CATEGORIES = [
    'Cooking', 'Sailing & Water', 'Photography', 'Language', 'Music',
    'Art & Craft', 'Career & Skills', 'Local Culture', 'Fitness', 'Specialty Hobbies'
  ];

  var HOSTS = [
    {
      id: 'rosa', name: 'Rosa Bianchi', location: 'Bensonhurst, Brooklyn',
      tagline: 'Fourth-generation pasta maker. I learned standing on a chair.',
      color: '2c4130', joined: 2024, responseRate: 98, rating: 4.98, reviewCount: 61,
      verified: true, availableWeekdays: [0,3,6],
      bio: "I've made pasta by hand since I was six, in the same kitchen my grandmother cooked in for forty years. I don't teach classes — I invite three or four people at a time into that kitchen and we make what my family actually eats, including the parts that never made it into a cookbook.",
      credentials: ['Food handler certified', 'Home kitchen inspected & insured']
    },
    {
      id: 'elin', name: 'Elin Sørensen', location: 'Newport, Rhode Island',
      tagline: "Sailed the Atlantic twice. I don't do pleasure cruises.",
      color: '374a2e', joined: 2023, responseRate: 95, rating: 5.0, reviewCount: 34,
      verified: true, availableWeekdays: [2,4,6],
      bio: "Twenty-two years on the water, six of them racing offshore. When you come out with me, you're not a passenger — you're crew. I expect you to trim a sail and take a turn at the helm, and I'll tell you when you get it wrong.",
      credentials: ['USCG Master 100-Ton license', 'First Aid & Sea Survival certified', 'Vessel insured for passengers']
    },
    {
      id: 'dario', name: 'Dario Conti', location: 'Red Hook, Brooklyn',
      tagline: 'Cabinetmaker. My grandfather wouldn’t let me touch the good chisels until I was twenty-two.',
      color: '2c4130', joined: 2022, responseRate: 99, rating: 4.96, reviewCount: 88,
      verified: true, availableWeekdays: [1,3,5],
      bio: "I run a one-man cabinet shop out of a hundred-year-old warehouse. Most people who come here want to build something with their hands and take it home — so that's what we do, over one long, unhurried afternoon.",
      credentials: ['Shop insured', 'OSHA hand-tool safety certified']
    },
    {
      id: 'theo', name: 'Theo Marsh', location: 'Boulder, Colorado',
      tagline: 'Fifteen years on rock. Most people quit right where it gets fun.',
      color: '374a2e', joined: 2024, responseRate: 92, rating: 4.91, reviewCount: 47,
      verified: true, availableWeekdays: [1,3,5,6],
      bio: "I've been climbing since I was eleven and guiding since I was twenty. I take one person at a time up routes I actually still climb myself — this isn't a gym intro class, it's real rock, with real belay technique you'll actually need.",
      credentials: ['AMGA Single Pitch Instructor', 'Wilderness First Responder', 'Liability insurance on file']
    },
    {
      id: 'yuki', name: 'Yuki Tanaka', location: 'Kyoto, Japan',
      tagline: 'I’ve photographed these streets for eleven years. I know where the light goes at 6am.',
      color: '2c4130', joined: 2023, responseRate: 97, rating: 4.95, reviewCount: 52,
      verified: true, availableWeekdays: [1,2,3,4,5],
      bio: "I shoot editorial work during the week and walk these same backstreets on weekends with one or two people who want to actually see the city, not just its landmarks. You'll leave with your memory card full and a very sore pair of legs.",
      credentials: []
    },
    {
      id: 'marguerite', name: 'Marguerite Laurent', location: 'Paris, France',
      tagline: 'Retired literature teacher. I still correct people’s subjunctive at dinner.',
      color: '374a2e', joined: 2022, responseRate: 100, rating: 4.99, reviewCount: 73,
      verified: true, availableWeekdays: [1,2,3,4,5],
      bio: "Thirty-one years teaching French literature before I retired. Now I take one student at a time through my actual neighborhood — the boulangerie, the market, the café where I've sat every morning since 1994 — and we speak only French, mistakes included.",
      credentials: []
    },
    {
      id: 'sam', name: 'Sam Okafor', location: 'New Orleans, Louisiana',
      tagline: 'Session guitarist. I’ve played backup for people you’ve heard of.',
      color: '2c4130', joined: 2024, responseRate: 90, rating: 4.93, reviewCount: 29,
      verified: true, availableWeekdays: [4,5,6],
      bio: "I've made a living on guitar for eighteen years, mostly as a sideman. I teach the way I actually learned — by ear, in a room, with a beer close by — not off a method book.",
      credentials: []
    },
    {
      id: 'priya', name: 'Priya Nair', location: 'Portland, Oregon',
      tagline: 'Ceramicist. My hands still remember every bowl that’s ever collapsed on this wheel.',
      color: '374a2e', joined: 2023, responseRate: 96, rating: 4.97, reviewCount: 65,
      verified: true, availableWeekdays: [0,2,4,6],
      bio: "I've thrown pots for fourteen years out of a converted garage studio. I take beginners through centering clay the slow, frustrating, honest way — because that's the only way it actually sticks.",
      credentials: ['Studio insured']
    },
    {
      id: 'jake', name: 'Jake Sullivan', location: 'Austin, Texas',
      tagline: 'Former competitive powerlifter. I coach the lift, not the Instagram version of it.',
      color: '2c4130', joined: 2024, responseRate: 94, rating: 4.89, reviewCount: 41,
      verified: true, availableWeekdays: [1,2,3,4,5],
      bio: "I competed for nine years before I started coaching full-time. One-on-one, in a real gym, working on whatever is actually holding your lifts back — not a generic program.",
      credentials: ['NSCA certified strength coach', 'CPR/AED certified']
    },
    {
      id: 'ben', name: 'Ben Whitfield', location: 'Brooklyn, New York',
      tagline: 'Head bartender, fourteen years in. I’ll show you the job, not the highlight reel.',
      color: '374a2e', joined: 2023, responseRate: 93, rating: 4.94, reviewCount: 38,
      verified: true, availableWeekdays: [3,4,5],
      bio: "I run the bar program at a cocktail spot in Williamsburg. Before a shift, I take one person through what the job actually is — the prep, the math, the two hundred small decisions a night — for people genuinely weighing this career.",
      credentials: ['Responsible beverage service certified']
    },
    {
      id: 'carmen', name: 'Carmen Ruiz', location: 'Monterey, California',
      tagline: 'Amateur racer, eleven seasons at this track. I know every apex on it.',
      color: '2c4130', joined: 2024, responseRate: 91, rating: 4.97, reviewCount: 22,
      verified: true, availableWeekdays: [0,6],
      bio: "I've raced amateur circuits for over a decade. I take one driver at a time onto a real track, in a real car with a cage and a fire system, and teach the car control that street driving never will.",
      credentials: ['Track-licensed instructor', 'Vehicle safety-inspected & insured']
    },
    {
      id: 'ana', name: 'Ana Morales', location: 'Oaxaca, Mexico',
      tagline: 'My family has sold at this market for three generations.',
      color: '374a2e', joined: 2023, responseRate: 97, rating: 4.99, reviewCount: 56,
      verified: true, availableWeekdays: [0,3,5],
      bio: "I grew up between my grandmother's comal and the stalls at Mercado Benito Juárez. I walk one or two guests through the market the way I actually shop it, then we cook what we bought at my family's table.",
      credentials: []
    }
  ];

  var EXPERIENCES = [
    {
      id: 'pasta-bensonhurst', hostId: 'rosa', title: 'Sunday Pasta From Scratch',
      tagline: "You're not learning a recipe. You're getting the one thing that's never made it into a cookbook.",
      category: 'Cooking', location: 'Bensonhurst, Brooklyn', price: 145, duration: '3 hours',
      groupMax: 4, rating: 4.98, reviewCount: 34, risk: 'standard', riskTags: [],
      img: '2c4130',
      whatYoullExperience: [
        "Hand-rolling three pasta shapes from a hundred-year-old dough recipe",
        "The sauce technique my family never wrote down, taught the way it was taught to me",
        "Eating what you made, at the same table my family eats at"
      ],
      whyUnique: "There's no recipe card at the end. I teach by feel — how the dough should sound when you fold it, not a number on a scale. You won't be able to replicate it perfectly the first time, and that's the point: you're learning a relationship with dough, not a formula.",
      included: ['All ingredients', 'Apron to keep', 'Wine with the meal'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['11:00 AM', '4:00 PM']
    },
    {
      id: 'nonna-sauce', hostId: 'rosa', title: "The Sauce My Nonna Never Wrote Down",
      tagline: "Four hours, one pot, and a technique that only exists in my hands right now.",
      category: 'Cooking', location: 'Bensonhurst, Brooklyn', price: 120, duration: '2.5 hours',
      groupMax: 3, rating: 4.97, reviewCount: 27, risk: 'standard', riskTags: [],
      img: '374a2e',
      whatYoullExperience: [
        "Building a Sunday gravy from raw ingredients, the slow way",
        "The three adjustments my grandmother made that nobody else does",
        "A jar to take home, plus the confidence to make it wrong a few times on your own"
      ],
      whyUnique: "Every restaurant version of this sauce cuts a corner I don't. This is the version that takes all afternoon because it's supposed to.",
      included: ['All ingredients', 'A jar to take home'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['10:00 AM', '2:00 PM']
    },
    {
      id: 'sailing-newport', hostId: 'elin', title: 'Crew an Actual Racing Sailboat',
      tagline: "You're crewing an actual boat. I expect you to earn your spot.",
      category: 'Sailing & Water', location: 'Newport, Rhode Island', price: 310, duration: '4 hours',
      groupMax: 2, rating: 5.0, reviewCount: 21, risk: 'high', riskTags: ['Boating', 'Water sports'],
      img: '374a2e',
      whatYoullExperience: [
        "Real crew positions on a 38-foot racing sloop — trimming, tacking, and time at the helm",
        "Reading wind and water the way race crews actually do it, not a tourist version",
        "A short debrief over the boat's log of past races"
      ],
      whyUnique: "This isn't a harbor cruise. You're on a boat I still race competitively, doing a real crew job, in real conditions. Some days that means a rougher ride than you expected.",
      included: ['All safety equipment', 'Foul-weather gear if needed'],
      cancellation: 'Free cancellation up to 7 days before due to the weather-dependent nature of sailing. Inside 7 days, 50% is refunded; Elin may also propose a reschedule.',
      slots: ['9:00 AM', '1:00 PM']
    },
    {
      id: 'woodworking-redhook', hostId: 'dario', title: 'Hand-Cut Dovetail Joinery',
      tagline: "The joint my grandfather wouldn't let me touch until I was twenty-two.",
      category: 'Art & Craft', location: 'Red Hook, Brooklyn', price: 165, duration: '4 hours',
      groupMax: 2, rating: 4.96, reviewCount: 40, risk: 'standard', riskTags: ['Tools & machinery'],
      img: '2c4130',
      whatYoullExperience: [
        "Cutting a full set of hand dovetails with real chisels, no jigs",
        "Reading grain the way a cabinetmaker does before making a single cut",
        "A finished small box to take home, joints and all"
      ],
      whyUnique: "Most 'woodworking classes' use router jigs that do the joint for you. Here, you're cutting it by hand, the way it's been done in this shop for three generations, mistakes and all.",
      included: ['All materials', 'Use of hand tools', 'Finished box to take home'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['10:00 AM', '3:00 PM']
    },
    {
      id: 'climbing-boulder', hostId: 'theo', title: 'Real Rock, First Lead Climb',
      tagline: 'Most people quit right where it stops being fun and starts being climbing.',
      category: 'Specialty Hobbies', location: 'Boulder, Colorado', price: 120, duration: '5 hours',
      groupMax: 1, rating: 4.91, reviewCount: 33, risk: 'high', riskTags: ['Climbing'],
      img: '374a2e',
      whatYoullExperience: [
        "Top-rope technique on real rock in the Flatirons, not a gym wall",
        "Proper belay and fall technique you'll actually need outdoors",
        "Depending on your pace, a first supervised lead attempt"
      ],
      whyUnique: "This is one-on-one on actual rock, at the pace your body and nerves actually need — not a group intro squeezed into an hour.",
      included: ['Harness, helmet, shoes', 'All climbing hardware'],
      cancellation: 'Free cancellation up to 72 hours before given weather dependency. A signed waiver is required before the session.',
      slots: ['7:00 AM', '12:00 PM']
    },
    {
      id: 'photography-kyoto', hostId: 'yuki', title: 'Backstreets at First Light',
      tagline: 'I know where the light goes at 6am, and which alley it hits first.',
      category: 'Photography', location: 'Kyoto, Japan', price: 95, duration: '3 hours',
      groupMax: 3, rating: 4.95, reviewCount: 29, risk: 'standard', riskTags: [],
      img: '2c4130',
      whatYoullExperience: [
        "A pre-dawn walk through backstreets tourists never find",
        "Manual exposure technique built around actual changing light, not a classroom exercise",
        "A short edit session over coffee afterward, reviewing your best frames together"
      ],
      whyUnique: "There's no route sheet. Where we go depends entirely on the light and the weather that morning — the same way I still shoot for myself.",
      included: ['Route planning', 'Coffee afterward'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['5:30 AM']
    },
    {
      id: 'french-paris', hostId: 'marguerite', title: 'French, In the Neighborhood I Actually Live In',
      tagline: 'I still correct people’s subjunctive at dinner.',
      category: 'Language', location: 'Paris, France', price: 85, duration: '2.5 hours',
      groupMax: 2, rating: 4.99, reviewCount: 48, risk: 'standard', riskTags: [],
      img: '374a2e',
      whatYoullExperience: [
        "Conversation built entirely around your actual level, not a textbook chapter",
        "Ordering, chatting, and correcting mistakes live at the boulangerie and market",
        "An hour at the café where I've sat every morning since 1994"
      ],
      whyUnique: "You're not practicing dialogue from a workbook. You're using the language in the exact places I use it every day, with someone who taught it for thirty-one years and still won't let a mistake slide.",
      included: ['Coffee & pastry', 'A reading list suited to your level'],
      cancellation: 'Free cancellation up to 24 hours before. Inside 24 hours, 50% is refunded.',
      slots: ['9:00 AM', '3:00 PM']
    },
    {
      id: 'blues-guitar-nola', hostId: 'sam', title: 'Blues Guitar, By Ear',
      tagline: 'I’ve played backup for people you’ve heard of. I teach the way I actually learned.',
      category: 'Music', location: 'New Orleans, Louisiana', price: 110, duration: '2 hours',
      groupMax: 1, rating: 4.93, reviewCount: 22, risk: 'standard', riskTags: [],
      img: '2c4130',
      whatYoullExperience: [
        "Learning a full blues turnaround entirely by ear, no tabs",
        "Session-player techniques for playing behind a singer, not just soloing",
        "A short jam together at the end, recorded for you to keep"
      ],
      whyUnique: "No sheet music, no method book — just the way sidemen actually pick up songs on the bandstand, which is faster and stickier than reading dots off a page.",
      included: ['House guitar available if you don’t have one', 'A recording of your session'],
      cancellation: 'Free cancellation up to 24 hours before. Inside 24 hours, 50% is refunded.',
      slots: ['1:00 PM', '6:00 PM']
    },
    {
      id: 'ceramics-portland', hostId: 'priya', title: 'Centering Clay, the Slow Way',
      tagline: 'My hands still remember every bowl that’s ever collapsed on this wheel.',
      category: 'Art & Craft', location: 'Portland, Oregon', price: 135, duration: '3 hours',
      groupMax: 4, rating: 4.97, reviewCount: 51, risk: 'standard', riskTags: [],
      img: '374a2e',
      whatYoullExperience: [
        "Actually centering clay on the wheel — the part every beginner rushes and regrets",
        "Pulling your first real form, including the collapse that always happens first",
        "A piece bisque-fired and mailed to you a few weeks later"
      ],
      whyUnique: "I don't rescue your piece the moment it wobbles. You'll feel it collapse at least once — that failure is where the actual learning happens, and I won't shortcut you past it.",
      included: ['Clay & glaze', 'Firing & shipping of your finished piece'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['10:00 AM', '2:00 PM']
    },
    {
      id: 'strength-austin', hostId: 'jake', title: 'Fix the Lift That’s Actually Broken',
      tagline: 'I coach the lift, not the Instagram version of it.',
      category: 'Fitness', location: 'Austin, Texas', price: 90, duration: '90 minutes',
      groupMax: 1, rating: 4.89, reviewCount: 30, risk: 'high', riskTags: ['Fitness & training'],
      img: '2c4130',
      whatYoullExperience: [
        "A real diagnostic on your squat, bench, or deadlift — filmed and reviewed together",
        "Direct, unfiltered coaching cues, not generic form tips",
        "A simple two-week adjustment plan you can actually follow without a coach"
      ],
      whyUnique: "Most personal training sells you a program. This is one focused session on the one lift that's actually been stuck — with the eye of someone who competed for nine years.",
      included: ['Gym access', 'Video review of your lifts'],
      cancellation: 'Free cancellation up to 24 hours before. Inside 24 hours, 50% is refunded. A basic health waiver is required before the session.',
      slots: ['6:00 AM', '5:00 PM']
    },
    {
      id: 'bartending-nyc', hostId: 'ben', title: 'A Shift Behind the Bar, Before the Doors Open',
      tagline: "I'll show you the job, not the highlight reel.",
      category: 'Career & Skills', location: 'Williamsburg, Brooklyn', price: 175, duration: '3 hours',
      groupMax: 2, rating: 4.94, reviewCount: 26, risk: 'standard', riskTags: [],
      img: '374a2e',
      whatYoullExperience: [
        "Real pre-shift prep: batching, ice, garnish, the invisible hour before service",
        "Building three drinks from the actual menu, at actual service speed",
        "An honest conversation about what the job pays, costs, and demands"
      ],
      whyUnique: "This is for people seriously weighing bartending as work, not a novelty cocktail class. You'll leave knowing what the job actually is, good and bad.",
      included: ['All ingredients', 'The three drinks you make, to drink'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['3:00 PM']
    },
    {
      id: 'trackday-monterey', hostId: 'carmen', title: 'Real Laps, Real Track, Real Car Control',
      tagline: 'I know every apex on this track. You will not, yet.',
      category: 'Specialty Hobbies', location: 'Monterey, California', price: 450, duration: '4 hours',
      groupMax: 1, rating: 4.97, reviewCount: 18, risk: 'high', riskTags: ['Driving-related activities'],
      img: '2c4130',
      whatYoullExperience: [
        "Instructed laps in a caged, safety-inspected car with a real racing line",
        "Braking and weight-transfer technique no street course will teach you",
        "Onboard footage of your fastest laps to take home"
      ],
      whyUnique: "This isn't a ride-along. You're driving, with an amateur racer in the seat next to you who has run this exact track for eleven seasons.",
      included: ['Helmet & suit', 'Onboard footage'],
      cancellation: 'Free cancellation up to 7 days before. Inside 7 days, non-refundable due to track booking costs. A signed liability waiver and valid driver’s license are required.',
      slots: ['8:00 AM']
    },
    {
      id: 'culture-oaxaca', hostId: 'ana', title: 'Market Morning, Then Lunch at My Table',
      tagline: 'My family has sold at this market for three generations.',
      category: 'Local Culture', location: 'Oaxaca, Mexico', price: 130, duration: '4 hours',
      groupMax: 4, rating: 4.99, reviewCount: 44, risk: 'standard', riskTags: [],
      img: '374a2e',
      whatYoullExperience: [
        "Walking Mercado Benito Juárez the way locals actually shop it",
        "Choosing ingredients for a meal you'll help cook and then eat",
        "Lunch at my family's table, not a restaurant version of it"
      ],
      whyUnique: "You're not visiting a market — you're shopping it with someone whose family has sold there for three generations, then eating what a real Oaxacan Sunday actually looks like.",
      included: ['All market ingredients', 'Full lunch & drinks'],
      cancellation: 'Free cancellation up to 48 hours before. Inside 48 hours, 50% is refunded.',
      slots: ['9:00 AM']
    }
  ];

  var REVIEWS = [
    { experienceId: 'pasta-bensonhurst', author: 'Maya L.', rating: 5, date: '2026-06-02', text: "Rosa corrected my hand three times before I finally felt the dough do the thing she'd been describing. I have made it since, badly, on my own — exactly as promised." },
    { experienceId: 'pasta-bensonhurst', author: 'Dev K.', rating: 5, date: '2026-05-14', text: "We ate at her actual kitchen table with her actual family photos on the wall. Not staged, not a set." },
    { experienceId: 'pasta-bensonhurst', author: 'Han S.', rating: 4, date: '2026-04-29', text: "Ran a little long, but I didn't mind once we sat down to eat. Bring an appetite." },
    { experienceId: 'nonna-sauce', author: 'Priti A.', rating: 5, date: '2026-06-11', text: "The jar I took home lasted exactly one dinner because I couldn't stop eating it straight from the pot." },
    { experienceId: 'sailing-newport', author: 'Owen F.', rating: 5, date: '2026-05-30', text: "Elin does not coddle you. I trimmed a sail wrong and she told me plainly, then showed me once. That's the whole session, and it's exactly what I wanted." },
    { experienceId: 'sailing-newport', author: 'Grace T.', rating: 5, date: '2026-04-18', text: "Choppier than I expected and worth every bit of the waiver I signed." },
    { experienceId: 'woodworking-redhook', author: 'Marcus B.', rating: 5, date: '2026-06-20', text: "My dovetails are uneven and I am prouder of that box than anything I've bought in years." },
    { experienceId: 'woodworking-redhook', author: 'Ines P.', rating: 5, date: '2026-03-09', text: "Dario let me mess up a cut and then showed me how to work with the mistake instead of starting over. That's a lesson on its own." },
    { experienceId: 'climbing-boulder', author: 'Ravi N.', rating: 5, date: '2026-06-05', text: "Got about four feet higher than I told him I was comfortable with, in the best way. Real rock is a different animal than the gym." },
    { experienceId: 'photography-kyoto', author: 'Anneke V.', rating: 5, date: '2026-05-22', text: "We didn't see a single other tourist for two hours. My camera roll from that morning is the best of the whole trip." },
    { experienceId: 'french-paris', author: 'Colin W.', rating: 5, date: '2026-06-14', text: "She corrected my subjunctive at the boulangerie in front of the woman behind the counter. I will never make that mistake again." },
    { experienceId: 'blues-guitar-nola', author: 'Tomas R.', rating: 5, date: '2026-04-02', text: "Learned more about actual playing in two hours than three years of YouTube tutorials." },
    { experienceId: 'ceramics-portland', author: 'Sarah J.', rating: 5, date: '2026-06-08', text: "My bowl collapsed exactly like she said it would, and somehow that made the next attempt make sense." },
    { experienceId: 'strength-austin', author: 'DeShawn M.', rating: 5, date: '2026-05-11', text: "Found the exact thing that's been capping my deadlift for a year in ninety minutes." },
    { experienceId: 'bartending-nyc', author: 'Fiona C.', rating: 5, date: '2026-03-27', text: "Talked me out of quitting my job for this, honestly — which is exactly the honest conversation I was looking for." },
    { experienceId: 'trackday-monterey', author: 'Leo D.', rating: 5, date: '2026-05-03', text: "Terrifying for the first two laps, then something clicked. Carmen calls the line in your ear the whole time." },
    { experienceId: 'culture-oaxaca', author: 'Naomi H.', rating: 5, date: '2026-06-17', text: "Ana knew every vendor by name. Lunch afterward felt like being folded into her actual family for an afternoon." }
  ];

  function getExperience(id){
    return EXPERIENCES.find(function(e){ return e.id === id; });
  }
  function getHost(id){
    return HOSTS.find(function(h){ return h.id === id; });
  }
  function getExperiencesByHost(hostId){
    return EXPERIENCES.filter(function(e){ return e.hostId === hostId; });
  }
  function getReviews(experienceId){
    return REVIEWS.filter(function(r){ return r.experienceId === experienceId; });
  }
  function getHostReviews(hostId){
    var ids = getExperiencesByHost(hostId).map(function(e){ return e.id; });
    return REVIEWS.filter(function(r){ return ids.indexOf(r.experienceId) !== -1; });
  }

  window.QUALIA_DATA = {
    categories: CATEGORIES,
    hosts: HOSTS,
    experiences: EXPERIENCES,
    reviews: REVIEWS,
    getExperience: getExperience,
    getHost: getHost,
    getExperiencesByHost: getExperiencesByHost,
    getReviews: getReviews,
    getHostReviews: getHostReviews
  };

})();
