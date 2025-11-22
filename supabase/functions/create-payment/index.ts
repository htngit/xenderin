import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHash } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')!
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { plan_id, payment_method, return_url } = await req.json()

        const { data: plan, error: planError } = await supabase
            .from('pricing_plans')
            .select('*')
            .eq('id', plan_id)
            .single()

        if (planError || !plan) throw new Error('Plan not found')

        const merchantOrderId = `ORD-${Date.now()}-${user.id.substring(0, 8)}`

        const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE')
        const apiKey = Deno.env.get('DUITKU_API_KEY')

        console.log('Secrets Check:', {
            hasMerchantCode: !!merchantCode,
            merchantCodeLength: merchantCode ? merchantCode.length : 0,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0
        })

        if (!merchantCode || !apiKey) {
            throw new Error('Server configuration error: Missing Duitku credentials')
        }

        const amountInt = Math.round(parseFloat(plan.price.toString()))

        const signature = generateSignature(merchantCode, merchantOrderId, amountInt, apiKey)

        const duitkuBody: any = {
            merchantCode: merchantCode,
            paymentAmount: amountInt,
            paymentMethod: payment_method,
            merchantOrderId: merchantOrderId,
            productDetails: `${plan.plan_name} Subscription`,
            email: user.email,
            customerVaName: user.email?.split('@')[0] || 'Customer',
            callbackUrl: Deno.env.get('DUITKU_CALLBACK_URL') || 'https://xasuqqebngantzaenmwq.supabase.co/functions/v1/payment-webhook',
            returnUrl: return_url || Deno.env.get('DUITKU_RETURN_URL') || 'http://localhost:5173/settings',
            signature: signature,
            expiryPeriod: 1440
        }

        // Add accountLink for OVO LINK (OL) payment method
        if (payment_method === 'OL') {
            duitkuBody.accountLink = {
                credentialCode: Deno.env.get('DUITKU_OVO_CREDENTIAL_CODE') || '7cXXXXX-XXXX-XXXX-9XXX-944XXXXXXX8',
                ovo: {
                    paymentDetails: [{
                        paymentType: 'CASH',
                        amount: amountInt.toString()
                    }]
                }
            }
        }

        console.log('Duitku Request:', JSON.stringify(duitkuBody))

        const duitkuResponse = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(duitkuBody)
        })

        const duitkuData = await duitkuResponse.json()
        console.log('Duitku Response:', JSON.stringify(duitkuData))

        if (duitkuData.statusCode !== '00') {
            throw new Error(`Duitku Error: ${duitkuData.statusMessage}`)
        }

        const { data: transaction, error: transError } = await supabase
            .from('payment_transactions')
            .insert({
                user_id: user.id,
                transaction_id: duitkuData.reference,
                merchant_order_id: merchantOrderId,
                amount: amountInt,
                payment_method: payment_method,
                status: 'pending',
                plan_purchased: plan.plan_type,
                quota_added: plan.quota,
                duitku_reference: duitkuData.reference,
                duitku_payment_url: duitkuData.paymentUrl,
                duitku_qr_string: duitkuData.qrString,
                duitku_va_number: duitkuData.vaNumber,
                total_amount: amountInt,
                expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
            })
            .select()
            .single()

        if (transError) throw transError

        return new Response(JSON.stringify(transaction), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Error creating payment:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

function generateSignature(merchantCode: string, orderId: string, amount: number, apiKey: string): string {
    const str = `${merchantCode}${orderId}${amount}${apiKey}`
    return createHash('md5').update(str).digest('hex')
}
