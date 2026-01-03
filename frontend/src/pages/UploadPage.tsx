import { useState, useCallback } from 'react';
import { useUserStore, usePDFStore } from '../stores';
import { uploadPDF } from '../api/client';
import StorageWarning from '../components/StorageWarning';
import ThemeToggle from '../components/ThemeToggle';
import type {
  UserProfile,
  PriorExpertise,
  MathComfort,
  DetailLevel,
  PrimaryGoal,
} from '../types';

// Suggested expertise options (users can type any value)
const EXPERTISE_SUGGESTIONS = [
  'Software Engineering',
  'Data Science/ML',
  'Statistics',
  'Healthcare/Nursing',
  'Finance/Accounting',
  'Education/Teaching',
  'Law',
];

const MATH_OPTIONS: MathComfort[] = [
  'No equations (words/intuition only)',
  'Light notation ok',
  'Equation-heavy is fine',
];

const DETAIL_OPTIONS: DetailLevel[] = [
  'Concise (bullets only)',
  'Balanced (paragraphs + bullets)',
  'Comprehensive (textbook depth)',
];

// Primary goal options with descriptions
const GOAL_OPTIONS_WITH_DESCRIPTIONS = [
  {
    value: 'Exam prep' as PrimaryGoal,
    label: 'Exam prep',
    description: 'Testable facts, warnings for misconceptions, memory hooks',
  },
  {
    value: 'Deep understanding' as PrimaryGoal,
    label: 'Deep understanding',
    description: 'Focus on "why" over "what", conceptual depth, thought-provoking questions',
  },
  {
    value: 'Quick reference' as PrimaryGoal,
    label: 'Quick reference',
    description: 'Scannable format, precise terminology, easy navigation',
  },
];

// Checkmark icon for completed fields
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
}

function FormField({ label, value, onChange, options, placeholder }: FormFieldProps) {
  const isComplete = Boolean(value);

  return (
    <div className="relative">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {isComplete && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
          </span>
        )}
      </label>
      <select
        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2.5
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   transition-colors duration-150"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// Combobox: text input with dropdown suggestions
interface ComboboxFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
  hint?: string;
}

