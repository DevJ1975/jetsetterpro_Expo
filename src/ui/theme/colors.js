// JetSetter Pro — color tokens (authoritative hex values from the shipped app screens)
export const palette = {
  // Brand blues
  accent: '#3B9EF0',      // primary interactive
  bright: '#5BBAFF',      // highlights, active tab, links
  deep: '#1A72E8',        // gradient anchor, pressed states

  // Backgrounds (dark-first product)
  ink: '#06070D',         // base background
  bgMid: '#0D1425',       // hero gradient mid stop
  bgDeep: '#091530',      // hero gradient end stop
  surface: '#13151D',     // card surface
  surfaceGlass: 'rgba(22,25,41,0.82)', // glass card
  elevated: '#161929',    // sheets, modals

  // Text
  text: '#ECEEF4',        // primary on dark
  dim: '#8B92A8',         // secondary
  faint: '#5A6276',       // tertiary/captions

  // Semantic
  good: '#1DB97D',
  warn: '#E8A020',
  bad: '#E84040',

  // Lines & fills
  line: 'rgba(59,158,240,0.16)',      // hairline borders
  lineStrong: 'rgba(59,158,240,0.28)',
  fillAccent: 'rgba(59,158,240,0.10)', // tinted chip/icon wells
  fillGood: 'rgba(29,185,125,0.12)',
  fillWarn: 'rgba(232,160,32,0.12)',
  fillBad: 'rgba(232,64,64,0.14)',

  // Marketing gold (App Store / brochure surfaces only — not in-app UI)
  champagne: '#F4D58A',
  gold: '#DCA646',
  deepGold: '#B07A2E',
};

// Gradient stop arrays — render with expo-linear-gradient's <LinearGradient colors={...}>
export const gradients = {
  hero: [palette.ink, palette.bgMid, palette.bgDeep],       // bg, ~135deg (start {x:0,y:0} end {x:1,y:1})
  brand: [palette.deep, palette.bright, palette.accent],    // buttons/brand text, horizontal
  progress: [palette.deep, palette.bright],
  goldText: ['#C68A34', palette.champagne, palette.gold],   // marketing only
};

export default palette;
