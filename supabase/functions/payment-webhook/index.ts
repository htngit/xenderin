import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    try {
        // 1. Parse DUITKU webhook
        // Content-Type is usually application/x-www-form-urlencoded or application/json
        // Duitku sends x-www-form-urlencoded by default, but can be JSON.
        // We'll try to parse as JSON or FormData.
        let payload: any = {}
        const contentType = req.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
            payload = await req.json()
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData()
            formData.forEach((value, key) => {
                payload[key] = value
            })
        } else {
            // Fallback text parsing if needed
            const text = await req.text()
            console.log('Unknown content type body:', text)
            throw new Error('Unsupported Content-Type')
        }

        console.log('Webhook Payload:', JSON.stringify(payload))

        const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE')
        const apiKey = Deno.env.get('DUITKU_API_KEY')

        if (!merchantCode || !apiKey) {
            throw new Error('Server configuration error')
        }

        // 2. Verify signature
        // Callback Signature: MD5(merchantCode + amount + merchantOrderId + apiKey)
        // Note: amount might need to be integer string or exact string from payload
        const signatureStr = `${merchantCode}${payload.amount}${payload.merchantOrderId}${apiKey}`
        const calculatedSignature = md5(signatureStr)

        if (calculatedSignature !== payload.signature) {
            console.error('Signature mismatch', { expected: calculatedSignature, received: payload.signature })
            throw new Error('Invalid signature')
        }

        // 3. Get transaction
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use Service Role for updates
        )

        const { data: transaction, error: transError } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('merchant_order_id', payload.merchantOrderId)
            .single()

        if (transError || !transaction) {
            throw new Error('Transaction not found')
        }

        // 4. Update transaction status
        const isSuccess = payload.resultCode === '00'
        const status = isSuccess ? 'success' : 'failed'

        await supabase
            .from('payment_transactions')
            .update({
                status: status,
                paid_at: isSuccess ? new Date() : null,
                duitku_reference: payload.reference,
                updated_at: new Date()
            })
            .eq('id', transaction.id)

        // 5. Update subscription if success
        if (isSuccess) {
            // Determine new validity
            // If monthly, add 1 month. If yearly, add 1 year.
            // We need to know the plan details or infer from transaction.
            // Transaction has plan_purchased (e.g. 'basic', 'pro')
            // But we don't know if it was monthly or yearly unless we query pricing_plans or store it in transaction.
            // We stored plan_purchased as 'basic' or 'pro'.
            // Let's query the subscription to see current state or just add 30 days default if we lack info.
            // Better: Query pricing_plans to find the plan match or assume monthly for now if not stored.
            // Wait, we stored `plan_purchased` in transaction.
            // We should have stored `billing_cycle` in transaction too, but schema didn't have it explicitly?
            // Schema: `plan_purchased` TEXT.
            // Let's assume 30 days for now or fetch the plan from `pricing_plans` using the amount?
            // Or just update `subscriptions` and let the user manage cycle.
            // Plan says: "Update subscription... valid_until: new Date(Date.now() + 30 * 24...)"

            // Let's try to be smarter.
            // We can check the amount against pricing plans to guess the cycle.
            const { data: plan } = await supabase
                .from('pricing_plans')
                .select('*')
                .eq('plan_type', transaction.plan_purchased)
                .eq('price', transaction.amount)
                .single()

            let interval = '1 month'
            if (plan && plan.billing_cycle === 'yearly') {
                interval = '1 year'
            }

            // Update subscription
            // We use SQL interval logic or JS date math.
            // Using JS date math for simplicity.
            const now = new Date()
            let validUntil = new Date(now)
            if (interval === '1 year') {
                validUntil.setFullYear(validUntil.getFullYear() + 1)
            } else {
                validUntil.setDate(validUntil.getDate() + 30)
            }

            await supabase
                .from('subscriptions')
                .update({
                    plan_type: transaction.plan_purchased,
                    status: 'active',
                    price: transaction.amount,
                    billing_cycle: plan?.billing_cycle || 'monthly',
                    valid_from: now,
                    valid_until: validUntil,
                    quota_reset_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Reset in 30 days
                    updated_at: now
                })
                .eq('master_user_id', transaction.user_id)

            // 6. Generate invoice (Async invoke)
            // await supabase.functions.invoke('generate-invoice', {
            //   body: { transaction_id: transaction.id }
            // })
        }

        return new Response('OK', { status: 200 })

    } catch (error) {
        console.error('Webhook Error:', error)
        return new Response(error.message, { status: 400 })
    }
})

// MD5 Implementation (Same as create-payment)
function md5(string: string) {
    function RotateLeft(lValue: number, iShiftBits: number) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function AddUnsigned(lX: number, lY: number) {
        var lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) {
            return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        }
        if (lX4 | lY4) {
            if (lResult & 0x40000000) {
                return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            } else {
                return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
            }
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function F(x: number, y: number, z: number) { return (x & y) | ((~x) & z); }
    function G(x: number, y: number, z: number) { return (x & z) | (y & (~z)); }
    function H(x: number, y: number, z: number) { return (x ^ y ^ z); }
    function I(x: number, y: number, z: number) { return (y ^ (x | (~z))); }
    function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function ConvertToWordArray(string: string) {
        var lWordCount;
        var lMessageLength = string.length;
        var lNumberOfWords_temp1 = lMessageLength + 8;
        var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        var lWordArray = Array(lNumberOfWords - 1);
        var lBytePosition = 0;
        var lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function WordToHex(lValue: number) {
        var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    }
    var x = ConvertToWordArray(string);
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
    }
}
