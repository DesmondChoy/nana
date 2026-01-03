import { useUserStore, usePDFStore } from './stores';
import UploadPage from './pages/UploadPage';
import StudyPage from './pages/StudyPage';
import ToastProvider from './components/ToastProvider';

function AppContent() {
  const profile = useUserStore((state) => state.profile);
  const parsedPDF = usePDFStore((state) => state.parsedPDF);
  const isUploading = usePDFStore((state) => state.uploadState.isUploading);

  // Show study page if uploading (with loading state) or if PDF is ready
  if (profile && (isUploading || parsedPDF)) {
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
