import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ReactNode, ComponentPropsWithoutRef } from 'react';

// Obsidian callout type styling with dark mode support
const CALLOUT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; titleColor: string; textColor: string }
> = {
  abstract: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-400 dark:border-purple-500',
    icon: '📋',
    titleColor: 'text-purple-800 dark:text-purple-200',
    textColor: 'text-purple-900 dark:text-purple-100',
  },
  emphasis: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-400 dark:border-amber-500',
    icon: '✨',
    titleColor: 'text-amber-800 dark:text-amber-200',
    textColor: 'text-amber-900 dark:text-amber-100',
  },
  note: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-400 dark:border-blue-500',
    icon: '📝',
    titleColor: 'text-blue-800 dark:text-blue-200',
    textColor: 'text-blue-900 dark:text-blue-100',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-400 dark:border-blue-500',
    icon: 'ℹ️',
    titleColor: 'text-blue-800 dark:text-blue-200',
    textColor: 'text-blue-900 dark:text-blue-100',
  },
  tip: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-400 dark:border-green-500',
    icon: '💡',
    titleColor: 'text-green-800 dark:text-green-200',
    textColor: 'text-green-900 dark:text-green-100',
  },
  example: {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-400 dark:border-slate-500',
    icon: '📖',
    titleColor: 'text-slate-800 dark:text-slate-200',
    textColor: 'text-slate-900 dark:text-slate-100',
  },
  question: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/30',
    border: 'border-yellow-400 dark:border-yellow-500',
    icon: '❓',
    titleColor: 'text-yellow-800 dark:text-yellow-200',
    textColor: 'text-yellow-900 dark:text-yellow-100',
  },
  quote: {
    bg: 'bg-gray-50 dark:bg-gray-700/50',
    border: 'border-gray-400 dark:border-gray-500',
    icon: '💬',
    titleColor: 'text-gray-800 dark:text-gray-200',
    textColor: 'text-gray-900 dark:text-gray-100',
  },
  warning: {
    bg: 'bg-orange-50 dark:bg-orange-900/30',
    border: 'border-orange-400 dark:border-orange-500',
    icon: '⚠️',
    titleColor: 'text-orange-800 dark:text-orange-200',
    textColor: 'text-orange-900 dark:text-orange-100',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-400 dark:border-red-500',
    icon: '🚨',
    titleColor: 'text-red-800 dark:text-red-200',
    textColor: 'text-red-900 dark:text-red-100',
  },
  bug: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-400 dark:border-red-500',
    icon: '🐛',
    titleColor: 'text-red-800 dark:text-red-200',
    textColor: 'text-red-900 dark:text-red-100',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-400 dark:border-green-500',
    icon: '✅',
    titleColor: 'text-green-800 dark:text-green-200',
    textColor: 'text-green-900 dark:text-green-100',
  },
  failure: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-400 dark:border-red-500',
    icon: '❌',
    titleColor: 'text-red-800 dark:text-red-200',
    textColor: 'text-red-900 dark:text-red-100',
  },
};

// Default style for unknown callout types
const DEFAULT_CALLOUT_STYLE = {
  bg: 'bg-gray-50 dark:bg-gray-700/50',
  border: 'border-gray-400 dark:border-gray-500',
  icon: '📌',
  titleColor: 'text-gray-800 dark:text-gray-200',
  textColor: 'text-gray-900 dark:text-gray-100',
};

interface CalloutBlockProps {
  type: string;
  title: string;
  children: ReactNode;
}

export function CalloutBlock({ type, title, children }: CalloutBlockProps) {
  const style = CALLOUT_STYLES[type.toLowerCase()] || DEFAULT_CALLOUT_STYLE;

  return (
    <div
      className={`${style.bg} ${style.border} border-l-4 rounded-r-lg p-4 my-4`}
    >
      <div className={`font-semibold ${style.titleColor} flex items-center gap-2 mb-2`}>
        <span>{style.icon}</span>
        <span>{title || type.charAt(0).toUpperCase() + type.slice(1)}</span>
      </div>
      <div className={style.textColor}>{children}</div>
    </div>
  );
}

