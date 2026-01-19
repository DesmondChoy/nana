import { useState, useEffect } from 'react';
import { useApiKeyStore } from '../stores/apiKeyStore';
import { validateApiKey } from '../api/client';

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export default function ApiKeyInput() {
  const { apiKey, isValidated, setApiKey, clearApiKey } = useApiKeyStore();
  const [inputValue, setInputValue] = useState(apiKey || '');
  const [validationState, setValidationState] = useState<ValidationState>(
    apiKey && isValidated ? 'valid' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(!apiKey || !isValidated);

  // Sync input with store when store changes (e.g., on mount)
  useEffect(() => {
    if (apiKey) {
      setInputValue(apiKey);
      if (isValidated) {
        setValidationState('valid');
      }
    }
  }, [apiKey, isValidated]);

  // Auto-fill from dev environment variable (dev mode only)
  useEffect(() => {
    const devKey = import.meta.env.DEV ? __DEV_API_KEY__ : '';
    // Only auto-fill if: dev key exists, no saved key, and not already validated
    if (devKey && !apiKey && validationState === 'idle') {
      setInputValue(devKey);
      // Trigger auto-validation
      (async () => {
        setValidationState('validating');
        try {
          await validateApiKey(devKey);
          setApiKey(devKey);
          setValidationState('valid');
          setTimeout(() => setIsExpanded(false), 1000);
        } catch {
          // Silently fail - user can manually enter key
          setValidationState('idle');
        }
      })();
    }
  }, []); // Run once on mount

  const handleValidate = async () => {
    if (!inputValue.trim()) {
      setErrorMessage('Please enter an API key');
      setValidationState('invalid');
      return;
    }

    setValidationState('validating');
    setErrorMessage('');

    try {
      await validateApiKey(inputValue.trim());
      setApiKey(inputValue.trim());
      setValidationState('valid');
      // Auto-collapse after successful validation
      setTimeout(() => setIsExpanded(false), 1000);
    } catch (error) {
      setValidationState('invalid');
      setErrorMessage(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handleClear = () => {
    clearApiKey();
    setInputValue('');
    setValidationState('idle');
    setErrorMessage('');
    setIsExpanded(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <span className="font-medium text-gray-800 dark:text-gray-100">
            API Key
          </span>
          {validationState === 'valid' && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Connected
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 pt-4">
            NANA uses Google's Gemini API to generate study notes. You'll need a free API key to get started.
          </p>

          {/* Get key link */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Get a free API key from Google AI Studio
          </a>

          {/* Rate limit note */}
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md">
            <strong>Getting rate limit errors?</strong> Enable Cloud Billing in{' '}
            <a
              href="https://aistudio.google.com/app/plan_information"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-700 dark:hover:text-amber-300"
            >
              Google AI Studio
            </a>
            {' '}(Dashboard → Usage and Billing → Set up Billing) to increase your quota.
          </p>

          {/* Input and validate button */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="password"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (validationState !== 'idle') {
                    setValidationState('idle');
                    setErrorMessage('');
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Paste your API key here..."
                className={`w-full border rounded-md px-3 py-2.5 pr-10
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  transition-colors duration-150
                  ${validationState === 'invalid'
                    ? 'border-red-300 dark:border-red-600'
                    : validationState === 'valid'
                    ? 'border-green-300 dark:border-green-600'
                    : 'border-gray-300 dark:border-gray-600'
                  }`}
              />
              {/* Status icon */}
              {validationState === 'valid' && (
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {validationState === 'invalid' && (
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <button
              onClick={handleValidate}
              disabled={validationState === 'validating' || !inputValue.trim()}
              className={`px-4 py-2.5 rounded-md font-medium transition-all duration-150 whitespace-nowrap
                ${validationState === 'validating' || !inputValue.trim()
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                }`}
            >
              {validationState === 'validating' ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Validating...
                </span>
              ) : validationState === 'valid' ? (
                'Validated'
              ) : (
                'Validate'
              )}
            </button>
          </div>

          {/* Error message */}
          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          )}

          {/* Clear button - only show if key is saved */}
          {apiKey && (
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Clear saved key
            </button>
          )}

          {/* Privacy note */}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Your API key is stored locally in your browser and sent directly to Google's API. We never see or store your key on our servers.
          </p>
        </div>
      )}
    </div>
  );
}
