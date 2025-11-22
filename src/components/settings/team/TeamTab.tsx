import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Users, Shield, BarChart3, FileText, Zap } from 'lucide-react';

export function TeamTab() {
    const upcomingFeatures = [
        {
            icon: Users,
            title: 'Team Member Management',
            description: 'Add and manage team members with different access levels',
        },
        {
            icon: Shield,
            title: 'Role-Based Permissions',
            description: 'Control what each team member can access and modify',
        },
        {
            icon: FileText,
            title: 'Shared Templates',
            description: 'Create and share message templates across your team',
        },
        {
            icon: BarChart3,
            title: 'Team Analytics',
            description: 'Track team performance and message statistics',
        },
        {
            icon: Zap,
            title: 'Workflow Automation',
            description: 'Automate team workflows and approval processes',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Team Management</h2>
                <p className="text-muted-foreground">
                    Collaborate with your team (Coming Soon)
                </p>
            </div>

            <Card className="border-2 border-dashed">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-2xl">Team Management Coming Soon</CardTitle>
                    <CardDescription className="text-base">
                        This feature will be available in our upcoming CRM plan
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {upcomingFeatures.map((feature) => (
                            <div
                                key={feature.title}
                                className="flex gap-3 p-4 rounded-lg border bg-muted/50"
                            >
                                <feature.icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium mb-1">{feature.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-6 text-center space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">
                                Interested in Team Features?
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Stay tuned for updates!
                            </p>
                        </div>
                    </div>

                    <div className="text-center text-xs text-muted-foreground">
                        <p>Expected Release: in 2026</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
