import * as XLSX from 'xlsx';

export interface ParsedContact {
    name: string;
    phone: string;
    group_id?: string;
    tags?: string[];
    notes?: string;
}

/**
 * Generates and downloads a contact import template
 */
export const generateContactTemplate = () => {
    const headers = ['Name', 'Phone', 'Group Name', 'Tags (comma separated)', 'Notes'];
    const exampleData = [
        ['John Doe', '6281234567890', 'Friends', 'vip, jakarta', 'Met at conference'],
        ['Jane Smith', '081234567890', 'Work', 'colleague', 'Project manager']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts Template');

    // Auto-width columns
    const wscols = [
        { wch: 20 }, // Name
        { wch: 15 }, // Phone
        { wch: 15 }, // Group
        { wch: 30 }, // Tags
        { wch: 30 }, // Notes
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, 'whatsapp_contacts_template.xlsx');
};

/**
 * Parses an uploaded XLS/CSV file into contact objects
 */
export const parseContactsXLS = async (file: File): Promise<ParsedContact[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Convert to JSON with header mapping
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Skip header row
                const rows = jsonData.slice(1) as any[][];

                const parsedContacts: ParsedContact[] = rows
                    .filter(row => row.length > 0 && (row[0] || row[1])) // Filter empty rows
                    .map(row => {
                        // Handle different phone formats
                        let phone = String(row[1] || '').replace(/[^0-9+]/g, '');

                        // Basic phone normalization (optional, service handles strict validation)
                        if (phone.startsWith('0')) {
                            phone = '62' + phone.substring(1);
                        }

                        return {
                            name: String(row[0] || '').trim(),
                            phone: phone,
                            // We'll map group names to IDs in the service or UI layer
                            // For now we pass the group name if provided
                            group_name: String(row[2] || '').trim(),
                            tags: row[3] ? String(row[3]).split(',').map(t => t.trim()) : [],
                            notes: String(row[4] || '').trim()
                        } as any; // Type assertion needed because we're adding temporary group_name
                    });

                resolve(parsedContacts);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};
