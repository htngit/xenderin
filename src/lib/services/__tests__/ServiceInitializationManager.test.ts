import { ServiceInitializationManager } from '../ServiceInitializationManager';
import { TemplateService } from '../TemplateService';
import { ContactService } from '../ContactService';
import { AssetService } from '../AssetService';
import { HistoryService } from '../HistoryService';

// Mock the services
jest.mock('../TemplateService');
jest.mock('../ContactService');
jest.mock('../AssetService');
jest.mock('../HistoryService');

describe('ServiceInitializationManager', () => {
  let serviceManager: ServiceInitializationManager;

  beforeEach(() => {
    // Reset mocks and get a fresh instance for each test
    (TemplateService as jest.Mock).mockClear();
    (ContactService as jest.Mock).mockClear();
    (AssetService as jest.Mock).mockClear();
    (HistoryService as jest.Mock).mockClear();
    
    // We need to reset the singleton instance for each test
    (ServiceInitializationManager as any).instance = null;
    serviceManager = ServiceInitializationManager.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = ServiceInitializationManager.getInstance();
    const instance2 = ServiceInitializationManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should initialize all services in order', async () => {
    const masterUserId = 'test-user';
    await serviceManager.initializeAllServices(masterUserId);

    expect(TemplateService).toHaveBeenCalledTimes(1);
    expect(ContactService).toHaveBeenCalledTimes(1);
    expect(AssetService).toHaveBeenCalledTimes(1);
    expect(HistoryService).toHaveBeenCalledTimes(1);

    // Verify that initialize was called on each service instance
    expect(TemplateService.prototype.initialize).toHaveBeenCalledWith(masterUserId);
    expect(ContactService.prototype.initialize).toHaveBeenCalledWith(masterUserId);
    expect(AssetService.prototype.initialize).toHaveBeenCalledWith(masterUserId);
    expect(HistoryService.prototype.initialize).toHaveBeenCalledWith(masterUserId);
  });

  it('should throw an error if a service fails to initialize', async () => {
    const masterUserId = 'test-user';
    const errorMessage = 'Initialization failed';
    (TemplateService.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    await expect(serviceManager.initializeAllServices(masterUserId)).rejects.toThrow(
      `Initialization failed for service: template`
    );
  });

  it('should not re-initialize a service that is already initialized', async () => {
    const masterUserId = 'test-user';
    await serviceManager.initializeAllServices(masterUserId);
    await serviceManager.initializeAllServices(masterUserId);

    expect(TemplateService).toHaveBeenCalledTimes(1);
    expect(ContactService).toHaveBeenCalledTimes(1);
    expect(AssetService).toHaveBeenCalledTimes(1);
    expect(HistoryService).toHaveBeenCalledTimes(1);
  });

  describe('Service Getters', () => {
    const masterUserId = 'test-user';

    it('should throw an error if getting a service before initialization', () => {
      expect(() => serviceManager.getTemplateService()).toThrow('TemplateService not initialized');
      expect(() => serviceManager.getContactService()).toThrow('ContactService not initialized');
      expect(() => serviceManager.getAssetService()).toThrow('AssetService not initialized');
      expect(() => serviceManager.getHistoryService()).toThrow('HistoryService not initialized');
    });

    it('should return the service instance after initialization', async () => {
      await serviceManager.initializeAllServices(masterUserId);

      expect(serviceManager.getTemplateService()).toBeInstanceOf(TemplateService);
      expect(serviceManager.getContactService()).toBeInstanceOf(ContactService);
      expect(serviceManager.getAssetService()).toBeInstanceOf(AssetService);
      expect(serviceManager.getHistoryService()).toBeInstanceOf(HistoryService);
    });
  });
});