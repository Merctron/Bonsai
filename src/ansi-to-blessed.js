// Convert ANSI color codes to blessed tags
export function ansiToBlessed(text) {
  return text
    // Foreground colors
    .replace(/\x1b\[31m/g, '{red-fg}')
    .replace(/\x1b\[32m/g, '{green-fg}')
    .replace(/\x1b\[33m/g, '{yellow-fg}')
    .replace(/\x1b\[34m/g, '{blue-fg}')
    .replace(/\x1b\[35m/g, '{magenta-fg}')
    .replace(/\x1b\[36m/g, '{cyan-fg}')
    .replace(/\x1b\[37m/g, '{white-fg}')
    .replace(/\x1b\[90m/g, '{gray-fg}')

    // Bright foreground colors
    .replace(/\x1b\[91m/g, '{red-fg}')
    .replace(/\x1b\[92m/g, '{green-fg}')
    .replace(/\x1b\[93m/g, '{yellow-fg}')
    .replace(/\x1b\[94m/g, '{blue-fg}')
    .replace(/\x1b\[95m/g, '{magenta-fg}')
    .replace(/\x1b\[96m/g, '{cyan-fg}')
    .replace(/\x1b\[97m/g, '{white-fg}')

    // 256 color codes (common ones)
    .replace(/\x1b\[38;5;(\d+)m/g, (match, code) => {
      // Map some common codes to blessed colors
      const colorMap = {
        '0': 'black',
        '1': 'red',
        '2': 'green',
        '3': 'yellow',
        '4': 'blue',
        '5': 'magenta',
        '6': 'cyan',
        '7': 'white',
        '8': 'gray',
        '9': 'red',
        '10': 'green',
        '11': 'yellow',
        '12': 'blue',
        '13': 'magenta',
        '14': 'cyan',
        '15': 'white'
      };
      const color = colorMap[code] || 'white';
      return `{${color}-fg}`;
    })

    // RGB color codes - just use white as blessed doesn't support true color well
    .replace(/\x1b\[38;2;\d+;\d+;\d+m/g, '{white-fg}')
    .replace(/\x1b\[48;2;\d+;\d+;\d+m/g, '')

    // Text styles
    .replace(/\x1b\[1m/g, '{bold}')
    .replace(/\x1b\[2m/g, '{dim}')
    .replace(/\x1b\[3m/g, '{italic}')
    .replace(/\x1b\[4m/g, '{underline}')

    // Reset codes
    .replace(/\x1b\[0m/g, '{/}')
    .replace(/\x1b\[22m/g, '{/bold}')
    .replace(/\x1b\[23m/g, '{/italic}')
    .replace(/\x1b\[24m/g, '{/underline}')

    // Remove any remaining ANSI codes
    .replace(/\x1b\[[0-9;]*m/g, '');
}
