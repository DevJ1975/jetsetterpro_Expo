// JetSetter Pro — type scale, mirroring iOS `JetsetterTheme.Typography`:
// large titles, metrics, and kickers render in the ROUNDED brand face
// (SF Rounded on iOS-native ≙ Nunito here); card titles, body, and captions
// stay on the system face (SF Pro / Roboto), exactly like the native app.
//
// Weight lives in the font file (one family name per weight), so tokens with a
// `fontFamily` deliberately omit `fontWeight` — setting both fake-bolds on
// Android.
import { palette } from './colors';
import { fonts } from './fonts';

export const type = {
  // iOS heroTitle: .largeTitle rounded bold. Tabular figures so big numbers
  // (counters, prices) don't reflow as glyph widths change.
  display: { fontFamily: fonts.rounded.extrabold, fontSize: 34, letterSpacing: -0.8, color: palette.text, lineHeight: 42, fontVariant: ['tabular-nums'] },
  // iOS displayTitle: .title rounded bold
  title:   { fontFamily: fonts.rounded.bold, fontSize: 28, letterSpacing: -0.5, color: palette.text, lineHeight: 36 },
  // iOS pageTitle: .title2 rounded bold
  heading: { fontFamily: fonts.rounded.bold, fontSize: 22, letterSpacing: -0.3, color: palette.text, lineHeight: 29 },
  // iOS cardTitle: .headline SYSTEM semibold (not rounded)
  sub:     { fontSize: 17, fontWeight: '600', color: palette.text, lineHeight: 23 },
  body:    { fontSize: 15, fontWeight: '400', color: palette.text, lineHeight: 21 },
  bodyDim: { fontSize: 15, fontWeight: '400', color: palette.dim, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', color: palette.dim, lineHeight: 18 },
  // Overline/kicker — iOS label: .caption rounded semibold, uppercase
  overline:{ fontFamily: fonts.rounded.bold, fontSize: 11, letterSpacing: 1.6, lineHeight: 14, color: palette.dim, textTransform: 'uppercase' },
  // iOS metric: .largeTitle rounded bold — big animated numbers, stat tiles.
  // Tabular figures for jitter-free count-ups.
  stat:    { fontFamily: fonts.rounded.extrabold, fontSize: 24, letterSpacing: -0.4, lineHeight: 28, color: palette.text, fontVariant: ['tabular-nums'] },
};

export default type;
