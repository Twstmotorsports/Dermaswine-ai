/**
 * DermaSwine AI design tokens.
 *
 * Brand palette:
 *   #166534  deep green   - primary text accents, headers
 *   #22C55E  vivid green  - primary actions
 *   #DCFCE7  mint         - soft surfaces, badges
 *   #F8FAF7  off-white    - app background
 */
export const colors = {
  primary: '#166534',
  primaryDark: '#14532D',
  primaryDeep: '#0B3D1F',
  accent: '#22C55E',
  accentPressed: '#16A34A',
  light: '#DCFCE7',
  lightAlt: '#ECFDF3',
  background: '#F8FAF7',
  white: '#FFFFFF',
  text: '#12301F',
  textMuted: '#5F7266',
  textSoft: '#8AA093',
  border: '#E2EEE5',
  danger: '#DC2626',
  warning: '#F59E0B',
  info: '#0EA5E9',
  healthy: '#22C55E',
  medium: '#F59E0B',
  high: '#DC2626',
  overlay: 'rgba(11, 61, 31, 0.55)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#0B3D1F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
};

export const severityColor = (severity) => {
  switch (severity) {
    case 'none':
      return colors.healthy;
    case 'medium':
      return colors.medium;
    case 'high':
      return colors.high;
    default:
      return colors.textSoft;
  }
};

export default { colors, spacing, radius, shadow, severityColor };
