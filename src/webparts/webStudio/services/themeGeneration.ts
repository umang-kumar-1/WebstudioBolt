import { ThemeConfig } from "../types";
import { DEFAULT_THEME } from "../store";

export const THEME_VARIABLE_KEYS = Object.keys(DEFAULT_THEME);

const THEME_VARIABLE_GUIDE: Record<string, string> = {
  "--primary-color": "Main brand color (hex, e.g. #2f5596)",
  "--secondary-color": "Darker complementary brand color (hex)",
  "--brand-light": "Light tint of primary for subtle backgrounds (hex)",
  "--brand-dark": "Dark shade of primary for emphasis (hex)",
  "--gradient-primary": "CSS linear-gradient using primary and secondary colors",
  "--text-primary": "Main body text color (hex)",
  "--text-secondary": "Muted/secondary text color (hex)",
  "--text-on-primary": "Text on primary-colored backgrounds (hex, usually #ffffff)",
  "--link-color": "Hyperlink color (hex)",
  "--link-hover-color": "Hyperlink hover color (hex)",
  "--bg-body": "Page background (hex)",
  "--bg-hover": "Hover background tint (hex)",
  "--btn-primary-bg": "Primary button background (hex)",
  "--btn-primary-text": "Primary button label color (hex)",
  "--btn-primary-hover-bg": "Primary button hover background (hex)",
  "--btn-secondary-bg": "Secondary button background (hex)",
  "--btn-secondary-text": "Secondary button label color (hex)",
  "--btn-padding-y": "Button vertical padding (e.g. 0.5rem)",
  "--btn-padding-x": "Button horizontal padding (e.g. 1.25rem)",
  "--btn-font-size": "Button font size (e.g. 14px)",
  "--add-section-btn-bg": "Add-section button background (hex)",
  "--add-section-btn-text": "Add-section button text (hex)",
  "--add-section-btn-hover-bg": "Add-section button hover (hex)",
  "--add-section-btn-font-size": "Add-section button font size (e.g. 12px)",
  "--add-section-btn-padding-x": "Add-section button horizontal padding (e.g. 0.75rem)",
  "--add-section-btn-padding-y": "Add-section button vertical padding (e.g. 0.35rem)",
  "--add-section-line-color": "Add-section divider line color (hex)",
  "--add-section-line-thickness": "Add-section line thickness (e.g. 2px)",
  "--status-success": "Success state color (hex green)",
  "--status-warning": "Warning state color (hex amber)",
  "--status-error": "Error state color (hex red)",
  "--border-radius-sm": "Small border radius (e.g. 4px or 0px)",
  "--border-radius-md": "Medium border radius (e.g. 8px or 0px)",
  "--border-radius-lg": "Large border radius (e.g. 12px or 0px)",
  "--border-color": "Default UI border color (hex)",
  "--font-import-url": "Google Fonts import URL or empty string",
  "--font-import-url-2": "Second font import URL or empty string",
  "--font-family-base": "Body font stack (CSS font-family value)",
  "--font-family-secondary": "Heading font stack (CSS font-family value)",
  "--font-family-nav": "Navigation font stack (CSS font-family value)",
  "--heading-color": "Default heading color (hex)",
  "--heading-h1-color": "H1 color (hex)",
  "--heading-h2-color": "H2 color (hex)",
  "--heading-h3-color": "H3 color (hex)",
  "--heading-h4-color": "H4 color (hex)",
  "--heading-h5-color": "H5 color (hex)",
  "--heading-h6-color": "H6 color (hex)",
  "--font-size-base": "Base font size (e.g. 14px)",
  "--font-size-p": "Paragraph font size (e.g. 14px)",
  "--font-size-h1": "H1 size (e.g. 42px)",
  "--font-size-h2": "H2 size (e.g. 32px)",
  "--font-size-h3": "H3 size (e.g. 24px)",
  "--font-size-h4": "H4 size (e.g. 20px)",
  "--font-size-h5": "H5 size (e.g. 16px)",
  "--font-size-h6": "H6 size (e.g. 14px)",
  "--font-weight-bold": "Bold weight (e.g. 600 or 700)",
  "--icon-color": "Default icon color (hex)",
  "--edit-icon-bg": "Edit icon background (hex)",
  "--edit-icon-color": "Edit icon glyph color (hex)",
  "--edit-icon-hover-bg": "Edit icon hover background (hex)",
  "--sidebar-bg": "Sidebar background (hex)",
  "--sidebar-text": "Sidebar text (hex)",
  "--sidebar-text-muted": "Sidebar muted text (hex)",
  "--sidebar-border-color": "Sidebar border (hex)",
  "--sidebar-icon-color": "Sidebar icon color (hex)",
  "--sidebar-link-color": "Sidebar link color (hex)",
  "--sidebar-link-hover-color": "Sidebar link hover (hex)",
  "--sidebar-active-bg": "Active sidebar item background (hex)",
  "--sidebar-active-text-color": "Active sidebar text (hex)",
  "--sidebar-active-indicator-color": "Active sidebar indicator (hex)",
  "--sidebar-hover-bg": "Sidebar item hover background (hex)",
  "--sidebar-button-color": "Sidebar button/accent (hex)",
  "--header-bg": "Header background (hex)",
  "--footer-bg": "Footer background (hex)",
  "--logo-width": "Logo width (e.g. 150px)",
  "--footer-heading-color": "Footer heading text (hex)",
  "--footer-text-color": "Footer body/link text (hex)"
};

