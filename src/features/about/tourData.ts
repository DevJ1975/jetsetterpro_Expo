/**
 * Feature-tour slides — port of iOS `AboutView.tour`. PNGs are the product
 * showcase screens copied from the iOS asset catalog
 * (Assets.xcassets/Showcase*.imageset) into assets/showcase/.
 */
export interface TourSlide {
  key: string;
  source: number;
  title: string;
  caption: string;
}

export const TOUR_SLIDES: TourSlide[] = [
  {
    key: 'home',
    source: require('../../../assets/showcase/showcase-home.png'),
    title: 'Home',
    caption: 'Your whole travel day at a glance — live flight, gate, seat and the next smart move.',
  },
  {
    key: 'disruption',
    source: require('../../../assets/showcase/showcase-disruption.png'),
    title: 'Disruption AI',
    caption: 'Delays and cancellations handled before you ask — rebookings found, hotels notified.',
  },
  {
    key: 'iris',
    source: require('../../../assets/showcase/showcase-iris.png'),
    title: 'IRIS',
    caption: 'Your proactive AI travel agent — routing, timing, loyalty and rides in real time.',
  },
  {
    key: 'wallet',
    source: require('../../../assets/showcase/showcase-wallet.png'),
    title: 'Travel Wallet',
    caption: 'Boarding passes, hotels and coverage in one elegant, always-ready place.',
  },
  {
    key: 'expenses',
    source: require('../../../assets/showcase/showcase-expenses.png'),
    title: 'Expenses',
    caption: 'Multi-currency spend tracking and one-tap expense reports on the road.',
  },
  {
    key: 'inflight',
    source: require('../../../assets/showcase/showcase-inflight.png'),
    title: 'In-Flight',
    caption: 'Live altitude, GPS position and flight-phase detection — even offline.',
  },
];
