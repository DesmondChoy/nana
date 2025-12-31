import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode, ComponentPropsWithoutRef } from 'react';

// Obsidian callout type styling
const CALLOUT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; titleColor: string }
> = {
  abstract: {
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    icon: '📋',
    titleColor: 'text-purple-800',
  },
  note: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    icon: '📝',
    titleColor: 'text-blue-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    icon: 'ℹ️',
    titleColor: 'text-blue-800',
  },
  tip: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    icon: '💡',
    titleColor: 'text-green-800',
  },
  example: {
    bg: 'bg-slate-50',
    border: 'border-slate-400',
    icon: '📖',
    titleColor: 'text-slate-800',
  },
  question: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    icon: '❓',
    titleColor: 'text-yellow-800',
  },
  quote: {
    bg: 'bg-gray-50',
    border: 'border-gray-400',
    icon: '💬',
    titleColor: 'text-gray-800',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    icon: '⚠️',
    titleColor: 'text-orange-800',
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: '🚨',
    titleColor: 'text-red-800',
  },
  bug: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: '🐛',
    titleColor: 'text-red-800',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    icon: '✅',
    titleColor: 'text-green-800',
  },
  failure: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: '❌',
    titleColor: 'text-red-800',
  },
};

// Default style for unknown callout types
const DEFAULT_CALLOUT_STYLE = {
  bg: 'bg-gray-50',
  border: 'border-gray-400',
  icon: '📌',
  titleColor: 'text-gray-800',
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
      <div className="text-gray-700">{children}</div>
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
      const textContent = extractTextContent(child);
      // Match [!type] and capture title (words before the main content)
      // Title is typically capitalized words at the start
      const calloutMatch = textContent.match(/^\[!(\w+)\]\s*(.*)/s);

      if (calloutMatch) {
        const [, type, restOfContent] = calloutMatch;

        // Extract title: Look for common title patterns
        // Titles typically end before the first lowercase word that starts a sentence,
        // or before common sentence starters like "This", "The", "In", etc.
        // Strategy: Take text up to first period, or first newline, or max ~60 chars
        let title = '';
        let contentStart = 0;

        // First, check if there's a newline - title is everything before it
        const newlineIdx = restOfContent.indexOf('\n');
        if (newlineIdx > 0 && newlineIdx < 80) {
          title = restOfContent.substring(0, newlineIdx).trim();
          contentStart = newlineIdx + 1;
        } else {
          // No newline - look for sentence boundary or common content starters
          // Match title: capitalized phrase until we hit a sentence (This/The/In/A + lowercase or period)
          const sentenceStartMatch = restOfContent.match(
            /^(.+?)\s+(?:This|The|In|A|An|For|When|If|Unlike|Because|Instead)\s+[a-z]/
          );
          if (sentenceStartMatch && sentenceStartMatch[1].length < 80) {
            title = sentenceStartMatch[1].trim();
            contentStart = sentenceStartMatch[1].length;
          } else {
            // Fallback: take first sentence or first 60 chars
            const periodIdx = restOfContent.indexOf('.');
            if (periodIdx > 0 && periodIdx < 60) {
              title = restOfContent.substring(0, periodIdx).trim();
              contentStart = periodIdx + 1;
            } else {
              // Just use the type as title, all content goes to body
              title = type.charAt(0).toUpperCase() + type.slice(1);
              contentStart = 0;
            }
          }
        }

        // Build content from remaining text
        const remainingText = restOfContent.substring(contentStart).trim();
        const otherChildren = childArray.slice(i + 1);

        let content: ReactNode;
        if (remainingText) {
          content = [remainingText, ...otherChildren];
        } else {
          content = otherChildren;
        }

        return { type, title, content };
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
  // Fix 1: Convert literal \n sequences to actual newlines
  // Gemini sometimes returns escaped newlines in JSON strings
  // /\\n/g in source code matches literal backslash + n in the string
  let processed = markdown.replace(/\\n/g, '\n');

  // Fix 2: Ensure callout blockquotes have proper line continuation
  // Convert "> [!type] Title\n> Content" format properly
  processed = processed.replace(/\n>\s*/g, '\n> ');

  return processed;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  // Preprocess to fix escaped newlines and callout formatting
  const processedContent = preprocessMarkdown(content);

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom blockquote renderer for callouts
          blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => {
            const callout = parseCalloutFromChildren(children);

            if (callout) {
              return (
                <CalloutBlock type={callout.type} title={callout.title}>
                  {callout.content}
                </CalloutBlock>
              );
            }

            // Regular blockquote
            return (
              <blockquote
                className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4"
                {...props}
              >
                {children}
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
                  className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono"
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
            <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-bold text-gray-800 mt-5 mb-3" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2" {...props}>
              {children}
            </h3>
          ),
          // Style lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-3" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-3" {...props}>
              {children}
            </ol>
          ),
          // Style links
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          // Style paragraphs
          p: ({ children, ...props }) => (
            <p className="my-2 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Style strong/bold
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props}>
              {children}
            </strong>
          ),
          // Style tables
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-gray-300 px-4 py-2" {...props}>
              {children}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
