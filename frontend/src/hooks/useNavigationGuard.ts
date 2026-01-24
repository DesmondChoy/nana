import { useState, useEffect, useCallback, useRef } from 'react';

interface UseNavigationGuardOptions {
  /** Whether the guard should be active */
  enabled: boolean;
  /** Callback when user confirms they want to leave */
  onConfirmLeave: () => void;
}

interface UseNavigationGuardReturn {
  /** Whether the confirmation modal should be shown */
  showModal: boolean;
  /** Call this when user clicks "Stay" */
  handleStay: () => void;
  /** Call this when user clicks "Leave" */
  handleLeave: () => void;
  /** Trigger the modal manually (e.g., for "Upload New PDF" button) */
  requestLeave: () => void;
}

export function useNavigationGuard({
  enabled,
  onConfirmLeave,
}: UseNavigationGuardOptions): UseNavigationGuardReturn {
  const [showModal, setShowModal] = useState(false);
  const isInitializedRef = useRef(false);
  const pendingNavigationRef = useRef(false);
  // Track if modal was triggered by back button (vs manual request)
  const triggeredByBackButtonRef = useRef(false);

  // Handle beforeunload for refresh/tab close
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers require all of these for the native dialog to appear:
      // 1. preventDefault()
      // 2. returnValue set to non-empty string
      // 3. return a value from the handler
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  // Handle browser back button via History API
  useEffect(() => {
    if (!enabled) return;

    // Push a dummy state to enable back button interception
    // Only push once on mount
    if (!isInitializedRef.current) {
      window.history.pushState({ navigationGuard: true }, '');
      isInitializedRef.current = true;
    }

    const handlePopState = () => {
      // Ignore if we're already processing a navigation
      if (pendingNavigationRef.current) return;

      // Show modal and re-push state to "cancel" the back navigation
      triggeredByBackButtonRef.current = true;
      setShowModal(true);
      window.history.pushState({ navigationGuard: true }, '');
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled]);

  // Cleanup: remove the dummy history state when guard is disabled
  // Skip if user explicitly confirmed leaving (pendingNavigationRef is true)
  useEffect(() => {
    if (!enabled && isInitializedRef.current && !pendingNavigationRef.current) {
      isInitializedRef.current = false;
      // Go back to remove the dummy state we pushed
      window.history.back();
    }
  }, [enabled]);

  const handleStay = useCallback(() => {
    setShowModal(false);
    triggeredByBackButtonRef.current = false;
  }, []);

  const handleLeave = useCallback(() => {
    pendingNavigationRef.current = true;
    setShowModal(false);
    onConfirmLeave();

    // Only manipulate history if triggered by back button
    if (triggeredByBackButtonRef.current) {
      // Go back twice: once for our re-pushed state, once for the original back
      window.history.go(-2);
    }
    triggeredByBackButtonRef.current = false;
  }, [onConfirmLeave]);

  // For manual triggers like "Upload New PDF" button
  const requestLeave = useCallback(() => {
    triggeredByBackButtonRef.current = false;
    setShowModal(true);
  }, []);

  return {
    showModal,
    handleStay,
    handleLeave,
    requestLeave,
  };
}
