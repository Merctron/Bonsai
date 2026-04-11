import hljs from 'highlight.js';
import pc from 'picocolors';

// Map file extensions to highlight.js language names
const extensionMap = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.fish': 'bash',
  '.ps1': 'powershell',
  '.r': 'r',
  '.R': 'r',
  '.sql': 'sql',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.tex': 'latex',
  '.vim': 'vim',
  '.lua': 'lua',
  '.pl': 'perl',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hrl': 'erlang',
  '.clj': 'clojure',
  '.cljs': 'clojure',
  '.dart': 'dart',
  '.dockerfile': 'dockerfile',
  '.makefile': 'makefile',
};

function getLanguageFromPath(filePath) {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return extensionMap[ext] || null;
}

// Decode HTML entities
function decodeHtmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Convert HTML-like highlight.js output to ANSI terminal colors
function convertToAnsi(htmlString) {
  // First decode entities
  let result = decodeHtmlEntities(htmlString);

  // Replace <span class="hljs-X">content</span> with colored content
  result = result
    .replace(/<span class="hljs-keyword">(.*?)<\/span>/g, (_, text) => pc.magenta(text))
    .replace(/<span class="hljs-built_in">(.*?)<\/span>/g, (_, text) => pc.cyan(text))
    .replace(/<span class="hljs-type">(.*?)<\/span>/g, (_, text) => pc.cyan(text))
    .replace(/<span class="hljs-literal">(.*?)<\/span>/g, (_, text) => pc.blue(text))
    .replace(/<span class="hljs-number">(.*?)<\/span>/g, (_, text) => pc.blue(text))
    .replace(/<span class="hljs-string">(.*?)<\/span>/g, (_, text) => pc.green(text))
    .replace(/<span class="hljs-regexp">(.*?)<\/span>/g, (_, text) => pc.red(text))
    .replace(/<span class="hljs-comment">(.*?)<\/span>/g, (_, text) => pc.dim(text))
    .replace(/<span class="hljs-doctag">(.*?)<\/span>/g, (_, text) => pc.dim(text))
    .replace(/<span class="hljs-meta">(.*?)<\/span>/g, (_, text) => pc.gray(text))
    .replace(/<span class="hljs-section">(.*?)<\/span>/g, (_, text) => pc.yellow(text))
    .replace(/<span class="hljs-title">(.*?)<\/span>/g, (_, text) => pc.yellow(text))
    .replace(/<span class="hljs-name">(.*?)<\/span>/g, (_, text) => pc.yellow(text))
    .replace(/<span class="hljs-function">(.*?)<\/span>/g, (_, text) => text) // Keep function content, process inner spans
    .replace(/<span class="hljs-params">(.*?)<\/span>/g, (_, text) => pc.white(text))
    .replace(/<span class="hljs-attr">(.*?)<\/span>/g, (_, text) => pc.cyan(text))
    .replace(/<span class="hljs-attribute">(.*?)<\/span>/g, (_, text) => pc.cyan(text))
    .replace(/<span class="hljs-variable">(.*?)<\/span>/g, (_, text) => pc.white(text))
    .replace(/<span class="hljs-symbol">(.*?)<\/span>/g, (_, text) => pc.blue(text))
    .replace(/<span class="hljs-class">(.*?)<\/span>/g, (_, text) => text) // Keep class content, process inner spans
    .replace(/<span class="[^"]*">(.*?)<\/span>/g, (_, text) => text); // Remove any remaining spans

  return result;
}

export function highlightCode(code, filePath) {
  const language = getLanguageFromPath(filePath);

  if (!language) {
    return code;
  }

  try {
    const result = hljs.highlight(code, { language, ignoreIllegals: true });
    return convertToAnsi(result.value);
  } catch (error) {
    // If highlighting fails, return the original code
    return code;
  }
}
