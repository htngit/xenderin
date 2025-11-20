import { createContext, useContext, ReactNode } from 'react';
import { serviceManager } from './ServiceInitializationManager';
import { TemplateService } from './TemplateService';
import { ContactService } from './ContactService';
import { GroupService } from './GroupService';
import { AssetService } from './AssetService';
import { HistoryService } from './HistoryService';

interface ServiceContextType {
  templateService: TemplateService;
  contactService: ContactService;
  groupService: GroupService;
  assetService: AssetService;
  historyService: HistoryService;
  isInitialized: boolean;
}

const ServiceContext = createContext<ServiceContextType | null>(null);

/**
 * ServiceProvider - A pass-through provider that exposes initialized services
 * 
 * IMPORTANT: Services must already be initialized by Dashboard before this provider is rendered.
 * This component does NOT perform initialization - it only provides access to already-initialized services.
 */
export function ServiceProvider({ children }: { children: ReactNode }) {
  // Services should already be initialized by Dashboard
  // This is just a pass-through provider to make services available via context

  // Check if services are initialized
  if (!serviceManager.isInitialized()) {
    // This should never happen if the app flow is correct (Dashboard → ServiceProvider)
    console.error('ServiceProvider rendered before services were initialized!');
    throw new Error('Services must be initialized before rendering ServiceProvider. Ensure Dashboard completes initialization first.');
  }

  const services: ServiceContextType = {
    templateService: serviceManager.getTemplateService(),
    contactService: serviceManager.getContactService(),
    groupService: serviceManager.getGroupService(),
    assetService: serviceManager.getAssetService(),
    historyService: serviceManager.getHistoryService(),
    isInitialized: true,
  };

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}