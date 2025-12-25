import { useEffect } from 'react';
import { usePDFStore } from '../stores';

export default function StorageWarning() {
  const storageWarning = usePDFStore((state) => state.storageWarning);
  const setStorageWarning = usePDFStore((state) => state.setStorageWarning);

  // Listen for storage quota exceeded events
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setStorageWarning(true);
    };

    window.addEventListener('storage-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('storage-quota-exceeded', handleQuotaExceeded);
    };
  }, [setStorageWarning]);

  if (!storageWarning) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-md text-sm flex items-center gap-2">
      <span className="text-amber-500">⚠️</span>
      <span>
        Storage limit reached. Your notes won't persist after closing this tab.
      </span>
      <button
        onClick={() => setStorageWarning(false)}
        className="ml-auto text-amber-600 hover:text-amber-800"
      >
        ✕
      </button>
    </div>
  );
}
