import { supabase } from '@/lib/supabase';

export const billingService = {
    /**
     * Get billing information for current user
     */
    async getBillingInfo(userId: string) {
        const { data, error } = await supabase
            .from('billing_information')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching billing info:', error);
            throw error;
        }
        return data;
    },

    /**
     * Save or update billing information
     */
    async saveBillingInfo(userId: string, billingData: {
        full_name: string;
        company_name?: string;
        tax_id?: string;
        email: string;
        phone?: string;
        street_address: string;
        city: string;
        state: string;
        postal_code: string;
        country?: string;
    }) {
        const { data, error } = await supabase
            .from('billing_information')
            .upsert({
                user_id: userId,
                ...billingData,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving billing info:', error);
            throw error;
        }
        return data;
    },

    /**
     * Get refund requests for current user
     */
    async getRefundRequests(userId: string) {
        const { data, error } = await supabase
            .from('refund_requests')
            .select(`
        *,
        transaction:payment_transactions(
          transaction_id,
          amount,
          plan_purchased,
          created_at
        )
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching refund requests:', error);
            throw error;
        }
        return data;
    },

    /**
     * Create a new refund request
     */
    async createRefundRequest(userId: string, refundData: {
        transaction_id: string;
        reason: string;
        details: string;
        bank_name: string;
        account_number: string;
        account_holder: string;
    }) {
        // Generate refund number
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(10000 + Math.random() * 90000);
        const refundNumber = `REF-${year}-${month}-${random}`;

        const { data, error } = await supabase
            .from('refund_requests')
            .insert({
                user_id: userId,
                ...refundData,
                refund_number: refundNumber,
                status: 'submitted',
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating refund request:', error);
            throw error;
        }
        return data;
    },

    /**
     * Generate invoice for a transaction
     */
    async generateInvoice(transactionId: string) {
        const { data, error } = await supabase.functions.invoke('generate-invoice', {
            body: { transaction_id: transactionId }
        });

        if (error) {
            console.error('Error generating invoice:', error);
            throw error;
        }
        return data;
    },
};
