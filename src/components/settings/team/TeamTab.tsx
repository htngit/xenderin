import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Users, Shield, BarChart3, FileText, Zap } from 'lucide-react';
import { FormattedMessage } from 'react-intl';

export function TeamTab() {
    const upcomingFeatures = [
        {
            icon: Users,
            titleId: 'settings.team.feature.members',
            descriptionId: 'settings.team.feature.members.desc',
            defaultTitle: 'Team Member Management',
            defaultDescription: 'Add and manage team members with different access levels',
        },
        {
            icon: Shield,
            titleId: 'settings.team.feature.roles',
            descriptionId: 'settings.team.feature.roles.desc',
            defaultTitle: 'Role-Based Permissions',
            defaultDescription: 'Control what each team member can access and modify',
        },
        {
            icon: FileText,
            titleId: 'settings.team.feature.templates',
            descriptionId: 'settings.team.feature.templates.desc',
            defaultTitle: 'Shared Templates',
            defaultDescription: 'Create and share message templates across your team',
        },
        {
            icon: BarChart3,
            titleId: 'settings.team.feature.analytics',
            descriptionId: 'settings.team.feature.analytics.desc',
            defaultTitle: 'Team Analytics',
            defaultDescription: 'Track team performance and message statistics',
        },
        {
            icon: Zap,
            titleId: 'settings.team.feature.workflow',
            descriptionId: 'settings.team.feature.workflow.desc',
            defaultTitle: 'Workflow Automation',
            defaultDescription: 'Automate team workflows and approval processes',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    <FormattedMessage id="settings.team.title" defaultMessage="Team Management" />
                </h2>
                <p className="text-muted-foreground">
                    <FormattedMessage id="settings.team.subtitle" defaultMessage="Collaborate with your team (Coming Soon)" />
                </p>
            </div>

            <Card className="border-2 border-dashed">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-2xl">
                        <FormattedMessage id="settings.team.coming_soon.title" defaultMessage="Team Management Coming Soon" />
                    </CardTitle>
                    <CardDescription className="text-base">
                        <FormattedMessage id="settings.team.coming_soon.desc" defaultMessage="This feature will be available in our upcoming CRM plan" />
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {upcomingFeatures.map((feature) => (
                            <div
                                key={feature.titleId}
                                className="flex gap-3 p-4 rounded-lg border bg-muted/50"
                            >
                                <feature.icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium mb-1">
                                        <FormattedMessage id={feature.titleId} defaultMessage={feature.defaultTitle} />
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        <FormattedMessage id={feature.descriptionId} defaultMessage={feature.defaultDescription} />
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-6 text-center space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">
                                <FormattedMessage id="settings.team.interest" defaultMessage="Interested in Team Features?" />
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                <FormattedMessage id="settings.team.updates" defaultMessage="Stay tuned for updates!" />
                            </p>
                        </div>
                    </div>

                    <div className="text-center text-xs text-muted-foreground">
                        <p>
                            <FormattedMessage id="settings.team.release" defaultMessage="Expected Release: in Q3 2026" />
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
