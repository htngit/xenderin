import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssetService, AssetFile } from '@/lib/services';
import { Search, Image as ImageIcon, Video, FileText, Music, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AssetSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: AssetFile) => void;
}

export function AssetSelector({ isOpen, onClose, onSelect }: AssetSelectorProps) {
    const [assets, setAssets] = useState<AssetFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    // Initialize service
    const assetService = new AssetService();

    useEffect(() => {
        if (isOpen) {
            loadAssets();
        }
    }, [isOpen]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            // Get WhatsApp compatible assets only, as we are in chat context
            const data = await assetService.getWhatsAppCompatibleAssets();
            setAssets(data);
        } catch (error) {
            console.error('Failed to load assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = assets.filter(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab = activeTab === 'all' || asset.category === activeTab;
        return matchesSearch && matchesTab;
    });

    const getIcon = (category: string) => {
        switch (category) {
            case 'image': return <ImageIcon className="h-4 w-4" />;
            case 'video': return <Video className="h-4 w-4" />;
            case 'audio': return <Music className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Select Asset</DialogTitle>
                </DialogHeader>

                <div className="p-4 border-b bg-muted/40 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search assets..."
                            className="pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                        <div className="px-4 pt-2">
                            <TabsList className="w-full justify-start overflow-x-auto">
                                <TabsTrigger value="all" className="flex gap-2">
                                    All
                                </TabsTrigger>
                                <TabsTrigger value="image" className="flex gap-2">
                                    <ImageIcon className="h-4 w-4" /> Images
                                </TabsTrigger>
                                <TabsTrigger value="video" className="flex gap-2">
                                    <Video className="h-4 w-4" /> Videos
                                </TabsTrigger>
                                <TabsTrigger value="document" className="flex gap-2">
                                    <FileText className="h-4 w-4" /> Documents
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            {loading ? (
                                <div className="flex items-center justify-center h-40 text-muted-foreground">
                                    Loading assets...
                                </div>
                            ) : filteredAssets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                    <AlertCircle className="h-8 w-8 opacity-50" />
                                    <p>No suitable assets found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                                    {filteredAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => onSelect(asset)}
                                            className={cn(
                                                "group relative border rounded-lg overflow-hidden cursor-pointer bg-background hover:border-primary transition-all hover:shadow-md",
                                                "aspect-square flex flex-col"
                                            )}
                                        >
                                            {/* Preview Area */}
                                            <div className="flex-1 bg-muted/30 relative flex items-center justify-center overflow-hidden">
                                                {asset.category === 'image' ? (
                                                    <img
                                                        src={asset.file_url || asset.url}
                                                        alt={asset.name}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="text-muted-foreground/50 group-hover:text-primary transition-colors">
                                                        {getIcon(asset.category)}
                                                    </div>
                                                )}

                                                {/* Overlay on hover */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <Button variant="secondary" size="sm" className="shadow-sm">
                                                        Select
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Info Area */}
                                            <div className="p-3 bg-card border-t text-xs">
                                                <div className="font-medium truncate mb-1" title={asset.name}>
                                                    {asset.name}
                                                </div>
                                                <div className="flex items-center justify-between text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        {getIcon(asset.category)} {asset.category}
                                                    </span>
                                                    <span>{formatSize(asset.file_size || asset.size || 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