// Parse blockquote content to detect Obsidian callouts
// Format: > [!type] Optional Title
// Content continues on following lines starting with >
function parseCalloutFromChildren(children: ReactNode): {
  type: string;
  title: string;
  content: ReactNode;
} | null {
  // Convert children to array for easier processing
  const childArray = Array.isArray(children) ? children : [children];

  // Look for the callout marker in the first element
  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];
    if (child && typeof child === 'object' && 'props' in child) {
      // Only extract text for pattern matching - NOT for rendering
      const textContent = extractTextContent(child);
      // Match [!type] and capture title
      const calloutMatch = textContent.match(/^\[!(\w+)\]\s*(.*)/s);

      if (calloutMatch) {
        const [, type, restOfContent] = calloutMatch;

        // Extract title from the text - just the first line before newline
        // Title detection is text-based, but content will preserve React elements
        const newlineIdx = restOfContent.indexOf('\n');
        let title = '';

        if (newlineIdx > 0 && newlineIdx < 80) {
          title = restOfContent.substring(0, newlineIdx).trim();
        } else if (restOfContent.length < 80 && !restOfContent.includes('.')) {
          // Short text without period - likely just a title
          title = restOfContent.trim();
        } else {
          // Fallback: use type as title
          title = type.charAt(0).toUpperCase() + type.slice(1);
        }

        // IMPORTANT: Use original React children for content to preserve KaTeX rendering
        // Skip the first child (which contains [!type]) and use remaining children
        const otherChildren = childArray.slice(i + 1);

        // The content is all children after the first one (which has the [!type] marker)
        // This preserves all React elements including KaTeX-rendered math
        return { type, title, content: otherChildren };
      }
    }
  }

  return null;
}

// Extract text content from React nodes
function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }

  // Check if it's a React element with props
  if (React.isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractTextContent(props.children);
  }

  return '';
}

