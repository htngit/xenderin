import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntl } from 'react-intl';

interface ChatInputProps {
    onSendMessage: (content: string) => Promise<void>;
    disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const intl = useIntl();

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [message]);

    const handleSend = async () => {
        if (!message.trim() || isSending || disabled) return;

        try {
            setIsSending(true);
            await onSendMessage(message.trim());
            setMessage('');
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

    return (
        <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
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
                    className="rounded-full h-8 w-8 mb-1 shrink-0"
                    onClick={handleSend}
                    disabled={!message.trim() || isSending || disabled}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
