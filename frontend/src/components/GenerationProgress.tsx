interface GenerationProgressProps {
  completed: number;
  total: number;
}

export default function GenerationProgress({ completed, total }: GenerationProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-600">
        {completed}/{total} pages
      </span>
    </div>
  );
}
