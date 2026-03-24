// ===============================
// SUPABASE CONFIG
// ===============================
const SUPABASE_URL = 'https://brsoehxzpqhzgnsqivrq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pg9IZUYCihI7NiaS0NDHxQ_i7WqmCv6';

// VERY IMPORTANT: this must be GLOBAL
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Wait until page is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    // ===============================
    // TEST INSERT FUNCTION
    // ===============================
    async function testInsert() {
        try {
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
                console.error("❌ Insert failed:", error);
                document.body.innerHTML += "<p style='color:red;'>❌ Insert Failed</p>";
            } else {
                console.log("✅ Insert succeeded:", data);
                document.body.innerHTML += "<p style='color:green;'>✅ Insert Succeeded</p>";
            }

        } catch (err) {
            console.error("Unexpected error:", err);
            document.body.innerHTML += "<p style='color:red;'>❌ Unexpected Error</p>";
        }
    }

    // Run test
    testInsert();
});


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
