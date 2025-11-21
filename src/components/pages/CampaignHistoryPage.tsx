import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/lib/services/ServiceContext';
import { handleServiceError } from '@/lib/utils/errorHandling';
import { ActivityLog } from '@/lib/services/types';
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
    Clock,
    Search,
    CheckCircle,
    XCircle,
    Loader,
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Users,
    MessageSquare,
    TrendingUp
} from 'lucide-react';

// Placeholder content component for when data is loaded
function CampaignHistoryPageContent({
    filteredLogs,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    getStatusIcon,
    getStatusBadge,
    formatDate,
    calculateDuration,
    stats
}: {
    filteredLogs: ActivityLog[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    getStatusIcon: (status: ActivityLog['status']) => React.ReactNode;
    getStatusBadge: (status: ActivityLog['status']) => React.ReactNode;
    formatDate: (dateString: string) => string;
    calculateDuration: (started: string, completed?: string) => string;
    stats: any;
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
                                <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
                                <p className="text-gray-600">View your activity history</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <Stagger staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <AnimatedCard animation="slideUp" delay={0.1}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.total}</div>
                                <p className="text-xs text-muted-foreground">All time activities</p>
                            </CardContent>
                        </AnimatedCard>

                        <AnimatedCard animation="slideUp" delay={0.2}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.successRate}%</div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.successMessages}/{stats.totalMessages} messages
                                </p>
                            </CardContent>
                        </AnimatedCard>

                        <AnimatedCard animation="slideUp" delay={0.3}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.completed}</div>
                                <p className="text-xs text-muted-foreground">Successful activities</p>
                            </CardContent>
                        </AnimatedCard>

                        <AnimatedCard animation="slideUp" delay={0.4}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.failed}</div>
                                <p className="text-xs text-muted-foreground">Failed activities</p>
                            </CardContent>
                        </AnimatedCard>
                    </Stagger>

                    {/* Filters */}
                    <AnimatedCard animation="fadeIn" delay={0.5}>
                        <CardHeader>
                            <CardTitle>Search & Filter</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by activity name or target..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-40">
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="failed">Failed</SelectItem>
                                            <SelectItem value="running">Running</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </AnimatedCard>

                    {/* Activity Logs Table */}
                    <AnimatedCard animation="fadeIn" delay={0.6} className="mt-6">
                        <CardHeader>
                            <CardTitle>Activity Logs ({filteredLogs.length})</CardTitle>
                            <CardDescription>
                                Detailed history of your message sending activities
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {filteredLogs.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    {searchQuery || statusFilter !== 'all'
                                        ? 'No activity logs found matching your filters.'
                                        : 'No activity logs yet.'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Activity Name</TableHead>
                                                <TableHead>Target Group</TableHead>
                                                <TableHead>Recipients</TableHead>
                                                <TableHead>Success Rate</TableHead>
                                                <TableHead>Duration</TableHead>
                                                <TableHead>Started</TableHead>
                                                <TableHead>Actions</TableHead>
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
                                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-medium">{log.template_name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center space-x-2">
                                                            <Users className="h-4 w-4 text-muted-foreground" />
                                                            <Badge variant="outline">{log.contact_group_id || 'Unknown Group'}</Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            <div>{log.total_contacts} total</div>
                                                            <div className="text-green-600">{log.success_count} success</div>
                                                            {log.failed_count > 0 && (
                                                                <div className="text-red-600">{log.failed_count} failed</div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            {log.total_contacts > 0 ? (
                                                                <span className={
                                                                    (log.success_count / log.total_contacts) >= 0.9 ? 'text-green-600' :
                                                                        (log.success_count / log.total_contacts) >= 0.7 ? 'text-yellow-600' :
                                                                            'text-red-600'
                                                                }>
                                                                    {((log.success_count / log.total_contacts) * 100).toFixed(1)}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">N/A</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm text-muted-foreground">
                                                            {calculateDuration(log.started_at || '', log.completed_at)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm text-muted-foreground">
                                                            {formatDate(log.started_at || '')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex space-x-2">
                                                            <Button variant="ghost" size="sm">
                                                                View Details
                                                            </Button>
                                                        </div>
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

export function CampaignHistoryPage() {
    const { historyService, isInitialized } = useServices();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const data = await historyService.getActivityLogs();
            setLogs(data);
        } catch (err) {
            console.error('Failed to load campaign logs:', err);
            const appError = handleServiceError(err, 'loadHistory');
            setError(appError.message);
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
                (log.template_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.contact_group_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.status.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredLogs(filtered);
    };

    const getStatusIcon = (status: ActivityLog['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />;
            case 'running':
                return <Loader className="h-4 w-4 text-blue-600" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            default:
                return <AlertTriangle className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStatusBadge = (status: ActivityLog['status']) => {
        const variants = {
            completed: 'default',
            failed: 'destructive',
            running: 'secondary',
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

    const calculateDuration = (started: string, completed?: string) => {
        if (!completed) return 'N/A';

        const start = new Date(started).getTime();
        const end = new Date(completed).getTime();
        const duration = end - start;

        if (duration < 60000) {
            return `${Math.round(duration / 1000)}s`;
        } else {
            return `${Math.round(duration / 60000)}m`;
        }
    };

    const getStats = () => {
        const total = logs.length;
        const completed = logs.filter(l => l.status === 'completed').length;
        const failed = logs.filter(l => l.status === 'failed').length;
        const running = logs.filter(l => l.status === 'running').length;
        const pending = logs.filter(l => l.status === 'pending').length;

        const totalMessages = logs.reduce((sum, log) => sum + log.total_contacts, 0);
        const successMessages = logs.reduce((sum, log) => sum + log.success_count, 0);
        const failedMessages = logs.reduce((sum, log) => sum + log.failed_count, 0);

        return {
            total,
            completed,
            failed,
            running,
            pending,
            totalMessages,
            successMessages,
            failedMessages,
            successRate: totalMessages > 0 ? ((successMessages / totalMessages) * 100).toFixed(1) : '0'
        };
    };

    const stats = getStats();

    if (isLoading) {
        return <LoadingScreen message="Loading activity history..." />;
    }

    if (error) {
        return <ErrorScreen error={error} onRetry={loadData} />;
    }

    return (
        <CampaignHistoryPageContent
            filteredLogs={filteredLogs}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            getStatusIcon={getStatusIcon}
            getStatusBadge={getStatusBadge}
            formatDate={formatDate}
            calculateDuration={calculateDuration}
            stats={stats}
        />
    );
}
