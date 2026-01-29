import crypto from 'crypto';

export interface ParsedQuote {
  content: string;
  contentHash: string;
  relatedQuotes: string[];
}

export interface ParseResult {
  quotes: ParsedQuote[];
  stats: {
    totalLines: number;
    quotesFound: number;
    relatedChains: number;
  };
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isRelatedLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.startsWith('related:') ||
    lower.startsWith('related.') ||
    lower.startsWith('related corollary:') ||
    lower.startsWith('relatedly related:') ||
    lower.startsWith('corollary:')
  );
}

function cleanQuoteLine(line: string): string {
  return line
    .trim()
    .replace(/^-\s+/, ''); // Remove leading "- "
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.length === 0) return true;
  if (/^[-*_]{3,}$/.test(trimmed)) return true; // Horizontal dividers
  if (trimmed.startsWith('<!--')) return true; // HTML comment start
  if (trimmed === '-->') return true; // HTML comment end
  if (trimmed.startsWith('#')) return true; // Markdown headings

  return false;
}

export function parseWisdomMarkdown(markdown: string): ParseResult {
  const lines = markdown.split('\n');
  const quotes: ParsedQuote[] = [];
  let totalLines = lines.length;
  let relatedChains = 0;

  // Find the "The Wisdom so far" section
  const wisdomStartIndex = lines.findIndex((line) =>
    /the wisdom so far/i.test(line)
  );

  if (wisdomStartIndex === -1) {
    return {
      quotes: [],
      stats: { totalLines, quotesFound: 0, relatedChains: 0 },
    };
  }

  // Find the "Works Cited" section (end of quotes)
  let wisdomEndIndex = lines.findIndex(
    (line, idx) => idx > wisdomStartIndex && /works cited/i.test(line)
  );

  if (wisdomEndIndex === -1) {
    wisdomEndIndex = lines.length;
  }

  // Extract wisdom lines
  const wisdomLines = lines.slice(wisdomStartIndex + 1, wisdomEndIndex);

  let currentQuote: ParsedQuote | null = null;

  for (const line of wisdomLines) {
    if (shouldSkipLine(line)) {
      continue;
    }

    const cleaned = cleanQuoteLine(line);

    if (cleaned.length === 0) {
      continue;
    }

    if (isRelatedLine(cleaned)) {
      // This is a "Related:" line - append to current quote's content
      if (currentQuote) {
        // Keep the full line including "Related:" prefix
        currentQuote.content += '\n' + cleaned;
        // Update the hash to reflect the new content
        currentQuote.contentHash = hashContent(currentQuote.content);
        // Store the full line (with "Related:" prefix) for chain tracking
        currentQuote.relatedQuotes.push(cleaned);
      }
    } else {
      // This is a new main quote
      // Save the previous quote if exists
      if (currentQuote) {
        quotes.push(currentQuote);
        if (currentQuote.relatedQuotes.length > 0) {
          relatedChains++;
        }
      }

      currentQuote = {
        content: cleaned,
        contentHash: hashContent(cleaned),
        relatedQuotes: [],
      };
    }
  }

  // Don't forget the last quote
  if (currentQuote) {
    quotes.push(currentQuote);
    if (currentQuote.relatedQuotes.length > 0) {
      relatedChains++;
    }
  }

  return {
    quotes,
    stats: {
      totalLines,
      quotesFound: quotes.length,
      relatedChains,
    },
  };
}

// Convert markdown inline formatting to HTML (matching client-side logic)
export function markdownToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`([^`]+)`/g, '<code>$1</code>') // Inline code
    .replace(/~~(.*?)~~/g, '<s>$1</s>'); // Strikethrough
}
