import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useUserStore, usePDFStore } from '../stores';
import { uploadPDF } from '../api/client';
import StorageWarning from '../components/StorageWarning';
import type {
  UserProfile,
  PriorExpertise,
  MathComfort,
  DetailLevel,
  PrimaryGoal,
} from '../types';

const EXPERTISE_OPTIONS: PriorExpertise[] = [
  'Data Science/ML',
  'Software Engineering',
  'Statistics',
  'Domain Novice',
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

const GOAL_OPTIONS: PrimaryGoal[] = [
  'Exam prep',
  'Deep understanding',
  'Quick reference',
];

export default function UploadPage() {
  const setProfile = useUserStore((state) => state.setProfile);
  const existingProfile = useUserStore((state) => state.profile);
  const setParsedPDF = usePDFStore((state) => state.setParsedPDF);
  const cachedFilename = usePDFStore((state) => state.cachedFilename);
  const notesCache = usePDFStore((state) => state.notesCache);
  const clearNotesCache = usePDFStore((state) => state.clearNotesCache);

  const cachedPagesCount = Object.keys(notesCache).length;

  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [additionalContext, setAdditionalContext] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Pre-fill form if profile exists
  useEffect(() => {
    if (existingProfile) {
      setFormData(existingProfile);
      setAdditionalContext(existingProfile.additional_context || '');
    }
  }, [existingProfile]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Create blob URL for PDF rendering
      const fileUrl = URL.createObjectURL(file);
      const parsedData = await uploadPDF(file);
      return { parsedData, fileUrl };
    },
    onSuccess: ({ parsedData, fileUrl }) => {
      setParsedPDF(parsedData, fileUrl);
    },
  });

  const isProfileComplete =
    formData.prior_expertise &&
    formData.math_comfort &&
    formData.detail_level &&
    formData.primary_goal;

  const canSubmit = isProfileComplete && selectedFile && !uploadMutation.isPending;

  const handleSubmit = useCallback(() => {
    if (!isProfileComplete || !selectedFile) return;

    const profile: UserProfile = {
      prior_expertise: formData.prior_expertise!,
      math_comfort: formData.math_comfort!,
      detail_level: formData.detail_level!,
      primary_goal: formData.primary_goal!,
      additional_context: additionalContext || undefined,
    };

    setProfile(profile);
    uploadMutation.mutate(selectedFile);
  }, [formData, additionalContext, selectedFile, setProfile, uploadMutation, isProfileComplete]);

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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">NANA</h1>
          <p className="text-gray-600 mt-2">Your study notes that study you</p>
        </div>

        {/* Storage Warning */}
        <div className="mb-4">
          <StorageWarning />
        </div>

        {/* Cached Session Banner */}
        {cachedFilename && cachedPagesCount > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-800 font-medium">
                  Resume previous session?
                </p>
                <p className="text-blue-600 text-sm mt-1">
                  Found {cachedPagesCount} cached notes for "{cachedFilename}"
                </p>
              </div>
              <button
                onClick={clearNotesCache}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear cache
              </button>
            </div>
            <p className="text-blue-600 text-sm mt-2">
              Re-upload the same file to continue where you left off.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">Set Up Your Profile</h2>

          {/* Prior Expertise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prior Expertise
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.prior_expertise || ''}
              onChange={(e) =>
                setFormData({ ...formData, prior_expertise: e.target.value as PriorExpertise })
              }
            >
              <option value="">Select your background...</option>
              {EXPERTISE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Math Comfort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Math Comfort
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.math_comfort || ''}
              onChange={(e) =>
                setFormData({ ...formData, math_comfort: e.target.value as MathComfort })
              }
            >
              <option value="">Select your comfort level...</option>
              {MATH_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Detail Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Detail Level
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.detail_level || ''}
              onChange={(e) =>
                setFormData({ ...formData, detail_level: e.target.value as DetailLevel })
              }
            >
              <option value="">Select desired verbosity...</option>
              {DETAIL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Goal
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.primary_goal || ''}
              onChange={(e) =>
                setFormData({ ...formData, primary_goal: e.target.value as PrimaryGoal })
              }
            >
              <option value="">Select your learning goal...</option>
              {GOAL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Context */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Context <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="e.g., NLP researcher, new to signal processing"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="text-green-700">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    className="mt-2 text-sm text-blue-600 hover:underline"
                    onClick={() => setSelectedFile(null)}
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="text-gray-500">
                  <p>Drag and drop a PDF here, or</p>
                  <label className="mt-2 inline-block cursor-pointer text-blue-600 hover:underline">
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
          </div>

          {/* Error Message */}
          {uploadMutation.isError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              {uploadMutation.error?.message || 'Upload failed. Please try again.'}
            </div>
          )}

          {/* Submit Button */}
          <button
            className={`w-full py-3 rounded-md font-medium transition-colors ${
              canSubmit
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {uploadMutation.isPending ? 'Processing PDF...' : 'Start Learning'}
          </button>
        </div>
      </div>
    </div>
  );
}
