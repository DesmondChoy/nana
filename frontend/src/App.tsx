import { useUserStore, usePDFStore } from './stores';
import UploadPage from './pages/UploadPage';
import StudyPage from './pages/StudyPage';

function App() {
  const profile = useUserStore((state) => state.profile);
  const parsedPDF = usePDFStore((state) => state.parsedPDF);

  // Show upload page if no profile or no PDF
  if (!profile || !parsedPDF) {
    return <UploadPage />;
  }

  // Show study page with dual-pane layout
  return <StudyPage />;
}

export default App;
