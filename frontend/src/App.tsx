import { useUserStore, usePDFStore } from './stores';
import UploadPage from './pages/UploadPage';
import StudyPage from './pages/StudyPage';

function App() {
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

export default App;
