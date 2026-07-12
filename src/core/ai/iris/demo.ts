// Canned IRIS responses for demo mode / when the backend isn't configured
// (the RN analog of IRISDemoResponses). Ordered keyword cascade; first match
// wins. Grounded to the demo "Boston Pitch Day" trip (DL2244).

function has(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function demoResponse(prompt: string): string {
  const t = prompt.toLowerCase();

  if (has(t, ['who are you', 'your name', "what's iris", 'what is iris'])) {
    return "Let's see… I'm **IRIS** — your Intelligent Routing & Itinerary Specialist. I keep an eye on your trips, flights, and spending, and I can act on them: check you in, log an expense, or pull up a screen. What can I help with?";
  }
  if (has(t, ['weather', 'rain', 'forecast', 'umbrella'])) {
    return "Let's see… **Boston** looks crisp for your Pitch Day — mid-50s°F with a light breeze. I'd pack a jacket for the evening. Want me to open the weather details?";
  }
  if (has(t, ['leave', 'depart', 'when should i', 'traffic', 'uber', 'lyft', 'drive'])) {
    return "For **DL2244** out of JFK at 9:10 AM, I'd suggest leaving by **6:35 AM** — that clears TSA PreCheck with a comfortable buffer. Want me to open Ground Transport to line up a ride?";
  }
  if (has(t, ['expense', 'submit', 'report', 'ramp', 'brex', 'divvy'])) {
    return "You've got a few expenses logged for Boston. I can **prepare** a submission to your provider — just say the word and confirm, and I'll send it. Which provider: Expensify, Ramp, Brex, or Divvy?";
  }
  if (has(t, ['pack', 'packing', 'what to bring', 'luggage list'])) {
    return "PACKING for a 2-day Boston business trip:\n• Layers — a blazer + a warm jacket\n• Chargers and a portable battery\n• Your boarding pass (DL2244, **Gate B27, Seat 1A**)\nWant me to prepare a full Smart Packing List?";
  }
  if (has(t, ['hotel', 'stay', 'room', 'newbury', 'booking'])) {
    return "You're at **The Newbury Boston** — a late check-in is on file. I'd confirm the room type on arrival. Want me to add the hotel details to your Calendar?";
  }
  if (has(t, ['flight', 'dl2244', 'delay', 'gate', 'status'])) {
    return "**DL2244 · JFK → BOS** is on time — **Gate B27, Seat 1A**, boards around 8:40 AM. I'll flag any gate changes. Want me to open Flight Tracker?";
  }
  if (has(t, ['disruption', 'cancelled', 'rebook', 'alternative', 'missed connection'])) {
    return "Nothing's disrupted right now — DL2244 is on schedule. If that changes, I'll surface rebooking options and, where eligible, the compensation you're owed. Want me to open the Disruption dashboard?";
  }
  if (has(t, ['currency', 'exchange', 'convert', 'usd'])) {
    return "Happy to convert at live rates — tell me the amount and the two currencies (e.g. “200 USD to JPY”) and I'll run it.";
  }
  if (has(t, ['tip', 'tipping', 'etiquette', 'culture'])) {
    return "In the US, **15–20%** is standard at restaurants, ~$1–2/bag for bellhops, and 15% for rideshare. Anything specific you want the local norms for?";
  }
  if (has(t, ['miles', 'points', 'skymiles', 'medallion', 'loyalty', 'status'])) {
    return "I can track your miles and status tiers once we wire up Loyalty. For now — DL2244 should post SkyMiles to your account after you fly. Want me to note your program?";
  }
  if (has(t, ['boston', 'trip', 'itinerary', 'pitch', 'meeting'])) {
    return "Your **Boston Pitch Day** runs today through the weekend:\n• ✈ **DL2244** JFK → BOS — Gate B27, Seat 1A\n• 🏨 **The Newbury Boston** — late check-in\n• ✈ DL2109 BOS → JFK on the way back\nWant me to open your Itinerary?";
  }

  return "Let's see… I'm IRIS. I can look up your trips and weather, convert currency, and prepare actions like logging an expense or checking you in. Try “when should I leave for my flight?” or “log $42 at Tatte for food.”";
}
