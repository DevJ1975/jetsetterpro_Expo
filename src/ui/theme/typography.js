// JetSetter Pro — type scale. Brand uses the SYSTEM face (SF Pro / Roboto).
// Display weights lean heavy (700/800) with tight tracking on large sizes.
import { palette } from './colors';

export const type = {
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: palette.text, lineHeight: 40 },
  title:   { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: palette.text, lineHeight: 34 },
  heading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: palette.text, lineHeight: 28 },
  sub:     { fontSize: 17, fontWeight: '600', color: palette.text, lineHeight: 23 },
  body:    { fontSize: 15, fontWeight: '400', color: palette.text, lineHeight: 21 },
  bodyDim: { fontSize: 15, fontWeight: '400', color: palette.dim, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', color: palette.dim, lineHeight: 18 },
  // Overline/kicker: uppercase micro-label used across the app
  overline:{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: palette.dim, textTransform: 'uppercase' },
  stat:    { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, color: palette.text },
};

export default type;
