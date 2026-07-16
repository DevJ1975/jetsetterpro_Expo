// Dark-UI shadows: soft, deep, low-opacity. Android gets elevation.
// card matches iOS CardStyle: black 0.55 / radius 24 / y 12.
export const shadows = {
  card: {
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  float: {
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 24 },
    elevation: 16,
  },
  glowAccent: {
    shadowColor: '#3B9EF0', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};
export default shadows;
