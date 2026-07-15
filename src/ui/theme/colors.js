// JetSetter Pro — color tokens. Authoritative hex values ported 1:1 from the
// native iOS theme (`UI/Theme/JetsetterTheme.swift`, Executive appearance,
// dark). Executive-light / Cabin / Heritage palettes arrive with the
// appearance engine.
export const palette = {
  // Brand blues
  accent: '#3B9EF0',      // primary interactive (iOS executiveAccent, dark)
  bright: '#5BBAFF',      // highlights, active tab, links
  deep: '#1A72E8',        // gradient anchor, pressed states
  blueMuted: '#4E8FD4',   // iOS Colors.blue — secondary blue accents
  primaryDeep: '#1C3555', // iOS Colors.primary — filled brand surfaces

  // Backgrounds (dark-first product)
  ink: '#06070D',         // base background / hero gradient start
  bgMid: '#0D1425',       // hero gradient mid stop
  bgDeep: '#091530',      // hero gradient end stop
  background: '#10131E',  // iOS Colors.background — plain screen bg
  surface: '#13151D',     // card surface (solid fallback)
  surfaceGlass: 'rgba(22,25,41,0.82)', // glass card fill over blur
  elevated: '#161929',    // iOS Colors.surface — sheets, modals
  elevated2: '#1D2235',   // iOS Colors.surfaceElevated — inputs, wells

  // Text
  text: '#ECEEF4',        // primary on dark
  dim: '#8B92A8',         // secondary
  faint: '#5A6276',       // tertiary/captions

  // Semantic (iOS executive dark)
  good: '#1DB97D',
  warn: '#E8A020',
  bad: '#FF5C5C',         // WCAG-lightened on dark (iOS executiveDanger)

  // Lines & fills
  line: 'rgba(59,158,240,0.16)',       // accent hairline (card edges)
  lineStrong: 'rgba(59,158,240,0.28)',
  separator: '#1E2136',                // iOS Colors.separator — neutral list dividers
  fillAccent: 'rgba(59,158,240,0.10)', // tinted chip/icon wells
  fillGood: 'rgba(29,185,125,0.12)',
  fillWarn: 'rgba(232,160,32,0.12)',
  fillBad: 'rgba(255,92,92,0.14)',

  // Marketing gold (paywall crown, About wordmark — matches iOS gold accents)
  champagne: '#F4D58A',
  gold: '#DCA646',
  deepGold: '#B07A2E',
};

// Gradient stop arrays — render with expo-linear-gradient's <LinearGradient colors={...}>
export const gradients = {
  // iOS heroGradientValue(.executive): #06070D → #0D1425 @0.5 → #091530
  hero: [palette.ink, palette.bgMid, palette.bgDeep],       // bg, start {x:0,y:0} end {x:1,y:1}
  // iOS accentGradientValue(.executive): #1A72E8 → #5BBAFF @0.45 → #3A9AF0 @0.75 → #1A72E8
  brand: [palette.deep, palette.bright, '#3A9AF0', palette.deep],
  brandLocations: [0, 0.45, 0.75, 1],
  progress: [palette.deep, palette.bright],
  // iOS borderGradientValue(.executive) — glass-card edge shimmer
  cardBorder: ['rgba(59,158,240,0.30)', 'rgba(255,255,255,0.05)', 'rgba(59,158,240,0.15)'],
  // iOS Colors.cardInnerGlow — subtle depth wash inside glass cards
  cardInnerGlow: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'],
  // iOS goldGradient (heritage/marketing) — paywall + About wordmark
  goldText: ['#C68A34', palette.champagne, palette.gold],
};

export default palette;
