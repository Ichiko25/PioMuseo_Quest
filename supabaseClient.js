// Include this in your HTML before this script:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js"></script>

// --- Supabase Setup ---
const SUPABASE_URL = 'https://brsoehxzpqhzgnsqivrq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pg9IZUYCihI7NiaS0NDHxQ_i7WqmCv6';

// Initialize Supabase Client
 const supabaseClient = window.supabase.createClient(
    "https://brsoehxzpqhzgnsqivrq.supabase.co",
    "sb_publishable_pg9IZUYCihI7NiaS0NDHxQ_i7WqmCv6"
  );

  async function testInsert() {
    const { data, error } = await supabaseClient
      .from('visitor_logs')
      .insert([{
        player_name: 'Test Player',
        location: 'Browser Test',
        total_visitors: 1,
        total_male: 1,
        total_female: 0,
        age_11_below: 0,
        age_18_group: 1,
        age_30_above: 0,
        game_finishes: 1
      }]);

    if (error) {
      console.error("Insert failed:", error);
      document.body.innerHTML += "<p style='color:red;'>Insert Failed</p>";
    } else {
      console.log("Insert succeeded:", data);
      document.body.innerHTML += "<p style='color:green;'>Insert Succeeded</p>";
    }
  }

  testInsert();

// --- Helper Functions ---

// Base64 encode (simulate "encryption") for email
function encryptEmail(email) {
    return btoa(email);
}

// Base64 decode
function decryptEmail(encryptedEmail) {
    try {
        return atob(encryptedEmail);
    } catch (e) {
        return encryptedEmail; // Fallback if not valid Base64
    }
}

// --- Example Usage ---
// encryptEmail('test@example.com') => returns Base64 string
// decryptEmail('dGVzdEBleGFtcGxlLmNvbQ==') => returns original email
