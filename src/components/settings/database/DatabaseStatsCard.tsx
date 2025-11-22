import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, UsersRound, Database } from 'lucide-react';
import { db } from '@/lib/db';

interface DatabaseStats {
    contactsCount: number;
    messagesCount: number;
    groupsCount: number;
    databaseSize: string;
}

export function DatabaseStatsCard() {
    const [stats, setStats] = useState<DatabaseStats>({
        contactsCount: 0,
        messagesCount: 0,
        groupsCount: 0,
        databaseSize: 'Calculating...',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [contacts, messages, groups] = await Promise.all([
                    db.contacts.count(),
                    db.activityLogs.count(),
                    db.groups.count(),
                ]);

                // Estimate database size (rough calculation)
                // Assuming avg sizes: Contact ~2KB, Message ~1KB, Group ~3KB
                const estimatedSize = ((contacts * 2) + (messages * 1) + (groups * 3)); // KB
                const sizeStr = estimatedSize > 1024
                    ? `${(estimatedSize / 1024).toFixed(2)} MB`
                    : `${estimatedSize.toFixed(2)} KB`;

                setStats({
                    contactsCount: contacts,
                    messagesCount: messages,
                    groupsCount: groups,
                    databaseSize: sizeStr,
                });
            } catch (error) {
                console.error('Failed to fetch database stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const statItems = [
        {
            label: 'Contacts',
            value: stats.contactsCount.toLocaleString(),
            icon: Users,
            color: 'text-blue-500',
        },
        {
            label: 'Activity Logs',
            value: stats.messagesCount.toLocaleString(),
            icon: MessageSquare,
            color: 'text-green-500',
        },
        {
            label: 'Groups',
            value: stats.groupsCount.toLocaleString(),
            icon: UsersRound,
            color: 'text-purple-500',
        },
        {
            label: 'Est. Size',
            value: stats.databaseSize,
            icon: Database,
            color: 'text-orange-500',
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Database Statistics</CardTitle>
                <CardDescription>
                    Local database usage and storage information
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    {statItems.map((item) => (
                        <div
                            key={item.label}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                        >
                            <item.icon className={`h-5 w-5 ${item.color}`} />
                            <div>
                                <p className="text-sm text-muted-foreground">{item.label}</p>
                                <p className="text-lg font-semibold">
                                    {loading ? '...' : item.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
