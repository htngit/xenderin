import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CreditCard, User, Database, Users } from 'lucide-react';
// import { PaymentTab } from '@/components/settings/payment/PaymentTab';
import { ProfileTab } from '@/components/settings/profile/ProfileTab';
import { DatabaseTab } from '@/components/settings/database/DatabaseTab';
import { TeamTab } from '@/components/settings/team/TeamTab';
import { FormattedMessage } from 'react-intl';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

interface SettingsPageProps {
  userName: string;
}

export function SettingsPage({ userName }: SettingsPageProps) {
  const navigate = useNavigate();


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <FormattedMessage id="common.button.back" defaultMessage="Back" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                <FormattedMessage id="settings.title" defaultMessage="Settings" />
              </h1>
              <p className="text-gray-600">
                <FormattedMessage
                  id="settings.subtitle"
                  defaultMessage="Welcome, {name} - Manage your account and preferences"
                  values={{ name: userName }}
                />
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 lg:w-auto lg:inline-grid mb-6">
            <a
              href="https://xalesin.space/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">
                  <FormattedMessage id="settings.tab.payment" defaultMessage="Payment & Subscription" />
                </span>
                <span className="sm:hidden">
                  <FormattedMessage id="settings.tab.payment.short" defaultMessage="Payment" />
                </span>
              </div>
            </a>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">
                <FormattedMessage id="settings.tab.profile" defaultMessage="Account & Profile" />
              </span>
              <span className="sm:hidden">
                <FormattedMessage id="settings.tab.profile.short" defaultMessage="Profile" />
              </span>
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">
                <FormattedMessage id="settings.tab.database" defaultMessage="Database & Sync" />
              </span>
              <span className="sm:hidden">
                <FormattedMessage id="settings.tab.database.short" defaultMessage="Database" />
              </span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">
                <FormattedMessage id="settings.tab.team" defaultMessage="Team" />
              </span>
              <span className="sm:hidden">
                <FormattedMessage id="settings.tab.team.short" defaultMessage="Team" />
              </span>
            </TabsTrigger>
          </TabsList>

          {/* <TabsContent value="payment">
            <PaymentTab />
          </TabsContent> */}

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTab />
          </TabsContent>

          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}