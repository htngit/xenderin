import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/lib/services/ServiceContext';
import { handleServiceError } from '@/lib/utils/errorHandling';
import { MessageLog } from '@/lib/services/types';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnimatedCard } from '@/components/ui/animated-card';
import { FadeIn, Stagger } from '@/components/ui/animations';
import {
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Phone,
  User,
  Clock
} from 'lucide-react';

// Placeholder content component for when data is loaded
function HistoryPageContent({
  filteredLogs,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  getStatusIcon,
  getStatusBadge,
  formatDate,
  stats
}: {
  filteredLogs: MessageLog[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  getStatusIcon: (status: MessageLog['status']) => React.ReactNode;
  getStatusBadge: (status: MessageLog['status']) => React.ReactNode;
  formatDate: (dateString: string) => string;
  stats: any;
}) {
  const navigate = useNavigate();
  const intl = useIntl();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <FadeIn>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {intl.formatMessage({ id: 'common.button.back', defaultMessage: 'Back' })}
              </Button>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <h1 className="text-3xl font-bold text-gray-900">{intl.formatMessage({ id: 'history.message_history_title', defaultMessage: 'Individual Message Logs' })}</h1>
                </div>
                <p className="text-gray-600">{intl.formatMessage({ id: 'history.message_history_desc', defaultMessage: 'Detailed records of each message sent to individual contacts' })}</p>
                <div className="mt-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {intl.formatMessage({ id: 'history.type_individual', defaultMessage: 'Individual Messages' })}
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/campaign-history')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {intl.formatMessage({ id: 'history.button.view_activity', defaultMessage: 'View Campaign Logs' })}
            </Button>
          </div>

          {/* Stats Cards */}
          <Stagger staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <AnimatedCard animation="slideUp" delay={0.1}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'history.stats.total', defaultMessage: 'Total Messages' })}</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'history.stats.total.desc', defaultMessage: 'All time messages' })}</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.2}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'history.stats.delivered', defaultMessage: 'Delivered' })}</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.sent}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'history.stats.delivered.desc', defaultMessage: 'Successfully sent' })}</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard animation="slideUp" delay={0.3}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{intl.formatMessage({ id: 'history.stats.failed', defaultMessage: 'Failed' })}</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.failed}</div>
                <p className="text-xs text-muted-foreground">{intl.formatMessage({ id: 'history.stats.failed.desc', defaultMessage: 'Failed delivery' })}</p>
              </CardContent>
            </AnimatedCard>
          </Stagger>

          {/* Filters */}
          <AnimatedCard animation="fadeIn" delay={0.5}>
            <CardHeader>
              <CardTitle>{intl.formatMessage({ id: 'history.search.title', defaultMessage: 'Search & Filter' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={intl.formatMessage({ id: 'history.search.placeholder', defaultMessage: 'Search by name or phone...' })}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={intl.formatMessage({ id: 'history.filter.status.placeholder', defaultMessage: 'Filter by status' })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{intl.formatMessage({ id: 'history.filter.status.all', defaultMessage: 'All Status' })}</SelectItem>
                      <SelectItem value="sent">{intl.formatMessage({ id: 'history.filter.status.sent', defaultMessage: 'Sent' })}</SelectItem>
                      <SelectItem value="failed">{intl.formatMessage({ id: 'history.filter.status.failed', defaultMessage: 'Failed' })}</SelectItem>
                      <SelectItem value="pending">{intl.formatMessage({ id: 'history.filter.status.pending', defaultMessage: 'Pending' })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          {/* Message Logs Table */}
          <AnimatedCard animation="fadeIn" delay={0.6} className="mt-6">
            <CardHeader>
              <CardTitle>{intl.formatMessage({ id: 'history.list.title', defaultMessage: 'Message Logs' })} ({filteredLogs.length})</CardTitle>
              <CardDescription>
                {intl.formatMessage({ id: 'history.list.desc', defaultMessage: 'Detailed log of individual messages sent' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  {searchQuery || statusFilter !== 'all' ? (
                    <>
                      <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                        {intl.formatMessage({ id: 'history.empty.search', defaultMessage: 'No message logs found matching your filters.' })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {intl.formatMessage({
                          id: 'history.empty.search.help',
                          defaultMessage: 'Try adjusting your search terms or clearing filters to see more results.'
                        })}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                        >
                          {intl.formatMessage({ id: 'history.empty.search.clear_filters', defaultMessage: 'Clear Filters' })}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate('/send')}
                        >
                          {intl.formatMessage({ id: 'history.empty.search.send_messages', defaultMessage: 'Send Messages' })}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-8 w-8 text-blue-500 mx-auto" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                        {intl.formatMessage({ id: 'history.empty.all', defaultMessage: 'No message logs yet.' })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {intl.formatMessage({
                          id: 'history.empty.all.help',
                          defaultMessage: 'You haven\'t sent any messages yet. Start by creating a campaign and sending your first messages.'
                        })}
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate('/send')}
                      >
                        {intl.formatMessage({ id: 'history.empty.all.send_first', defaultMessage: 'Send Your First Messages' })}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{intl.formatMessage({ id: 'history.list.header.status', defaultMessage: 'Status' })}</TableHead>
                        <TableHead>{intl.formatMessage({ id: 'history.list.header.contact', defaultMessage: 'Contact Name' })}</TableHead>
                        <TableHead>{intl.formatMessage({ id: 'history.list.header.phone', defaultMessage: 'Phone Number' })}</TableHead>
                        <TableHead>{intl.formatMessage({ id: 'history.list.header.sent_at', defaultMessage: 'Sent At' })}</TableHead>
                        <TableHead>{intl.formatMessage({ id: 'history.list.header.details', defaultMessage: 'Details' })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(log.status)}
                              {getStatusBadge(log.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{log.contact_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{log.contact_phone}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {log.sent_at ? formatDate(log.sent_at) : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.error_message ? (
                              <div className="text-sm text-red-600 max-w-xs truncate" title={log.error_message}>
                                {log.error_message}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </AnimatedCard>
        </FadeIn>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const { historyService, isInitialized } = useServices();
  const intl = useIntl();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<MessageLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await historyService.getAllMessageLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load message logs:', err);
      const appError = handleServiceError(err, 'loadHistory');

      // Enhanced error handling with specific messages
      if (appError.code === 'UNAUTHORIZED') {
        setError(intl.formatMessage({
          id: 'history.error.unauthorized',
          defaultMessage: 'Authentication failed. Please log in again to view your message history.'
        }));
      } else if (appError.code === 'FORBIDDEN') {
        setError(intl.formatMessage({
          id: 'history.error.forbidden',
          defaultMessage: 'You do not have permission to view message history. Please contact support.'
        }));
      } else if (appError.code === 'NETWORK_ERROR') {
        setError(intl.formatMessage({
          id: 'history.error.network',
          defaultMessage: 'Network connection failed. Please check your internet connection and try again.'
        }));
      } else if (appError.code === 'NOT_FOUND') {
        setError(intl.formatMessage({
          id: 'history.error.not_found',
          defaultMessage: 'Message history data not found. You may not have any message logs yet.'
        }));
      } else {
        setError(intl.formatMessage({
          id: 'history.error.generic',
          defaultMessage: 'Failed to load message history: {errorMessage}',
        }, { errorMessage: appError.message }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized, historyService]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, statusFilter]);

  const filterLogs = () => {
    let filtered = [...logs];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(log =>
        (log.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.contact_phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.status.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const getStatusIcon = (status: MessageLog['status']) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: MessageLog['status']) => {
    const variants = {
      sent: 'default',
      failed: 'destructive',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStats = () => {
    const total = logs.length;
    const sent = logs.filter(l => l.status === 'sent').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const pending = logs.filter(l => l.status === 'pending').length;

    return {
      total,
      sent,
      failed,
      pending
    };
  };

  const stats = getStats();

  if (isLoading) {
    return <LoadingScreen message={intl.formatMessage({ id: 'history.loading', defaultMessage: 'Loading message history...' })} />;
  }

  if (error) {
    return (
      <ErrorScreen
        error={error}
        onRetry={loadData}
        retryButtonText={intl.formatMessage({
          id: 'history.error.retry_button',
          defaultMessage: 'Reload Message History'
        })}
        additionalHelp={intl.formatMessage({
          id: 'history.error.additional_help',
          defaultMessage: 'If the problem persists, please check your internet connection or try again later.'
        })}
      />
    );
  }

  return (
    <HistoryPageContent
      filteredLogs={filteredLogs}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      getStatusIcon={getStatusIcon}
      getStatusBadge={getStatusBadge}
      formatDate={formatDate}
      stats={stats}
    />
  );
}