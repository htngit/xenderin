// Upload Xenderin Logo to Supabase Storage
// Run: node upload-logo.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const supabaseUrl = 'https://xasuqqebngantzaenmwq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhc3VxcWVibmdhbnR6YWVubXdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUzMjM5NywiZXhwIjoyMDc4MTA4Mzk3fQ.uO5Qmd2Xmb_xY_xfiZZOz0gC6HnIVCH2VS1-ELC858E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadLogo() {
    try {
        console.log('📤 Uploading Xenderin logo to Supabase Storage...');

        // Read logo file
        const logoPath = resolve('C:/Users/andry/.gemini/antigravity/brain/8b897930-fc57-4687-b517-720f4407ac25/uploaded_image_1763740087952.png');
        const logoBuffer = readFileSync(logoPath);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('assets')
            .upload('branding/xenderin-logo.png', logoBuffer, {
                contentType: 'image/png',
                upsert: true, // Overwrite if exists
            });

        if (error) {
            console.error('❌ Upload failed:', error.message);
            process.exit(1);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('assets')
            .getPublicUrl('branding/xenderin-logo.png');

        console.log('✅ Logo uploaded successfully!');
        console.log('📍 Public URL:', publicUrlData.publicUrl);
        console.log('\n💡 Use this URL in invoice generation Edge Function');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

uploadLogo();
