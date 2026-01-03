import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid with sensible defaults
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

interface MermaidDiagramProps {
  code: string;
  id: string;
}

export default function MermaidDiagram({ code, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        // Clean the code - remove markdown code fences if present
        let cleanCode = code.trim();
        if (cleanCode.startsWith('```')) {
          // Remove opening fence (```mermaid or ```)
          cleanCode = cleanCode.replace(/^```\w*\n?/, '');
          // Remove closing fence
          cleanCode = cleanCode.replace(/\n?```$/, '');
        }

        // Generate unique ID for this render
        const diagramId = `mermaid-${id}-${Date.now()}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(diagramId, cleanCode);
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [code, id]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <span className="text-red-500">⚠️</span>
          <div>
            <p className="text-red-700 font-medium text-sm">
              Failed to render diagram
            </p>
            <p className="text-red-600 text-xs mt-1">{error}</p>
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                Show diagram code
              </summary>
              <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                {code}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="ml-2 text-gray-500 text-sm">Rendering diagram...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
