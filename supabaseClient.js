// ===============================
// SUPABASE CONFIG
// ===============================
const SUPABASE_URL = 'https://brsoehxzpqhzgnsqivrq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pg9IZUYCihI7NiaS0NDHxQ_i7WqmCv6';

// VERY IMPORTANT: this must be GLOBAL
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);




// ===============================
// HELPER FUNCTIONS
// ===============================

// Encode email (Base64)
function encryptEmail(email) {
    return btoa(email);
}

// Decode email (Base64)
function decryptEmail(encryptedEmail) {
    try {
        return atob(encryptedEmail);
    } catch (e) {
        return encryptedEmail;
    }
}
