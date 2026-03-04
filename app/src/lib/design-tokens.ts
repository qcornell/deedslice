/**
 * DeedSlice Design System — Design Tokens
 *
 * Financial infrastructure UI. Clean, calm, institutional.
 * No confetti. No animations. No marketing energy.
 *
 * Usage: import { ds } from "@/lib/design-tokens"
 */

export const ds = {
  // ── Typography Scale ──────────────────────────────────────
  // Based on a 1.2 minor-third scale from 13px base
  type: {
    xs: "0.6875rem",     // 11px — timestamps, badges, meta
    sm: "0.75rem",       // 12px — secondary text, labels
    base: "0.8125rem",   // 13px — body text, table cells
    md: "0.875rem",      // 14px — emphasized body, card titles
    lg: "1rem",          // 16px — section headers
    xl: "1.25rem",       // 20px — page titles
    "2xl": "1.5rem",     // 24px — dashboard hero numbers
    "3xl": "2rem",       // 32px — financial figures
  },

  // ── Font Weights ──────────────────────────────────────────
  weight: {
    normal: 400,
    medium: 500,        // body emphasis, labels
    semibold: 600,      // section headers, card titles
    bold: 700,          // page titles, hero numbers only
  },

  // ── Spacing Scale ─────────────────────────────────────────
  // 4px base, consistent increments
  space: {
    px: "1px",
    0.5: "0.125rem",    // 2px
    1: "0.25rem",       // 4px
    1.5: "0.375rem",    // 6px
    2: "0.5rem",        // 8px
    3: "0.75rem",       // 12px
    4: "1rem",          // 16px
    5: "1.25rem",       // 20px
    6: "1.5rem",        // 24px
    8: "2rem",          // 32px
    10: "2.5rem",       // 40px
    12: "3rem",         // 48px
    16: "4rem",         // 64px
  },

  // ── Neutral Color Base ────────────────────────────────────
  // Slate-based neutrals for financial UI
  color: {
    // Backgrounds
    bg: {
      page: "#F8FAFC",         // slate-50 — main page bg
      card: "#FFFFFF",         // white — card surface
      elevated: "#FFFFFF",     // elevated surfaces (modals)
      subtle: "#F1F5F9",       // slate-100 — table rows, inputs
      muted: "#E2E8F0",       // slate-200 — disabled states
    },
    // Borders
    border: {
      default: "#E2E8F0",     // slate-200
      subtle: "#F1F5F9",      // slate-100 — dividers
      strong: "#CBD5E1",      // slate-300 — active inputs
    },
    // Text
    text: {
      primary: "#0F172A",     // slate-900 — headings, values
      secondary: "#475569",   // slate-600 — body text
      tertiary: "#94A3B8",    // slate-400 — meta, timestamps
      muted: "#CBD5E1",       // slate-300 — placeholders
    },
    // Semantic
    status: {
      success: "#16A34A",     // green-600
      successBg: "#F0FDF4",   // green-50
      warning: "#D97706",     // amber-600
      warningBg: "#FFFBEB",   // amber-50
      error: "#DC2626",       // red-600
      errorBg: "#FEF2F2",     // red-50
      info: "#2563EB",        // blue-600
      infoBg: "#EFF6FF",      // blue-50
    },
    // Brand (operator-overridable via CSS vars)
    brand: {
      primary: "var(--lp-primary, #0D9488)",
      secondary: "var(--lp-secondary, #0F172A)",
      accent: "var(--lp-accent, #6366F1)",
    },
  },

  // ── Border Radius ─────────────────────────────────────────
  radius: {
    sm: "6px",          // badges, small elements
    md: "8px",          // buttons, inputs
    lg: "12px",         // cards
    xl: "16px",         // modals, large cards
  },

  // ── Shadows ───────────────────────────────────────────────
  shadow: {
    sm: "0 1px 2px rgba(15,23,42,0.04)",
    md: "0 2px 4px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.03)",
    lg: "0 4px 12px rgba(15,23,42,0.08)",
  },
} as const;

// ── Status Badge Config ─────────────────────────────────────
export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot?: boolean }> = {
  live: { label: "Live", bg: "#F0FDF4", text: "#16A34A", dot: true },
  deploying: { label: "Deploying", bg: "#FFFBEB", text: "#D97706", dot: true },
  draft: { label: "Draft", bg: "#F1F5F9", text: "#64748B" },
  failed: { label: "Failed", bg: "#FEF2F2", text: "#DC2626" },
  closed: { label: "Closed", bg: "#F1F5F9", text: "#64748B" },
  distributing: { label: "Distributing", bg: "#EFF6FF", text: "#2563EB", dot: true },
  // Transfer status
  transferred: { label: "On-Chain", bg: "#F0FDF4", text: "#16A34A", dot: true },
  pending: { label: "Pending", bg: "#FFFBEB", text: "#D97706" },
  // KYC status
  verified: { label: "Verified", bg: "#F0FDF4", text: "#16A34A" },
  unverified: { label: "Unverified", bg: "#F1F5F9", text: "#94A3B8" },
  rejected: { label: "Rejected", bg: "#FEF2F2", text: "#DC2626" },
  // Distribution status
  paid: { label: "Paid", bg: "#F0FDF4", text: "#16A34A" },
  processing: { label: "Processing", bg: "#FFFBEB", text: "#D97706", dot: true },
};

// ── Button Hierarchy ────────────────────────────────────────
export const BUTTON_STYLES = {
  // Primary: solid brand color, white text
  primary: {
    bg: "var(--lp-primary, #0D9488)",
    text: "#FFFFFF",
    hoverBg: "var(--lp-primary, #0F766E)",
    shadow: "0 1px 3px rgba(13,148,136,0.2)",
  },
  // Secondary: outlined, brand border
  secondary: {
    bg: "transparent",
    text: "var(--lp-primary, #0D9488)",
    border: "var(--lp-primary, #0D9488)",
    hoverBg: "rgba(13,148,136,0.04)",
  },
  // Ghost: no border, subtle hover
  ghost: {
    bg: "transparent",
    text: "#64748B",
    hoverBg: "#F1F5F9",
    hoverText: "#0F172A",
  },
  // Danger: red outlined
  danger: {
    bg: "transparent",
    text: "#DC2626",
    border: "#FCA5A5",
    hoverBg: "#FEF2F2",
  },
} as const;

// ── Card Styles ─────────────────────────────────────────────
export const CARD_STYLES = {
  // Default card: white bg, subtle border, light shadow
  default: {
    bg: "#FFFFFF",
    border: "#E2E8F0",
    radius: "12px",
    shadow: "0 1px 2px rgba(15,23,42,0.04)",
    padding: "20px",
  },
  // Stat card: compact, for numbers
  stat: {
    bg: "#FFFFFF",
    border: "#E2E8F0",
    radius: "12px",
    shadow: "0 1px 2px rgba(15,23,42,0.04)",
    padding: "16px",
  },
  // Elevated card: for modals, popovers
  elevated: {
    bg: "#FFFFFF",
    border: "#E2E8F0",
    radius: "16px",
    shadow: "0 4px 12px rgba(15,23,42,0.08)",
    padding: "24px",
  },
} as const;
