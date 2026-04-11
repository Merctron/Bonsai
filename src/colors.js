import pc from 'picocolors';

// Convert RGB to 256-color palette (more compatible than true color)
function rgbTo256(r, g, b) {
  // Use 256-color palette
  if (r === g && g === b) {
    // Grayscale
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }

  // Color cube
  const r6 = Math.round(r / 255 * 5);
  const g6 = Math.round(g / 255 * 5);
  const b6 = Math.round(b / 255 * 5);
  return 16 + 36 * r6 + 6 * g6 + b6;
}

// Helper to create 256-color function from hex
function color256(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const code = rgbTo256(r, g, b);
  return (text) => `\x1b[38;5;${code}m${text}\x1b[0m`;
}

// Helper to create 256-color background function from hex
function bgColor256(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const code = rgbTo256(r, g, b);
  return (text) => `\x1b[48;5;${code}m${text}\x1b[0m`;
}

// Get the background color code without reset (using true RGB for accuracy)
function getBgCode(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Use 24-bit true color for exact color match
  return `\x1b[48;2;${r};${g};${b}m`;
}

// Get foreground color code (using true RGB)
function getFgCode(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

// Your custom color palette
export const palette = {
  background: '#30292f',
  additionLine: '#00635D',    // Teal
  deletionLine: '#8F000A',    // Dark red
};

// Background code (without reset so it persists)
export const BG_CODE = getBgCode(palette.background);
export const RESET_CODE = '\x1b[0m';

// Strip ANSI codes to get visible length
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Helper to apply background to a line while preserving internal color codes
export function applyBackground(text, terminalWidth = process.stdout.columns || 120) {
  // Replace all reset codes with reset+background reapply
  // This ensures the background persists even when colors reset
  const withBg = text.replace(/\x1b\[0m/g, `${RESET_CODE}${BG_CODE}`);

  // Calculate visible length (without ANSI codes)
  const visibleLength = stripAnsi(text).length;
  const padding = terminalWidth - visibleLength;

  // Pad to terminal width with spaces (with background color)
  const paddedText = padding > 0 ? withBg + ' '.repeat(padding) : withBg;

  return `${BG_CODE}${paddedText}${RESET_CODE}`;
}

// Your opinionated aesthetic choices
export const colors = {
  // File headers
  fileName: pc.cyan,
  fileNameBg: pc.bgCyan,
  filePath: pc.dim,

  // Diff content
  added: pc.green,
  removed: pc.red,
  lineNumber: pc.dim,
  context: pc.white,

  // Metadata
  commit: pc.yellow,
  author: pc.magenta,
  date: pc.blue,

  // Separators (need to preserve background)
  separator: (text) => `\x1b[90m${BG_CODE}${text}\x1b[0m`, // Gray with background
  border: pc.dim,

  // Custom palette colors (using true RGB for exact colors)
  // Dividers need both foreground color AND background color
  additionDivider: (text) => `${getFgCode(palette.additionLine)}${BG_CODE}${text}\x1b[0m`,
  deletionDivider: (text) => `${getFgCode(palette.deletionLine)}${BG_CODE}${text}\x1b[0m`,
  additionBar: (text) => `${getBgCode(palette.additionLine)}${text}\x1b[0m`,
  deletionBar: (text) => `${getBgCode(palette.deletionLine)}${text}\x1b[0m`,
};

export const symbols = {
  added: '+',
  removed: '-',
  context: ' ',
  divider: '│',
  horizontal: '─',
  heavyHorizontal: '━',
};
