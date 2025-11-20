import { useState, useEffect } from 'react';
import { useServices } from '@/lib/services/ServiceContext';
import { ErrorScreen } from '../ui/ErrorScreen';
import { Skeleton } from '../ui/skeleton';
import { handleServiceError } from '@/lib/utils/errorHandling';
import { Template } from '@/lib/services/types'; // Assuming Template type is defined here

// Placeholder for the main content of the page
function TemplatesPageContent({ templates, isLoading }: { templates: Template[], isLoading: boolean }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Templates</h1>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : templates.length > 0 ? (
        <ul>
          {templates.map((template) => (
            <li key={template.id}>{template.name}</li>
          ))}
        </ul>
      ) : (
        <p>No templates found.</p>
      )}
    </div>
  );
}

export function TemplatesPage() {
  const { templateService, isInitialized } = useServices();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // The service is now guaranteed to be initialized by the ServiceProvider
      const data = await templateService.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      const appError = handleServiceError(err, 'loadTemplates');
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadTemplates();
    }
  }, [isInitialized, templateService]);

  // if (isLoading) {
  //   return <LoadingScreen message="Loading templates..." />;
  // }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadTemplates} />;
  }

  return <TemplatesPageContent templates={templates} isLoading={isLoading} />;
}