const isHexColor = (value: string | undefined): boolean =>
  !!value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());

const normalizeHex = (hex: string): string => {
  const value = hex.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return value;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (!isHexColor(hex)) return null;
  const normalized = normalizeHex(hex).slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
};

const mixHex = (hex: string, target: { r: number; g: number; b: number }, amount: number): string => {
  const source = hexToRgb(hex);
  if (!source) return hex;
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    source.r + (target.r - source.r) * ratio,
    source.g + (target.g - source.g) * ratio,
    source.b + (target.b - source.b) * ratio
  );
};

const lightenHex = (hex: string, amount: number): string => mixHex(hex, { r: 255, g: 255, b: 255 }, amount);
const darkenHex = (hex: string, amount: number): string => mixHex(hex, { r: 0, g: 0, b: 0 }, amount);

const pickHex = (...candidates: Array<string | undefined>): string | undefined => {
  for (const candidate of candidates) {
    if (candidate && isHexColor(candidate)) return normalizeHex(candidate);
  }
  return undefined;
};

const buildVariableGuide = (): string =>
  THEME_VARIABLE_KEYS.map((key) => `- ${key}: ${THEME_VARIABLE_GUIDE[key] || "CSS value"}`).join("\n");

const buildJsonSkeleton = (): string => {
  const skeleton: Record<string, string> = {};
  THEME_VARIABLE_KEYS.forEach((key) => {
    skeleton[key] = "";
  });
  return JSON.stringify(skeleton, null, 2);
};

export const buildThemeGenerationQuery = (userPrompt: string): string => `
You are an expert UI/UX designer and CSS architect for a SharePoint website builder.
The user describes a mood/style. You must produce a COMPLETE theme as one JSON object.

CRITICAL RULES:
1. Return EVERY key listed below — no omissions. The response must include all ${THEME_VARIABLE_KEYS.length} keys.
2. Use concrete hex colors (#rrggbb) for every color field. Never use var(...) references.
3. Choose font stacks that match the mood (e.g. serif for classic, sans-serif for modern).
4. Set typography sizes and border radii to match the style (sharp for corporate, rounded for friendly).
5. Ensure WCAG-friendly contrast between text and backgrounds.
6. Derive related tokens coherently (buttons, sidebar, footer, links, icons should match the palette).
7. Return ONLY valid JSON. No markdown fences, no comments, no explanations.

REQUIRED KEYS AND FORMATS:
${buildVariableGuide()}

JSON SKELETON (fill every value):
${buildJsonSkeleton()}

USER MOOD / STYLE REQUEST:
"${userPrompt.trim()}"
`.trim();

export const extractJsonFromAiText = (text: string): Record<string, unknown> => {
  const cleaned = text.replace(/```json\s*|```/gi, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error("AI theme response did not contain valid JSON.");
};

const normalizeAiTheme = (raw: Record<string, unknown>): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    const stringValue = String(value).trim();
    if (!stringValue) return;
    normalized[key.toLowerCase()] = stringValue;
  });
  return normalized;
};

const resolveVarReferences = (theme: Record<string, string>): Record<string, string> => {
  const resolved = { ...theme };
  let changed = true;
  let passes = 0;

  while (changed && passes < 8) {
    changed = false;
    passes += 1;
    Object.keys(resolved).forEach((key) => {
      const value = resolved[key];
      const match = value.match(/^var\((--[^)]+)\)$/i);
      if (!match) return;
      const referenced = resolved[match[1].toLowerCase()];
      if (referenced && referenced !== value) {
        resolved[key] = referenced;
        changed = true;
      }
    });
  }

  return resolved;
};

type ThemePalette = {
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  bgBody: string;
  headingColor: string;
};

