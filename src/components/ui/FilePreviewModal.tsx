import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useState,
} from 'react';
import {
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause
} from 'lucide-react';

interface AssetFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  url?: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
}

interface FilePreviewModalProps {
  file: AssetFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

// Format file size utility function
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function FilePreviewModal({ file, isOpen, onClose, onDownload }: FilePreviewModalProps) {
  const [imageScale, setImageScale] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  if (!file) return null;

  const handleImageZoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleImageZoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleImageRotate = () => {
    setImageRotation(prev => (prev + 90) % 360);
  };

  const handleVideoPlayPause = () => {
    if (videoRef) {
      if (isPlaying) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const resetImageControls = () => {
    setImageScale(1);
    setImageRotation(0);
  };

  const renderImageViewer = () => (
    <div className="flex flex-col items-center space-y-4">
      {/* Image Controls */}
      <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleImageZoomOut}
          disabled={imageScale <= 0.5}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium px-2">
          {Math.round(imageScale * 10)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleImageZoomIn}
          disabled={imageScale >= 3}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleImageRotate}
          title="Rotate"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetImageControls}
          title="Reset"
        >
          Reset
        </Button>
      </div>

      {/* Image Display */}
      <div className="max-h-[70vh] max-w-full overflow-hidden flex items-center justify-center bg-gray-50 rounded-lg">
        <img
          src={file.url}
          alt={file.name}
          className="max-w-full max-h-full object-contain transition-transform"
          style={{
            transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
            cursor: 'grab'
          }}
          onLoad={resetImageControls}
          draggable={false}
        />
      </div>
    </div>
  );

  const renderVideoViewer = () => (
    <div className="flex flex-col items-center space-y-4">
      {/* Video Controls */}
      <div className="flex items-center space-x-2 p-2 bg-gray-10 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleVideoPlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <span className="text-sm font-medium">
          Video Player
        </span>
      </div>

      {/* Video Display */}
      <div className="max-h-[70vh] max-w-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
        <video
          ref={setVideoRef}
          src={file.url}
          controls
          className="max-w-full max-h-full"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );

  const renderPDFViewer = () => (
    <div className="flex flex-col items-center space-y-4">
      {/* PDF Controls */}
      <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-lg">
        <FileText className="h-4 w-4" />
        <span className="text-sm font-medium">PDF Document</span>
        {onDownload && (
          <Button variant="ghost" size="sm" onClick={onDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* PDF Display */}
      <div className="max-h-[70vh] max-w-full flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
        <iframe
          src={`${file.url}#view=FitH`}
          className="w-full h-full min-h-[500px] border rounded"
          title={file.name}
        />
      </div>
    </div>
  );

  const renderViewer = () => {
    switch (file.category) {
      case 'image':
        return renderImageViewer();
      case 'video':
        return renderVideoViewer();
      case 'document':
        return renderPDFViewer();
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-500">Preview not available for this file type</p>
          </div>
        );
    }
  };

  if (!file) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>File Preview</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-gray-500">No file selected for preview.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DialogTitle className="text-lg font-semibold truncate max-w-md" title={file.name}>
                {file.name}
              </DialogTitle>
              <Badge variant="secondary" className="capitalize">
                {file.category}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Size: {formatFileSize(file.size)}</span>
              <span>Uploaded: {file.uploadDate.toLocaleDateString()}</span>
              <span>Type: {file.type}</span>
            </div>
            {onDownload && (
              <Button variant="ghost" size="sm" onClick={onDownload} title="Download">
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {renderViewer()}
        </div>
      </DialogContent>
    </Dialog>
  );
}