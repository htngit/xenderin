import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/lib/services/ServiceContext';
import { handleServiceError } from '@/lib/utils/errorHandling';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedButton } from '@/components/ui/animated-button';
import { AnimatedCard } from '@/components/ui/animated-card';
import { FadeIn } from '@/components/ui/animations';
import { Contact, Template, Quota, ContactGroup, AssetFile } from '@/lib/services/types';
import {
  Send,
  MessageSquare,
  Clock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Zap,
  Target,
  Settings,
  Paperclip,
  FileImage,
  FileText,
  FileVideo,
  X
} from 'lucide-react';

interface SendPageProps {
  userName?: string;
}

// Placeholder content component for when data is loaded
function SendPageContent({
  contacts,
  templates,
  quota,
  groups,
  assets,
  selectedGroupId,
  setSelectedGroupId,
  selectedTemplate,
  setSelectedTemplate,
  selectedAssets,
  setSelectedAssets,
  delayRange,
  setDelayRange,
  isSending,
  sendResult,
  simulateSend,
  targetContacts,
  selectedTemplateData,
  selectedGroupData,
  canSend,
  previewMessage,
  getTargetContacts,
  getSelectedTemplate,
  getSelectedGroup,
  getSelectedAssets,
  toggleAssetSelection,
  getAssetIcon,
  formatFileSize
}: {
  contacts: Contact[];
  templates: Template[];
  quota: Quota | null;
  groups: ContactGroup[];
  assets: AssetFile[];
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  selectedTemplate: string;
  setSelectedTemplate: (id: string) => void;
  selectedAssets: string[];
  setSelectedAssets: (ids: string[]) => void;
  delayRange: number[];
  setDelayRange: (range: number[]) => void;
  isSending: boolean;
  sendResult: any;
  simulateSend: () => void;
  targetContacts: Contact[];
  selectedTemplateData: Template | undefined;
  selectedGroupData: ContactGroup | { name: string; color: string };
  canSend: boolean;
  previewMessage: () => string;
  getTargetContacts: () => Contact[];
  getSelectedTemplate: () => Template | undefined;
  getSelectedGroup: () => ContactGroup | { name: string; color: string };
  getSelectedAssets: () => AssetFile[];
  toggleAssetSelection: (assetId: string) => void;
  getAssetIcon: (category: AssetFile['category']) => React.ComponentType<any>;
  formatFileSize: (bytes: number) => string;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <FadeIn>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Send Messages</h1>
                <p className="text-gray-600">Configure and send WhatsApp messages to contact groups</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/groups')}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Groups
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Target Group Selection */}
              <AnimatedCard animation="slideUp" delay={0.1} className="min-h-[250px]">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Target Group</span>
                  </CardTitle>
                  <CardDescription>Select which contact group will receive the message</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="group-select">Contact Group</Label>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Contacts ({contacts.length})</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              <div className="flex items-center space-x-2">
                                <div
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: group.color }}
                                />
                                <span>{group.name} ({contacts.filter(c => c.group_id === group.id).length})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Target Contacts:</span>
                        <Badge variant="secondary">{targetContacts.length}</Badge>
                      </div>
                      {selectedGroupId !== 'all' && (
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: selectedGroupData.color }}
                          />
                          <span className="text-sm text-blue-700">{selectedGroupData.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </AnimatedCard>

              {/* Template Selection */}
              <AnimatedCard animation="slideUp" delay={0.2}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Message Template</span>
                  </CardTitle>
                  <CardDescription>Choose the message template to send</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="template-select">Template</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTemplateData && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label>Template Info:</Label>
                          <Badge variant="secondary" className="text-xs">
                            {selectedTemplateData.variants?.length || 1} variants
                          </Badge>
                        </div>

                        <div>
                          <Label>Random Preview:</Label>
                          <div className="bg-gray-50 p-3 rounded border text-sm">
                            {previewMessage()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            ℹ️ Each message will use a random variant to avoid pattern detection
                          </p>
                        </div>

                        {selectedTemplateData.variables && selectedTemplateData.variables.length > 0 && (
                          <div>
                            <Label>Variables:</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedTemplateData.variables.map((variable) => (
                                <Badge key={variable} variant="outline" className="text-xs">
                                  {variable}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </AnimatedCard>

              {/* Asset Selection */}
              <AnimatedCard animation="slideUp" delay={0.25}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Paperclip className="h-5 w-5" />
                    <span>Attach Assets</span>
                  </CardTitle>
                  <CardDescription>Select files to attach with your message (optional)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Available Assets ({assets.length})</Label>
                      {assets.length === 0 ? (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-2 text-blue-700">
                            <FileImage className="h-4 w-4" />
                            <span className="text-sm">No assets available</span>
                          </div>
                          <p className="text-xs text-blue-600 mt-1">
                            Upload assets first in the Assets page to use them here
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                          {assets.map((asset) => {
                            const IconComponent = getAssetIcon(asset.category);
                            const isSelected = selectedAssets.includes(asset.id);
                            
                            return (
                              <div
                                key={asset.id}
                                className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                                  isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => toggleAssetSelection(asset.id)}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 rounded ${
                                    isSelected ? 'bg-primary/10' : 'bg-gray-100'
                                  }`}>
                                    <IconComponent className={`h-4 w-4 ${
                                      isSelected ? 'text-primary' : 'text-gray-600'
                                    }`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" title={asset.name}>
                                      {asset.name}
                                    </p>
                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                      <Badge variant="outline" className="text-xs">
                                        {asset.category}
                                      </Badge>
                                      <span>{formatFileSize(asset.size)}</span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="flex-shrink-0">
                                      <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                        <CheckCircle className="h-3 w-3 text-white" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {selectedAssets.length > 0 && (
                      <div>
                        <Label>Selected Assets ({selectedAssets.length}):</Label>
                        <div className="mt-2 space-y-2">
                          {getSelectedAssets().map((asset) => {
                            const IconComponent = getAssetIcon(asset.category);
                            return (
                              <div key={asset.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <IconComponent className="h-4 w-4 text-gray-600" />
                                  <div>
                                    <p className="text-sm font-medium">{asset.name}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(asset.size)}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleAssetSelection(asset.id)}
                                  className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </AnimatedCard>

              {/* Send Configuration */}
              <AnimatedCard animation="slideUp" delay={0.3}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Send Configuration</span>
                  </CardTitle>
                  <CardDescription>Configure timing and delivery settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Delay Range: {delayRange[0]} seconds</Label>
                      <Slider
                        value={delayRange}
                        onValueChange={setDelayRange}
                        max={10}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1s (Fast)</span>
                        <span>10s (Safe)</span>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-800">Send Configuration Summary:</p>
                          <ul className="text-yellow-700 mt-1 space-y-1">
                            <li>• Target: {targetContacts.length} contacts</li>
                            <li>• Group: {selectedGroupData.name}</li>
                            <li>• Template: {selectedTemplateData?.name || 'Not selected'}</li>
                            {selectedAssets.length > 0 && (
                              <li>• Assets: {selectedAssets.length} file(s) attached</li>
                            )}
                            <li>• Delay: {delayRange[0]}s between messages</li>
                            <li>• Estimated time: ~{Math.ceil(targetContacts.length * delayRange[0] / 60)} minutes</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </AnimatedCard>
            </div>

            {/* Side Panel */}
            <div className="space-y-6">
              {/* Quota Status */}
                <AnimatedCard animation="fadeIn" delay={0.4} className="min-h-[250px]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="h-5 w-5" />
                      <span>Quota Status</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {quota ? (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm">Remaining:</span>
                          <Badge variant={quota.remaining >= targetContacts.length ? 'default' : 'destructive'}>
                            {quota.remaining}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Required:</span>
                          <Badge variant="secondary">{targetContacts.length}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Plan:</span>
                          <Badge variant="outline">{quota.plan_type}</Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground">
                        Loading quota...
                      </div>
                    )}
                  </CardContent>
                </AnimatedCard>
            

              {/* Send Button */}
              <AnimatedCard animation="fadeIn" delay={0.5}>
                <CardContent className="pt-6">
                  <AnimatedButton
                    animation="scale"
                    className="w-full"
                    size="lg"
                    onClick={simulateSend}
                    disabled={!canSend || isSending}
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Reserve & Send
                      </>
                    )}
                  </AnimatedButton>

                  {!canSend && (
                    <Alert className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {!selectedTemplate ? 'Please select a template' :
                         targetContacts.length === 0 ? 'No contacts in selected group' :
                         quota && quota.remaining < targetContacts.length ? 'Insufficient quota' :
                         'Complete all required fields'}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </AnimatedCard>

              {/* Send Result */}
              {sendResult && (
                <AnimatedCard animation="fadeIn">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      {sendResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <span>Send Result</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sendResult.success ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Status:</span>
                          <Badge className="bg-green-600">Completed</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Total Sent:</span>
                          <span className="font-medium">{sendResult.totalContacts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Successful:</span>
                          <span className="font-medium text-green-600">{sendResult.successCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Failed:</span>
                          <span className="font-medium text-red-600">{sendResult.failedCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">
                          <div>Template: {sendResult.templateName}</div>
                          <div>Group: {sendResult.groupName}</div>
                          {sendResult.selectedAssets && sendResult.selectedAssets.length > 0 && (
                            <div>Assets: {sendResult.selectedAssets.length} file(s) attached</div>
                          )}
                          <div>Delay: {sendResult.delayRange}s</div>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {sendResult.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </AnimatedCard>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

export function SendPage({ userName }: SendPageProps) {
  const { contactService, templateService, quotaService, groupService, assetService, isInitialized } = useServices();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [delayRange, setDelayRange] = useState<number[]>([3]);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [contactsData, templatesData, quotaData, groupsData, assetsData] = await Promise.all([
        contactService.getContacts(),
        templateService.getTemplates(),
        quotaService.getQuota('user_123'), // Mock user ID
        groupService.getGroups(),
        assetService.getAssets()
      ]);

      setContacts(contactsData);
      setTemplates(templatesData);
      setQuota(quotaData);
      setGroups(groupsData);
      setAssets(assetsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      const appError = handleServiceError(err, 'loadSendData');
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getTargetContacts = () => {
    if (selectedGroupId === 'all') {
      return contacts;
    }
    return contacts.filter(contact => contact.group_id === selectedGroupId);
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === selectedTemplate);
  };

  const getSelectedGroup = () => {
    if (selectedGroupId === 'all') {
      return { name: 'All Contacts', color: '#6b7280' };
    }
    return groups.find(g => g.id === selectedGroupId) || { name: 'Unknown Group', color: '#6b7280' };
  };

  const getSelectedAssets = () => {
    return assets.filter(asset => selectedAssets.includes(asset.id));
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev =>
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const getAssetIcon = (category: AssetFile['category']) => {
    switch (category) {
      case 'image': return FileImage;
      case 'video': return FileVideo;
      case 'document': return FileText;
      default: return FileImage;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const simulateSend = async () => {
    if (!selectedTemplate || !quota) return;

    const targetContacts = getTargetContacts();
    const selectedTemplateData = getSelectedTemplate();
    const selectedGroupData = getSelectedGroup();

    if (!selectedTemplateData) return;

    setIsSending(true);
    setSendResult(null);

    try {
      // Step 1: Reserve quota
      const reserveResult = await quotaService.reserveQuota('user_123', targetContacts.length);

      if (!reserveResult.success) {
        throw new Error('Failed to reserve quota');
      }

      // Step 2: Simulate sending process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Generate mock results
      const successCount = Math.floor(targetContacts.length * 0.9); // 90% success rate
      const failedCount = targetContacts.length - successCount;

      // Step 4: Commit quota usage
      await quotaService.commitQuota(reserveResult.reservation_id, successCount);

      // Step 5: Update local quota
      const updatedQuota = {
        ...quota,
        messages_used: quota.messages_used + successCount,
        remaining: quota.remaining - successCount
      };
      setQuota(updatedQuota);

      setSendResult({
        success: true,
        totalContacts: targetContacts.length,
        successCount,
        failedCount,
        templateName: selectedTemplateData.name,
        groupName: selectedGroupData.name,
        selectedAssets: getSelectedAssets(),
        delayRange: delayRange[0],
        reservationId: reserveResult.reservation_id
      });

    } catch (error) {
      setSendResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsSending(false);
    }
  };

  const previewMessage = () => {
    const template = getSelectedTemplate();
    if (!template) return '';

    // Use random variant for preview to demonstrate randomization
    const randomVariant = templateService.getRandomVariant(template);
    let preview = randomVariant || '';

    // Replace variables with example values
    template.variables?.forEach(variable => {
      const exampleValue = variable.includes('name') ? 'John Doe' :
                         variable.includes('amount') ? '$100' :
                         variable.includes('date') ? 'December 25, 2024' :
                         variable.includes('event') ? 'Product Launch' :
                         variable.includes('location') ? 'Jakarta Convention Center' :
                         variable.includes('product') ? 'Amazing Product' :
                         variable.includes('company') ? 'Your Company' :
                         variable.includes('contact') ? '+62812345678' :
                         `[${variable}]`;

      preview = preview.replace(new RegExp(`\\{${variable}\\}`, 'g'), exampleValue);
    });

    return preview;
  };

  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized, contactService, templateService, quotaService, groupService, assetService]);

  const targetContacts = getTargetContacts();
  const selectedTemplateData = getSelectedTemplate();
  const selectedGroupData = getSelectedGroup();
  const canSend = selectedTemplate && targetContacts.length > 0 && quota && quota.remaining >= targetContacts.length;

  if (isLoading) {
    return <LoadingScreen message="Loading send configuration..." />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={loadData} />;
  }

  return (
    <SendPageContent
      contacts={contacts}
      templates={templates}
      quota={quota}
      groups={groups}
      assets={assets}
      selectedGroupId={selectedGroupId}
      setSelectedGroupId={setSelectedGroupId}
      selectedTemplate={selectedTemplate}
      setSelectedTemplate={setSelectedTemplate}
      selectedAssets={selectedAssets}
      setSelectedAssets={setSelectedAssets}
      delayRange={delayRange}
      setDelayRange={setDelayRange}
      isSending={isSending}
      sendResult={sendResult}
      simulateSend={simulateSend}
      targetContacts={targetContacts}
      selectedTemplateData={selectedTemplateData}
      selectedGroupData={selectedGroupData}
      canSend={canSend}
      previewMessage={previewMessage}
      getTargetContacts={getTargetContacts}
      getSelectedTemplate={getSelectedTemplate}
      getSelectedGroup={getSelectedGroup}
      getSelectedAssets={getSelectedAssets}
      toggleAssetSelection={toggleAssetSelection}
      getAssetIcon={getAssetIcon}
      formatFileSize={formatFileSize}
    />
  );
}
