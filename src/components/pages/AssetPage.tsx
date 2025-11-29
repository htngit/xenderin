import React, { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useServices } from '@/lib/services/ServiceContext';
import { handleServiceError } from '@/lib/utils/errorHandling';
import { AssetFile } from '@/lib/services/types';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AnimatedCard } from '@/components/ui/animated-card';
import { FadeIn, Stagger } from '@/components/ui/animations';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import {
  Upload,
  File,
  FileImage,
  FileText,
  FileVideo,
  ArrowLeft,
  FolderOpen,
  HardDrive,
  Zap,
  Download,
  Trash2
} from 'lucide-react';

// Convert AssetFile interface to match the component's expected format
interface AssetFileLocal extends Omit<AssetFile, 'uploadDate' | 'url'> {
  uploadDate: Date;
  url?: string;
  size: number; // Enforce size as number for local usage
  type: string; // Enforce type as string
}

// Placeholder content component for when data is loaded
function AssetPageContent({
  files,
  uploadProgress,
  isUploading,
  previewFile,
  isPreviewOpen,
  setIsPreviewOpen,
  getRootProps,
  getInputProps,
  isDragActive,
  deleteFile,
  downloadFile,
  handlePreviewFile,
  stats,
  formatFileSize,
  truncateFileName,
  getFileIcon
}: {
  files: AssetFileLocal[];
  uploadProgress: number;
  isUploading: boolean;
  previewFile: AssetFileLocal | null;
  isPreviewOpen: boolean;
  setIsPreviewOpen: (value: boolean) => void;
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  deleteFile: (id: string) => void;
  downloadFile: (file: AssetFileLocal) => void;
  handlePreviewFile: (file: AssetFileLocal) => void;
  stats: any;
  formatFileSize: (bytes: number) => string;
  truncateFileName: (fileName: string) => string;
  getFileIcon: (category: AssetFileLocal['category']) => React.ComponentType<any>;
}) {
  const navigate = useNavigate();
  const intl = useIntl();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <FadeIn>
          {/* Header */}
          <div className="flex items-center mb-8">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {intl.formatMessage({ id: 'common.button.back', defaultMessage: 'Back' })}
            </Button>
            <div className="ml-4">
              <h1 className="text-3xl font-bold text-gray-900">{intl.formatMessage({ id: 'assets.title', defaultMessage: 'Asset Files' })}</h1>
              <p className="text-gray-600">{intl.formatMessage({ id: 'assets.subtitle', defaultMessage: 'Upload and manage your media assets and documents' })}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <Stagger staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
            <AnimatedCard animation="slideUp" delay={0.1}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'assets.stats.total', defaultMessage: 'Total Files' })}</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFiles}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'assets.stats.total.desc', defaultMessage: 'Uploaded files' })}</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.2}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'assets.stats.size', defaultMessage: 'Total Size' })}</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'assets.stats.size.desc', defaultMessage: 'Storage used' })}</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.3}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'assets.stats.images', defaultMessage: 'Images' })}</CardTitle>
                <FileImage className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.images}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'assets.stats.images.desc', defaultMessage: 'JPG, PNG' })}</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.4}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'assets.stats.videos', defaultMessage: 'Videos' })}</CardTitle>
                <FileVideo className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.videos}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'assets.stats.videos.desc', defaultMessage: 'MP4 files' })}</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.5}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'assets.stats.documents', defaultMessage: 'Documents' })}</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.documents}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'assets.stats.documents.desc', defaultMessage: 'PDF files' })}</p>
              </CardContent>
            </AnimatedCard>
          </Stagger>

          {/* Upload Area */}
          <AnimatedCard animation="fadeIn" delay={0.6} className="mb-8">
            <CardHeader>
              <CardTitle>{intl.formatMessage({ id: 'assets.upload.title', defaultMessage: 'Upload Files' })}</CardTitle>
              <CardDescription>
                {intl.formatMessage({ id: 'assets.upload.desc', defaultMessage: 'Drag and drop your files here, or click to browse. Only PNG, JPG, PDF, and MP4 files are accepted, up to 10MB each.' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center space-y-4">
                  <div className={`p-3 rounded-full ${isDragActive ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}>
                    <Upload className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {isDragActive ? intl.formatMessage({ id: 'assets.upload.drop_active', defaultMessage: 'Drop files here' }) : intl.formatMessage({ id: 'assets.upload.drop_idle', defaultMessage: 'Upload your files' })}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {intl.formatMessage({ id: 'assets.upload.browse', defaultMessage: 'or click to browse your computer' })}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <Zap className="h-3 w-3" />
                    <span>{intl.formatMessage({ id: 'assets.upload.accepted', defaultMessage: 'Accepted: JPG, PNG, PDF, MP4 • Max size: 10MB' })}</span>
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>{intl.formatMessage({ id: 'assets.upload.uploading', defaultMessage: 'Uploading...' })}</span>
                    <span>{uploadProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}
            </CardContent>
          </AnimatedCard>

          {/* File List */}
          {files.length > 0 && (
            <AnimatedCard animation="fadeIn" delay={0.7}>
              <CardHeader>
                <CardTitle>{intl.formatMessage({ id: 'assets.list.title', defaultMessage: 'Uploaded Files' })} ({files.length})</CardTitle>
                <CardDescription>
                  {intl.formatMessage({ id: 'assets.list.desc', defaultMessage: 'Manage your uploaded assets and documents' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => {
                    const FileIcon = getFileIcon(file.category);
                    return (
                      <div
                        key={file.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-all group cursor-pointer hover:border-primary/50"
                        onClick={() => handlePreviewFile(file)}
                      >
                        {/* Thumbnail or Icon */}
                        <div className="mb-3">
                          {file.category === 'image' && file.url ? (
                            <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to icon if image fails to load
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-100">
                                <FileIcon className="h-8 w-8 text-gray-600" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                              <FileIcon className="h-8 w-8 text-gray-600" />
                            </div>
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={file.name}>
                              {truncateFileName(file.name)}
                            </p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size || 0)}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {file.category}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {file.uploadDate.toLocaleDateString()}
                          </span>
                          <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadFile(file)}
                              className="h-8 w-8 p-0"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteFile(file.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </AnimatedCard>
          )}

          {/* Empty State */}
          {files.length === 0 && !isUploading && (
            <FadeIn delay={0.7}>
              <Card className="text-center py-12">
                <CardContent>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-3 bg-gray-100 rounded-full">
                      <FolderOpen className="h-12 w-12 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{intl.formatMessage({ id: 'assets.empty.title', defaultMessage: 'No files uploaded yet' })}</h3>
                      <p className="text-gray-500 mt-1">
                        {intl.formatMessage({ id: 'assets.empty.desc', defaultMessage: 'Upload your first file to get started with asset management' })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </FadeIn>

        {/* File Preview Modal */}
        <FilePreviewModal
          file={previewFile}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onDownload={() => previewFile && downloadFile(previewFile)}
        />
      </div>
    </div>
  );
}

export function AssetPage() {
  const { assetService, isInitialized } = useServices();
  const [files, setFiles] = useState<AssetFileLocal[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<AssetFileLocal | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { toast } = useToast();
  const intl = useIntl();

  // File validation guard - only allow PNG, JPG, PDF, MP4
  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf', '.mp4'];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    // Check file extension first
    if (!allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File type "${fileExtension}" is not allowed. Only PNG, JPG, PDF, and MP4 files are permitted.`
      };
    }

    // Check MIME type for additional validation
    if (fileExtension === '.png' && !file.type.startsWith('image/')) {
      return {
        isValid: false,
        error: 'Invalid PNG file. Please ensure the file is a valid image.'
      };
    }

    if ((fileExtension === '.jpg' || fileExtension === '.jpeg') && !file.type.startsWith('image/')) {
      return {
        isValid: false,
        error: 'Invalid JPG file. Please ensure the file is a valid image.'
      };
    }

    if (fileExtension === '.pdf' && file.type !== 'application/pdf') {
      return {
        isValid: false,
        error: 'Invalid PDF file. Please ensure the file is a valid PDF document.'
      };
    }

    if (fileExtension === '.mp4' && !file.type.startsWith('video/')) {
      return {
        isValid: false,
        error: 'Invalid MP4 file. Please ensure the file is a valid video.'
      };
    }

    return { isValid: true };
  };

  // File type detection
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getFileCategory = (file: File): AssetFileLocal['category'] => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    // Only accept JPG, PNG, PDF, MP4 as per requirements
    if (type.startsWith('image/') && (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png'))) {
      return 'image';
    }
    if (type.startsWith('video/') && name.endsWith('.mp4')) {
      return 'video';
    }
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return 'document';
    }
    return 'other';
  };

  // File icon selection
  const getFileIcon = (category: AssetFileLocal['category']) => {
    switch (category) {
      case 'image': return FileImage;
      case 'video': return FileVideo;
      case 'document': return FileText;
      default: return File;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Truncate long file names to prevent overlapping
  const truncateFileName = (fileName: string): string => {
    const maxLength = 20; // Maximum display length
    if (fileName.length <= maxLength) return fileName;

    const firstPart = fileName.substring(0, 7);
    const lastPart = fileName.substring(fileName.length - 5);
    return firstPart + '....' + lastPart;
  };



  // Handle file drop with validation guard
  const onDrop = useCallback(async (droppedFiles: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Filter files using validation guard
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    droppedFiles.forEach(file => {
      const validation = validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    });

    // Show error toast for invalid files
    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.length === 1
        ? invalidFiles[0]
        : `${invalidFiles.length} files rejected: ${invalidFiles.slice(0, 2).join(', ')}${invalidFiles.length > 2 ? '...' : ''}`;

      toast({
        title: "Invalid File(s)",
        description: errorMessage,
        variant: "destructive",
      });
    }

    // Show warning if some files were rejected
    if (invalidFiles.length > 0 && validFiles.length > 0) {
      toast({
        title: "Partial Upload",
        description: `${validFiles.length} valid file(s) uploaded, ${invalidFiles.length} file(s) rejected.`,
      });
    }

    // Only process valid files
    if (validFiles.length === 0) {
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }

    try {
      const totalFiles = validFiles.length;
      let completedFiles = 0;

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        // Validate each file before processing (double-check)
        const validation = validateFile(file);
        if (!validation.isValid) {
          toast({
            title: "File Validation Failed",
            description: `File "${file.name}" failed validation: ${validation.error}`,
            variant: "destructive",
          });
          continue;
        }

        // Update progress indicator
        setUploadProgress(((completedFiles / totalFiles) * 100) + 10);

        try {
          const category = getFileCategory(file);
          const uploadedAsset = await assetService.queueUpload(file, { category });

          const localAsset: AssetFileLocal = {
            ...uploadedAsset,
            uploadDate: new Date(uploadedAsset.created_at),
            url: uploadedAsset.file_url,
            size: uploadedAsset.file_size, // Map file_size to size
            type: uploadedAsset.file_type // Map file_type to type
          };

          setFiles(prev => [localAsset, ...prev]);
          completedFiles++;
          setUploadProgress((completedFiles / totalFiles) * 100);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          toast({
            title: intl.formatMessage({ id: 'assets.toast.upload_failed', defaultMessage: 'Upload Failed' }),
            description: intl.formatMessage({ id: 'assets.toast.upload_failed.desc', defaultMessage: 'Failed to upload {name}. Please try again.' }, { name: file.name }),
            variant: "destructive",
          });
        }
      }

      if (completedFiles > 0) {
        toast({
          title: intl.formatMessage({ id: 'assets.toast.upload_success', defaultMessage: 'Upload Successful' }),
          description: intl.formatMessage({ id: 'assets.toast.upload_success.desc', defaultMessage: '{count} file(s) uploaded successfully.' }, { count: completedFiles }),
        });
      }
    } catch (error) {
      console.error('Upload process error:', error);
      toast({
        title: intl.formatMessage({ id: 'assets.toast.upload_error', defaultMessage: 'Upload Error' }),
        description: intl.formatMessage({ id: 'assets.toast.upload_error.desc', defaultMessage: 'An unexpected error occurred during upload.' }),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [toast, assetService]);

  // Dropzone configuration with strict validation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'video/*': ['.mp4'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  // Show rejection errors from dropzone
  React.useEffect(() => {
    if (fileRejections.length > 0) {
      fileRejections.forEach(rejection => {
        rejection.errors.forEach(error => {
          if (error.code === 'file-invalid-type') {
            toast({
              title: intl.formatMessage({ id: 'assets.toast.invalid_type', defaultMessage: 'File Type Rejected' }),
              description: intl.formatMessage({ id: 'assets.toast.invalid_type.desc', defaultMessage: '{name}: Only PNG, JPG, PDF, and MP4 files are allowed.' }, { name: rejection.file.name }),
              variant: "destructive",
            });
          } else if (error.code === 'file-too-large') {
            toast({
              title: intl.formatMessage({ id: 'assets.toast.too_large', defaultMessage: 'File Too Large' }),
              description: intl.formatMessage({ id: 'assets.toast.too_large.desc', defaultMessage: '{name}: File size exceeds 10MB limit.' }, { name: rejection.file.name }),
              variant: "destructive",
            });
          }
        });
      });
    }
  }, [fileRejections, toast]);


  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if initial sync is complete
      const syncComplete = assetService.isInitialSyncComplete();

      if (!syncComplete) {
        console.log('Initial sync not complete, waiting...');
        // Wait for initial sync with timeout
        await assetService.waitForInitialSync(10000); // 10 second timeout
      }

      const data = await assetService.getAssets();
      // Convert the data to match our local interface
      const localFiles: AssetFileLocal[] = data.map(asset => ({
        ...asset,
        uploadDate: new Date(asset.created_at),
        url: asset.file_url,
        size: asset.file_size, // Map file_size to size
        type: asset.file_type // Map file_type to type
      }));
      setFiles(localFiles);
    } catch (err) {
      console.error('Failed to load assets:', err);
      const appError = handleServiceError(err, 'loadAssets');
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized, assetService]);

  // Delete file
  const deleteFile = async (id: string) => {
    try {
      // Optimistic update
      // const fileToDelete = files.find(f => f.id === id);
      setFiles(prev => prev.filter(f => f.id !== id));

      await assetService.deleteAsset(id);

      toast({
        title: intl.formatMessage({ id: 'assets.toast.delete_success', defaultMessage: 'File Deleted' }),
        description: intl.formatMessage({ id: 'assets.toast.delete_success.desc', defaultMessage: 'File has been deleted successfully.' }),
      });
    } catch (error) {
      console.error('Delete failed:', error);
      // Revert on failure
      if (files.find(f => f.id === id)) {
        loadData(); // Reload to ensure sync
      }

      toast({
        title: intl.formatMessage({ id: 'assets.toast.delete_failed', defaultMessage: 'Delete Failed' }),
        description: intl.formatMessage({ id: 'assets.toast.delete_failed.desc', defaultMessage: 'Failed to delete file. Please try again.' }),
        variant: "destructive",
      });
    }
  };

  // Download file
  const downloadFile = (file: AssetFileLocal) => {
    if (file.url) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Preview file handler
  const handlePreviewFile = (file: AssetFileLocal) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  // Calculate statistics
  const stats = {
    totalFiles: files.length,
    totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
    images: files.filter(f => f.category === 'image').length,
    videos: files.filter(f => f.category === 'video').length,
    documents: files.filter(f => f.category === 'document').length
  };

  if (isLoading) {
    const syncComplete = assetService.isInitialSyncComplete();
    const message = syncComplete ? 'Loading assets...' : 'Syncing assets from server...';
    return <LoadingScreen message={message} />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  return (
    <AssetPageContent
      files={files}
      uploadProgress={uploadProgress}
      isUploading={isUploading}
      previewFile={previewFile}
      isPreviewOpen={isPreviewOpen}
      setIsPreviewOpen={setIsPreviewOpen}
      getRootProps={getRootProps}
      getInputProps={getInputProps}
      isDragActive={isDragActive}
      deleteFile={deleteFile}
      downloadFile={downloadFile}
      handlePreviewFile={handlePreviewFile}
      stats={stats}
      formatFileSize={formatFileSize}
      truncateFileName={truncateFileName}
      getFileIcon={getFileIcon}
    />
  );
}