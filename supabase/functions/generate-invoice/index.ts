import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsPDF } from 'https://cdn.skypack.dev/jspdf@2.5.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get user from auth header
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get request body
        const { transaction_id } = await req.json();

        if (!transaction_id) {
            return new Response(
                JSON.stringify({ error: 'transaction_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch transaction details
        const { data: transaction, error: txError } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('id', transaction_id)
            .eq('user_id', user.id)
            .single();

        if (txError || !transaction) {
            return new Response(
                JSON.stringify({ error: 'Transaction not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Only generate invoice for successful payments
        if (transaction.status !== 'success') {
            return new Response(
                JSON.stringify({ error: 'Invoice can only be generated for successful payments' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch billing information (optional)
        const { data: billingInfo } = await supabase
            .from('billing_information')
            .select('*')
            .eq('user_id', user.id)
            .single();

        // Generate invoice number if not exists
        let invoiceNumber = transaction.invoice_number;
        if (!invoiceNumber) {
            const date = new Date(transaction.created_at);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const random = Math.random().toString(36).substring(2, 7).toUpperCase();
            invoiceNumber = `INV-${year}${month}-${random}`;
        }

        // Create PDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Company Logo (centered)
        const logoUrl = 'https://xasuqqebngantzaenmwq.supabase.co/storage/v1/object/public/assets/branding/Xenderin%20Logo.png';
        // Note: jsPDF in Deno might not support image loading from URL directly
        // For now, we'll use text-based header

        // Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('XENDER-IN', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('WhatsApp Automation Platform', pageWidth / 2, 28, { align: 'center' });
        doc.text('support@xenderin.com', pageWidth / 2, 34, { align: 'center' });

        // Invoice Title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', pageWidth / 2, 50, { align: 'center' });

        // Invoice Details
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Invoice Number: ${invoiceNumber}`, 20, 65);
        doc.text(`Date: ${new Date(transaction.created_at).toLocaleDateString('id-ID')}`, 20, 72);
        doc.text(`Transaction ID: ${transaction.transaction_id}`, 20, 79);
        doc.text(`Status: PAID`, 20, 86);

        // Bill To Section
        doc.setFont('helvetica', 'bold');
        doc.text('BILL TO:', 20, 100);
        doc.setFont('helvetica', 'normal');

        let yPos = 107;
        if (billingInfo) {
            doc.text(billingInfo.full_name, 20, yPos);
            yPos += 7;
            if (billingInfo.company_name) {
                doc.text(billingInfo.company_name, 20, yPos);
                yPos += 7;
            }
            doc.text(billingInfo.email, 20, yPos);
            yPos += 7;
            if (billingInfo.phone) {
                doc.text(billingInfo.phone, 20, yPos);
                yPos += 7;
            }
            if (billingInfo.street_address) {
                doc.text(billingInfo.street_address, 20, yPos);
                yPos += 7;
            }
            if (billingInfo.city && billingInfo.postal_code) {
                doc.text(`${billingInfo.city}, ${billingInfo.postal_code}`, 20, yPos);
                yPos += 7;
            }
            if (billingInfo.tax_id) {
                doc.text(`NPWP: ${billingInfo.tax_id}`, 20, yPos);
                yPos += 7;
            }
        } else {
            doc.text(user.email || 'N/A', 20, yPos);
            yPos += 7;
        }

        // Line Items Table
        yPos += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('DESCRIPTION', 20, yPos);
        doc.text('AMOUNT', pageWidth - 50, yPos, { align: 'right' });

        // Line
        yPos += 3;
        doc.line(20, yPos, pageWidth - 20, yPos);

        // Item
        yPos += 10;
        doc.setFont('helvetica', 'normal');
        doc.text(transaction.plan_purchased, 20, yPos);
        doc.text(`Rp ${transaction.amount.toLocaleString('id-ID')}`, pageWidth - 50, yPos, { align: 'right' });

        // Subtotal
        yPos += 15;
        doc.text('Subtotal:', pageWidth - 80, yPos);
        doc.text(`Rp ${transaction.amount.toLocaleString('id-ID')}`, pageWidth - 50, yPos, { align: 'right' });

        // Tax (if applicable)
        if (transaction.tax_amount && transaction.tax_amount > 0) {
            yPos += 7;
            doc.text(`Tax (${transaction.tax_percentage}%):`, pageWidth - 80, yPos);
            doc.text(`Rp ${transaction.tax_amount.toLocaleString('id-ID')}`, pageWidth - 50, yPos, { align: 'right' });
        }

        // Total
        yPos += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('TOTAL:', pageWidth - 80, yPos);
        doc.text(`Rp ${(transaction.total_amount || transaction.amount).toLocaleString('id-ID')}`, pageWidth - 50, yPos, { align: 'right' });

        // Payment Method
        yPos += 15;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Payment Method: ${transaction.payment_method}`, 20, yPos);
        doc.text(`Paid At: ${new Date(transaction.paid_at).toLocaleString('id-ID')}`, 20, yPos + 7);

        // Footer
        const footerY = doc.internal.pageSize.getHeight() - 30;
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
        doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, footerY + 7, { align: 'center' });

        // Generate PDF as base64
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        // Upload to Supabase Storage
        const fileName = `invoices/${user.id}/${invoiceNumber}.pdf`;
        const { error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return new Response(
                JSON.stringify({ error: 'Failed to upload invoice' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('invoices')
            .getPublicUrl(fileName);

        // Update transaction with invoice details
        const { error: updateError } = await supabase
            .from('payment_transactions')
            .update({
                invoice_number: invoiceNumber,
                invoice_pdf_url: urlData.publicUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', transaction_id);

        if (updateError) {
            console.error('Update error:', updateError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                invoice_number: invoiceNumber,
                invoice_url: urlData.publicUrl,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
