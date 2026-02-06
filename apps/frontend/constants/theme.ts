/**
 * AbiPago Theme — colors, spacing, and typography constants.
 * Derived from the stitch design system (dark-first, lime-green primary).
 */

import { Platform } from 'react-native';

/* ─── Color Palette ───────────────────────────────────────────────── */

export const C = {
  primary: '#A1E633',
  primaryDark: '#1B2112',

  bgDark: '#0B0F17',
  bgDarkAlt: '#1B2111',

  surfaceDark: '#111827',
  cardDark: '#252B1B',
  inputDark: '#313C23',
  surfaceDarker: '#14180F',

  borderDark: '#1F2937',
  borderLight: 'rgba(255,255,255,0.05)',

  white: '#FFFFFF',
  black: '#000000',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.4)',
  textMuted: 'rgba(255,255,255,0.3)',

  success: '#4ADE80',
  info: '#12AAFF',
  warning: '#FBBF24',
  error: '#EF4444',

  blue400: '#60A5FA',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  red500: '#EF4444',

  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
};

/* ─── Legacy Colors (ThemedText/ThemedView compat) ────────────────── */

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: C.primary,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: C.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: C.bgDark,
    tint: C.primary,
    icon: '#9BA1A6',
    tabIconDefault: '#6B7280',
    tabIconSelected: C.primary,
  },
};

/* ─── Spacing / Radius ────────────────────────────────────────────── */

export const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const R = { sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, full: 9999 };

/* ─── Fonts ───────────────────────────────────────────────────────── */

export const Fonts = Platform.select({
  ios: { sans: 'System', mono: 'Menlo' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: "Inter, system-ui, sans-serif", mono: "SFMono-Regular, monospace" },
});
