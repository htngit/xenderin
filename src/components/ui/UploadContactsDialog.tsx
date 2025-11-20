import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { generateContactTemplate, parseContactsXLS, ParsedContact } from '@/lib/utils/xlsHandler';
import { useServices } from '@/lib/services/ServiceContext';
import { toast } from '@/hooks/use-toast';

interface UploadContactsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function UploadContactsDialog({ open, onOpenChange, onSuccess }: UploadContactsDialogProps) {
    const { contactService } = useServices();
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setIsParsing(true);

        try {
            const contacts = await parseContactsXLS(selectedFile);
            if (contacts.length === 0) {
                setError('No valid contacts found in the file. Please check the template.');
            } else {
                setParsedContacts(contacts);
            }
        } catch (err) {
            console.error('Error parsing file:', err);
            setError('Failed to parse file. Please ensure it matches the template format.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleUpload = async () => {
        if (parsedContacts.length === 0) return;

        setIsUploading(true);
        try {
            // Map parsed contacts to the format expected by createContacts
            // Note: We are defaulting some fields here
            const contactsToCreate = parsedContacts.map(c => ({
                name: c.name,
                phone: c.phone,
                group_id: 'default', // This will need to be handled by the service or user selection if we want specific groups
                tags: c.tags || [],
                notes: c.notes || '',
                is_blocked: false
            }));

            const result = await contactService.createContacts(contactsToCreate);

            if (result.success) {
                toast({
                    title: "Upload Successful",
                    description: `Successfully imported ${result.created} contacts.`,
                });
                onSuccess();
                handleClose();
            } else {
                setError(`Failed to upload some contacts. ${result.errors[0] || ''}`);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError('An unexpected error occurred during upload.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setParsedContacts([]);
        setError(null);
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={handleClose}>
            <AlertDialogContent className="sm:max-w-[500px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Upload Contacts</AlertDialogTitle>
                    <AlertDialogDescription>
                        Upload a CSV or Excel file to import contacts in bulk.
                        Download the template to ensure correct formatting.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Template Download */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-8 w-8 text-green-600" />
                            <div>
                                <p className="font-medium">Template File</p>
                                <p className="text-xs text-muted-foreground">Use this format for your data</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={generateContactTemplate}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                    </div>

                    {/* File Upload Area */}
                    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
                        {!file ? (
                            <>
                                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                                <p className="text-xs text-muted-foreground">XLS, XLSX, or CSV files</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <Button
                                    variant="secondary"
                                    className="mt-4"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Select File
                                </Button>
                            </>
                        ) : (
                            <div className="w-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                        <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                        setFile(null);
                                        setParsedContacts([]);
                                        setError(null);
                                    }}>
                                        Change
                                    </Button>
                                </div>

                                {isParsing ? (
                                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Parsing file...
                                    </div>
                                ) : error ? (
                                    <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded text-sm">
                                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                ) : (
                                    <div className="bg-green-50 text-green-700 p-3 rounded text-sm flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <p>Ready to import <strong>{parsedContacts.length}</strong> contacts</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isUploading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleUpload}
                        disabled={!file || isParsing || !!error || isUploading || parsedContacts.length === 0}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Importing...
                            </>
                        ) : (
                            'Import Contacts'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