// Preprocess markdown to fix common issues from LLM output
function preprocessMarkdown(markdown: string): string {
  let processed = markdown;

  // Fix 1: Restore LaTeX backslashes that were incorrectly parsed as JSON escape sequences
  // When LLM outputs unescaped LaTeX commands in JSON, backslash + letter becomes control characters:
  // - \b (backspace, ASCII 8) affects: \beta, \bf, \binom, etc.
  // - \f (form-feed, ASCII 12) affects: \frac, \forall, etc.
  // - \n (newline, ASCII 10) affects: \nu, \nabla, etc.
  // - \r (carriage return, ASCII 13) affects: \rightarrow, \rho, etc.
  // - \t (tab, ASCII 9) affects: \times, \theta, \tau, \text, etc.
  //
  // We only fix the most common patterns that are unlikely to have false positives.
  // Control characters like form-feed (0x0C) followed by "rac" almost never occur naturally.

  /* eslint-disable no-control-regex */
  // \f (form-feed, 0x0C) patterns - safe, form-feed is rare in markdown
  processed = processed.replace(/\x0Crac/g, '\\frac');
  processed = processed.replace(/\x0Corall/g, '\\forall');

  // \t (tab, 0x09) patterns - only fix within likely math contexts
  // "tab + imes" is unlikely in normal text (would be "   imes" not a word)
  processed = processed.replace(/\x09imes\b/g, '\\times');
  // "tab + heta" followed by math/word boundary
  processed = processed.replace(/\x09heta\b/g, '\\theta');
  processed = processed.replace(/\x09au\b/g, '\\tau');
  // \text{ is distinctive enough
  processed = processed.replace(/\x09ext\{/g, '\\text{');
  processed = processed.replace(/\x09extbf\{/g, '\\textbf{');

  // \r (carriage return, 0x0D) patterns - CR is rare in web content
  processed = processed.replace(/\x0Dightarrow/g, '\\rightarrow');
  processed = processed.replace(/\x0Dho\b/g, '\\rho');

  // \b (backspace, 0x08) patterns - backspace is extremely rare
  processed = processed.replace(/\x08eta\b/g, '\\beta');
  processed = processed.replace(/\x08ig([A-Z])/g, '\\big$1'); // \bigO, \bigCap, etc.
  /* eslint-enable no-control-regex */

  // NOTE: We intentionally skip \n patterns (\nu, \nabla) because newlines are
  // very common in markdown and would cause many false positives.
  // If these are needed, the user can edit the notes manually.

  // Fix 2: Convert literal \n sequences to actual newlines
  // Gemini sometimes returns escaped newlines in JSON strings
  // /\\n/g in source code matches literal backslash + n in the string
  processed = processed.replace(/\\n/g, '\n');

  // Fix 3: Convert ```latex...``` or ```math...``` code blocks to $$...$$ for KaTeX
  // LLMs often wrap LaTeX in code fences, but remark-math expects $$ delimiters
  processed = processed.replace(
    /```(?:latex|math)\s*\n([\s\S]*?)```/g,
    (_, content) => `$$\n${content.trim()}\n$$`
  );

  // Fix 4: Ensure callout blockquotes have proper line continuation
  // Convert "> [!type] Title\n> Content" format properly
  processed = processed.replace(/\n>\s*/g, '\n> ');

  // Fix 5: Add blank line after callout title to separate title from content
  // This ensures the content becomes a separate paragraph in the React tree
  // Pattern: > [!type] Title\n> Content -> > [!type] Title\n>\n> Content
  processed = processed.replace(
    /^(>\s*\[!\w+\][^\n]*)\n(>\s*[^\n])/gm,
    '$1\n>\n$2'
  );

  return processed;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlightTerm?: string | null;
}

/**
 * Recursively processes React children and wraps text matching highlightTerm in <mark> elements.
 * Preserves the structure of React elements while adding highlighting to text nodes.
 */
function highlightTextInChildren(children: ReactNode, term: string): ReactNode {
  if (!term || term.length < 2) return children;

  const lowerTerm = term.toLowerCase();

  const processNode = (node: ReactNode, key?: number): ReactNode => {
    // Handle strings - the main case where we add highlighting
    if (typeof node === 'string') {
      const lowerNode = node.toLowerCase();
      const index = lowerNode.indexOf(lowerTerm);

      if (index === -1) return node;

      // Split the string and wrap matches
      const parts: ReactNode[] = [];
      let lastIndex = 0;
      let currentIndex = index;
      let matchKey = 0;

      while (currentIndex !== -1) {
        // Add text before match
        if (currentIndex > lastIndex) {
          parts.push(node.slice(lastIndex, currentIndex));
        }

        // Add highlighted match (use original case from the text)
        // Using inline styles to ensure highlighting works regardless of Tailwind JIT
        parts.push(
          <mark
            key={`highlight-${matchKey++}`}
            className="search-highlight"
            style={{
              backgroundColor: 'rgb(253 224 71 / 0.5)', // yellow-300/50
              borderRadius: '0.125rem',
              padding: '0 0.125rem',
            }}
          >
            {node.slice(currentIndex, currentIndex + term.length)}
          </mark>
        );

        lastIndex = currentIndex + term.length;
        currentIndex = lowerNode.indexOf(lowerTerm, lastIndex);
      }

      // Add remaining text after last match
      if (lastIndex < node.length) {
        parts.push(node.slice(lastIndex));
      }

      return parts;
    }

    // Handle numbers
    if (typeof node === 'number') return node;

    // Handle null/undefined
    if (!node) return node;

    // Handle arrays
    if (Array.isArray(node)) {
      return node.map((child, i) => processNode(child, i));
    }

    // Handle React elements - recursively process their children
    if (React.isValidElement(node)) {
      const props = node.props as { children?: ReactNode };

      // Skip processing KaTeX elements to avoid breaking math rendering
      if (
        node.type === 'span' &&
        typeof props === 'object' &&
        'className' in props
      ) {
        const className = (props as { className?: string }).className || '';
        if (className.includes('katex')) {
          return node;
        }
      }

      // Clone element with processed children
      if (props.children) {
        return React.cloneElement(
          node,
          { ...props, key: key ?? (props as { key?: React.Key }).key },
          processNode(props.children)
        );
      }

      return node;
    }

    return node;
  };

  return processNode(children);
}

export default function MarkdownRenderer({
  content,
  className = '',
  highlightTerm,
}: MarkdownRendererProps) {
  // Preprocess to fix escaped newlines and callout formatting
  const processedContent = preprocessMarkdown(content);

  // Helper to apply highlighting to children
  const hl = (children: ReactNode): ReactNode => {
    if (highlightTerm) {
      return highlightTextInChildren(children, highlightTerm);
    }
    return children;
  };

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom blockquote renderer for callouts
          blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => {
            const callout = parseCalloutFromChildren(children);

            if (callout) {
              return (
                <CalloutBlock type={callout.type} title={callout.title}>
                  {hl(callout.content)}
                </CalloutBlock>
              );
            }

            // Regular blockquote
            return (
              <blockquote
                className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4"
                {...props}
              >
                {hl(children)}
              </blockquote>
            );
          },
          // Style code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;

            if (isInline) {
              return (
                <code
                  className="bg-gray-100 dark:bg-gray-700 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className={`block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          // Style pre blocks for code
          pre: ({ children, ...props }) => (
            <pre className="bg-gray-900 rounded-lg my-4 overflow-hidden" {...props}>
              {children}
            </pre>
          ),
          // Style headings
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-4" {...props}>
              {hl(children)}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-5 mb-3" {...props}>
              {hl(children)}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2" {...props}>
              {hl(children)}
            </h3>
          ),
          // Style lists - apply highlighting to list items
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-outside pl-5 space-y-1 my-3 text-gray-700 dark:text-gray-300" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1 my-3 text-gray-700 dark:text-gray-300" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li {...props}>{hl(children)}</li>
          ),
          // Style links
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {hl(children)}
            </a>
          ),
          // Style paragraphs
          p: ({ children, ...props }) => (
            <p className="my-2 leading-relaxed text-gray-700 dark:text-gray-300" {...props}>
              {hl(children)}
            </p>
          ),
          // Style strong/bold
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props}>
              {hl(children)}
            </strong>
          ),
          // Style tables
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100" {...props}>
              {hl(children)}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300" {...props}>
              {hl(children)}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