const buildPalette = (theme: Record<string, string>): ThemePalette => {
  const primary =
    pickHex(theme["--primary-color"]) ||
    pickHex(theme["--link-color"], theme["--btn-primary-bg"], theme["--icon-color"]) ||
    "#2f5596";

  const secondary =
    pickHex(theme["--secondary-color"], theme["--brand-dark"], theme["--link-hover-color"]) ||
    darkenHex(primary, 0.18);

  const textPrimary = pickHex(theme["--text-primary"], theme["--heading-color"]) || "#1f2937";
  const textSecondary = pickHex(theme["--text-secondary"]) || lightenHex(textPrimary, 0.35);
  const bgBody = pickHex(theme["--bg-body"], theme["--header-bg"]) || "#ffffff";
  const headingColor = pickHex(theme["--heading-color"], theme["--heading-h1-color"]) || textPrimary;

  return { primary, secondary, textPrimary, textSecondary, bgBody, headingColor };
};

const deriveThemeValue = (
  key: string,
  theme: Record<string, string>,
  palette: ThemePalette
): string | undefined => {
  switch (key) {
    case "--primary-color":
      return palette.primary;
    case "--secondary-color":
      return palette.secondary;
    case "--brand-light":
      return lightenHex(palette.primary, 0.88);
    case "--brand-dark":
      return darkenHex(palette.primary, 0.22);
    case "--gradient-primary":
      return `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)`;
    case "--text-primary":
      return palette.textPrimary;
    case "--text-secondary":
      return palette.textSecondary;
    case "--text-on-primary":
      return "#ffffff";
    case "--link-color":
      return palette.primary;
    case "--link-hover-color":
      return palette.secondary;
    case "--bg-body":
      return palette.bgBody;
    case "--bg-hover":
      return lightenHex(palette.primary, 0.93);
    case "--btn-primary-bg":
    case "--add-section-btn-bg":
    case "--add-section-line-color":
    case "--icon-color":
    case "--edit-icon-bg":
    case "--sidebar-icon-color":
    case "--sidebar-link-color":
    case "--sidebar-active-text-color":
    case "--sidebar-active-indicator-color":
    case "--sidebar-button-color":
      return palette.primary;
    case "--btn-primary-text":
    case "--add-section-btn-text":
    case "--edit-icon-color":
      return "#ffffff";
    case "--btn-primary-hover-bg":
    case "--add-section-btn-hover-bg":
    case "--edit-icon-hover-bg":
      return darkenHex(palette.primary, 0.12);
    case "--btn-secondary-bg":
      return palette.bgBody;
    case "--btn-secondary-text":
      return palette.textPrimary;
    case "--heading-color":
      return palette.headingColor;
    case "--heading-h1-color":
    case "--heading-h2-color":
    case "--heading-h3-color":
    case "--heading-h4-color":
    case "--heading-h5-color":
    case "--heading-h6-color":
      return palette.headingColor;
    case "--header-bg":
      return palette.bgBody;
    case "--footer-bg":
      return palette.secondary;
    case "--footer-heading-color":
      return "#ffffff";
    case "--footer-text-color":
      return lightenHex(palette.secondary, 0.75);
    case "--sidebar-bg":
      return palette.bgBody;
    case "--sidebar-text":
      return palette.textPrimary;
    case "--sidebar-text-muted":
      return palette.textSecondary;
    case "--sidebar-border-color":
      return lightenHex(palette.textPrimary, 0.8);
    case "--sidebar-link-hover-color":
      return palette.secondary;
    case "--sidebar-active-bg":
      return lightenHex(palette.primary, 0.9);
    case "--sidebar-hover-bg":
      return lightenHex(palette.textPrimary, 0.95);
    case "--status-success":
      return "#16a34a";
    case "--status-warning":
      return "#f59e0b";
    case "--status-error":
      return "#dc2626";
    case "--border-color":
      return lightenHex(palette.textPrimary, 0.78);
    case "--font-import-url":
    case "--font-import-url-2":
      return "";
    default:
      return undefined;
  }
};

const hasConcreteValue = (key: string, value: string | undefined): boolean => {
  if (!value) return false;
  if (value.match(/^var\(/i)) return false;
  if (key.includes("color") || key.includes("-bg") || key.includes("brand-") || key.startsWith("--text-")) {
    return isHexColor(value) || value.includes("gradient");
  }
  return true;
};

export const completeThemeFromAiPartial = (partial: Record<string, string>): ThemeConfig => {
  const resolved = resolveVarReferences(partial);
  const palette = buildPalette(resolved);
  const completed: ThemeConfig = {};

  THEME_VARIABLE_KEYS.forEach((key) => {
    const existing = resolved[key];
    if (hasConcreteValue(key, existing)) {
      completed[key] = existing!;
      return;
    }

    const derived = deriveThemeValue(key, resolved, palette);
    completed[key] = derived ?? DEFAULT_THEME[key] ?? "";
  });

  return completed;
};

export const parseAndCompleteThemeFromAiResponse = (text: string): ThemeConfig => {
  const raw = extractJsonFromAiText(text);
  const normalized = normalizeAiTheme(raw);
  return completeThemeFromAiPartial(normalized);
};
