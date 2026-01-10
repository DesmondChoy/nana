import { useUserStore, usePDFStore } from './stores';
import UploadPage from './pages/UploadPage';
import StudyPage from './pages/StudyPage';
import ToastProvider from './components/ToastProvider';

function AppContent() {
  const profile = useUserStore((state) => state.profile);
  const parsedPDF = usePDFStore((state) => state.parsedPDF);
  const pdfFileUrl = usePDFStore((state) => state.pdfFileUrl);
  const isUploading = usePDFStore((state) => state.uploadState.isUploading);

  // Show study page if:
  // 1. Uploading (with loading state)
  // 2. parsedPDF is ready (normal flow)
  // 3. pdfFileUrl is set with complete cache (cache-only resume)
  if (profile && (isUploading || parsedPDF || pdfFileUrl)) {
    return <StudyPage />;
  }

  // Show upload page if no profile or no PDF
  return <UploadPage />;
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
