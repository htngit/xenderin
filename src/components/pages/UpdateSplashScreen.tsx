import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface AppUpdateInfo {
    version: string;
    version_code: number;
    download_url: string;
    release_notes: string;
    is_mandatory: boolean;
    platform: string;
    is_latest: boolean;
}

interface UpdateSplashScreenProps {
    updateInfo: AppUpdateInfo;
    currentVersion: string;
    onLater?: () => void;
}

export function UpdateSplashScreen({ updateInfo, currentVersion, onLater }: UpdateSplashScreenProps) {
    const { version, release_notes, is_mandatory, download_url } = updateInfo;

    const handleUpdate = () => {
        if (download_url) {
            window.open(download_url, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-lg"
                >
                    <Card className="border-primary/20 shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent h-2 w-full" />

                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                        <Download className="h-6 w-6 text-primary" />
                                        Update Available
                                    </CardTitle>
                                    <CardDescription className="text-base">
                                        A new version of Xenderin is available.
                                    </CardDescription>
                                </div>
                                {is_mandatory && (
                                    <div className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-destructive/20">
                                        <AlertTriangle className="h-3 w-3" />
                                        Mandatory
                                    </div>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border/50">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Version</span>
                                    <span className="font-mono text-sm font-medium">{currentVersion}</span>
                                </div>
                                <div className="h-8 w-px bg-border/50 mx-4" />
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-primary uppercase tracking-wider font-semibold">New Version</span>
                                    <span className="font-mono text-lg font-bold text-primary">{version}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    What's New
                                </h4>
                                <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30 p-4">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                                            {release_notes || "No release notes available."}
                                        </pre>
                                    </div>
                                </ScrollArea>
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
                            <Button
                                onClick={handleUpdate}
                                className="w-full"
                                size="lg"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Update Now
                            </Button>
                            {!is_mandatory && (
                                <Button variant="ghost" onClick={onLater} className="w-full text-muted-foreground">
                                    Maybe Later
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
