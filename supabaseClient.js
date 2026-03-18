// supabaseClient.js
const SUPABASE_URL = 'https://brsoehxzpqhzgnsqivrq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pg9IZUYCihI7NiaS0NDHxQ_i7WqmCv6';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper for Base64 Encoding (Encryption Simulation for Email)
function encryptEmail(email) {
    return btoa(email);
}

// Helper for Base64 Decoding
function decryptEmail(encryptedEmail) {
    try {
        return atob(encryptedEmail);
    } catch (e) {
        return encryptedEmail; // Fallback if not valid base64
    }
}