function ComboboxField({ label, value, onChange, suggestions, placeholder, hint }: ComboboxFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const isComplete = Boolean(value.trim());

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter((s) =>
    s.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    onChange(suggestion);
    setIsOpen(false);
  };

  const handleBlur = () => {
    // Delay closing to allow click on suggestion
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {isComplete && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
          </span>
        )}
      </label>
      <input
        type="text"
        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2.5
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   transition-colors duration-150"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
      />
      {hint && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto">
          {filteredSuggestions.map((suggestion) => (
            <li
              key={suggestion}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-900 dark:text-gray-100"
              onMouseDown={() => handleSelect(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Radio group with descriptions
interface RadioOption {
  value: string;
  label: string;
  description: string;
}

interface RadioGroupFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
}

function RadioGroupField({ label, value, onChange, options }: RadioGroupFieldProps) {
  const isComplete = Boolean(value);

  return (
    <div className="relative">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {label}
        {isComplete && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
          </span>
        )}
      </label>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors duration-150
              ${value === option.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
          >
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {option.label}
              </span>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {option.description}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const setProfile = useUserStore((state) => state.setProfile);
  const existingProfile = useUserStore((state) => state.profile);
  const startUpload = usePDFStore((state) => state.startUpload);
  const uploadSuccess = usePDFStore((state) => state.uploadSuccess);
  const uploadFailed = usePDFStore((state) => state.uploadFailed);
  const cachedFilename = usePDFStore((state) => state.cachedFilename);
  const notesCache = usePDFStore((state) => state.notesCache);
  const clearNotesCache = usePDFStore((state) => state.clearNotesCache);

  const cachedPagesCount = Object.keys(notesCache).length;

  const [formData, setFormData] = useState<Partial<UserProfile>>(existingProfile || {});
  const [additionalContext, setAdditionalContext] = useState(existingProfile?.additional_context || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    // Create blob URL before starting upload
    const fileUrl = URL.createObjectURL(file);
    startUpload(fileUrl);

    try {
      const parsedData = await uploadPDF(file);
      uploadSuccess(parsedData);
    } catch (error) {
      uploadFailed(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    }
  }, [startUpload, uploadSuccess, uploadFailed]);

  const isProfileComplete =
    formData.prior_expertise &&
    formData.math_comfort &&
    formData.detail_level &&
    formData.primary_goal;

  const completedFields = [
    formData.prior_expertise,
    formData.math_comfort,
    formData.detail_level,
    formData.primary_goal,
  ].filter(Boolean).length;

  const canSubmit = isProfileComplete && selectedFile && !isSubmitting;

  const handleSubmit = useCallback(() => {
    if (!isProfileComplete || !selectedFile || isSubmitting) return;

    const profile: UserProfile = {
      prior_expertise: formData.prior_expertise!,
      math_comfort: formData.math_comfort!,
      detail_level: formData.detail_level!,
      primary_goal: formData.primary_goal!,
      additional_context: additionalContext || undefined,
    };

    setIsSubmitting(true);
    setProfile(profile);
    handleUpload(selectedFile);
  }, [formData, additionalContext, selectedFile, setProfile, handleUpload, isProfileComplete, isSubmitting]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file?.type === 'application/pdf') {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header with theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              NANA
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Your study notes that study you
            </p>
          </div>

          {/* Storage Warning */}
          <div className="mb-4">
            <StorageWarning />
          </div>

          {/* Cached Session Banner */}
          {cachedFilename && cachedPagesCount > 0 && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    Resume previous session?
                  </p>
                  <p className="text-blue-600 dark:text-blue-300 text-sm mt-1">
                    Found {cachedPagesCount} cached notes for "{cachedFilename}"
                  </p>
                </div>
                <button
                  onClick={clearNotesCache}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline transition-colors"
                >
                  Clear cache
                </button>
              </div>
              <p className="text-blue-600 dark:text-blue-300 text-sm mt-2">
                Re-upload the same file to continue where you left off.
              </p>
            </div>
          )}

          {/* Main Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-6 space-y-5 sm:space-y-6 border border-gray-100 dark:border-gray-700">
            {/* Section header with progress */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">
                Set Up Your Profile
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {completedFields}/4 complete
              </span>
            </div>

            {/* Profile Fields */}
            <ComboboxField
              label="Prior Expertise"
              value={formData.prior_expertise || ''}
              onChange={(value) =>
                setFormData({ ...formData, prior_expertise: value })
              }
              suggestions={EXPERTISE_SUGGESTIONS}
              placeholder="e.g., Chef, Nurse, Teacher..."
              hint="Your background shapes how we explain concepts to you"
            />

            <FormField
              label="Math Comfort"
              value={formData.math_comfort || ''}
              onChange={(value) =>
                setFormData({ ...formData, math_comfort: value as MathComfort })
              }
              options={MATH_OPTIONS}
              placeholder="Select your comfort level..."
            />

            <FormField
              label="Detail Level"
              value={formData.detail_level || ''}
              onChange={(value) =>
                setFormData({ ...formData, detail_level: value as DetailLevel })
              }
              options={DETAIL_OPTIONS}
              placeholder="Select desired verbosity..."
            />

            <RadioGroupField
              label="Primary Goal"
              value={formData.primary_goal || ''}
              onChange={(value) =>
                setFormData({ ...formData, primary_goal: value as PrimaryGoal })
              }
              options={GOAL_OPTIONS_WITH_DESCRIPTIONS}
            />

            {/* Additional Context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Context <span className="text-gray-400 dark:text-gray-500">(optional)</span>
              </label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2.5
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-colors duration-150"
                rows={2}
                placeholder="e.g., Bullet points only, Mandarin speaker learning English terms, Focus on practical applications, Skip historical context..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload PDF
                {selectedFile && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50">
                    <CheckIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </span>
                )}
              </label>

              {/* Desktop: Drag-and-drop zone */}
              <div
                className={`hidden sm:block border-2 border-dashed rounded-lg p-8 text-center transition-all duration-150 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : selectedFile
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="text-green-700 dark:text-green-300">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => setSelectedFile(null)}
                    >
                      Choose different file
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    <p>Drag and drop a PDF here, or</p>
                    <label className="mt-2 inline-block cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                      browse to upload
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Mobile: Simple file button */}
              <div className="sm:hidden">
                {selectedFile ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-green-700 dark:text-green-300 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      className="ml-3 text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                      onClick={() => setSelectedFile(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                    <span className="text-gray-600 dark:text-gray-400">
                      Tap to select PDF file
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              className={`w-full py-3 rounded-lg font-medium transition-all duration-150 ${
                canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                'Start Learning'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
