import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, FileText, Image as ImageIcon, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntl } from 'react-intl';
import { AssetSelector } from './AssetSelector';
import { AssetFile } from '@/lib/services';
import { cn } from '@/lib/utils';

interface ChatInputProps {
    onSendMessage: (content: string, asset?: AssetFile) => Promise<void>;
    disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<AssetFile | undefined>(undefined);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const intl = useIntl();

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [message, selectedAsset]);

    const handleSend = async () => {
        if ((!message.trim() && !selectedAsset) || isSending || disabled) return;

        try {
            setIsSending(true);
            await onSendMessage(message.trim(), selectedAsset);
            setMessage('');
            setSelectedAsset(undefined);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.focus();
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleAssetSelect = (asset: AssetFile) => {
        setSelectedAsset(asset);
        setIsSelectorOpen(false);
        // Automatically focus textarea after selection
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const getFileIcon = (category: string) => {
        switch (category) {
            case 'image': return <ImageIcon className="h-4 w-4" />;
            case 'video': return <Video className="h-4 w-4" />;
            case 'audio': return <Music className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    return (
        <div className="p-3 bg-white border-t border-gray-200">
            {/* Asset Preview */}
            {selectedAsset && (
                <div className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 shrink-0 rounded bg-gray-200 flex items-center justify-center overflow-hidden border">
                            {selectedAsset.category === 'image' || (selectedAsset.category === 'video' && selectedAsset.file_url) ? (
                                <img
                                    src={selectedAsset.file_url || selectedAsset.url}
                                    alt={selectedAsset.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="text-gray-500">
                                    {getFileIcon(selectedAsset.category)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate max-w-[200px]">{selectedAsset.name}</span>
                            <span className="text-xs text-gray-500 capitalize">{selectedAsset.category}</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-gray-200 rounded-full"
                        onClick={() => setSelectedAsset(undefined)}
                    >
                        <X className="h-4 w-4 text-gray-500" />
                    </Button>
                </div>
            )}

            <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8 mb-1 shrink-0 text-gray-500 hover:text-primary hover:bg-primary/10"
                    onClick={() => setIsSelectorOpen(true)}
                    disabled={disabled || isSending}
                >
                    <Paperclip className="h-4 w-4" />
                </Button>

                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={intl.formatMessage({ id: 'inbox.input.placeholder', defaultMessage: 'Type a message...' })}
                    className="flex-1 max-h-[120px] bg-transparent border-0 focus:ring-0 resize-none py-2 px-1 text-sm leading-relaxed"
                    rows={1}
                    disabled={disabled || isSending}
                />

                <Button
                    size="icon"
                    className={cn(
                        "rounded-full h-8 w-8 mb-1 shrink-0 transition-all",
                        (message.trim() || selectedAsset) ? "bg-primary text-primary-foreground" : "bg-gray-200 text-gray-400"
                    )}
                    onClick={handleSend}
                    disabled={(!message.trim() && !selectedAsset) || isSending || disabled}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>

            <AssetSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                onSelect={handleAssetSelect}
            />
        </div>
    );
}
