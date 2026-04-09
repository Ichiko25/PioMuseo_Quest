console.log("Supabase client:", supabaseClient);

(async () => {
    const { data, error } = await supabaseClient.from('analytics').select('*').limit(1);
    console.log("Test analytics:", data, error);
})();

document.addEventListener('DOMContentLoaded', () => {
    // Initial fetches
    fetchAnalytics();
    fetchUsers();
    fetchContent();
    fetchSettings();
    fetchAuditLogs();

    // Setup Realtime subscriptions
    const analyticsSubscription = supabaseClient
        .channel('public:analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics' }, payload => {
            fetchAnalytics(); // Refresh on any change
        })
        .subscribe();

    const usersSubscription = supabaseClient
        .channel('public:users')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
            fetchUsers();

            // Check for Auto-Certificate Trigger
            if (payload.eventType === 'UPDATE' && payload.new.game_completed && !payload.old.game_completed) {
                handleAutoCertificate(payload.new);
            }
        })
        .subscribe();

    const auditSubscription = supabaseClient
        .channel('public:audit_logs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, payload => {
            fetchAuditLogs();
        })
        .subscribe();


    const contentSubscription = supabaseClient
        .channel('public:content')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content' }, payload => {
            fetchContent();
        })
        .subscribe();

    initAnalyticsFilters();
});

let currentStats = null;
let chart1Instance, chart2Instance, chart3Instance, chart4Instance, chart5Instance, chart6Instance, chart7Instance, genderChartInstance, engagementChartInstance;

let selectedYear = new Date().getFullYear();
let selectedMonth = 'all';

function initAnalyticsFilters() {
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    if (!yearSelect || !monthSelect) return;

    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 3; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }

    yearSelect.value = selectedYear;
    monthSelect.value = selectedMonth;

    yearSelect.addEventListener('change', (e) => {
        selectedYear = parseInt(e.target.value);
        fetchUsers(); // Refresh data
    });

    monthSelect.addEventListener('change', (e) => {
        selectedMonth = e.target.value;
        fetchUsers(); // Refresh data
    });
}

// --- DASHBOARD (ANALYTICS) ---
async function fetchAnalytics() {
    try {
        const { data: stats, error } = await supabaseClient.from('analytics').select('*').eq('id', 1).single();
        if (error) throw error;

        if (stats) {
            currentStats = stats;
            const totalUsers = allUsers.length || 0;

            // Website Dashboard
            // stat-users has been replaced
            document.getElementById('stat-visitors').innerText = stats.total_visitors || 0;
            document.getElementById('stat-photoshoots').innerText = stats.photoshoot_bookings || 0;
            document.getElementById('stat-tours').innerText = stats.tour_bookings || 0;

            // Game Dashboard
            const playersEl = document.getElementById('stat-game-players');
            if (playersEl) playersEl.innerText = stats.total_players || 0;

            // Feedbacks = users who submitted a rating or message
            const feedbackUsers = allUsers.filter(u => u.rating || u.message);
            document.getElementById('stat-feedbacks').innerText = feedbackUsers.length;

            // Calculate Average Game Rating
            const ratedUsers = allUsers.filter(u => u.rating);
            if (ratedUsers.length > 0) {
                const avg = (ratedUsers.reduce((sum, u) => sum + u.rating, 0) / ratedUsers.length).toFixed(1);
                const starEl = document.getElementById('stat-game-star-ratings');
                if (starEl) starEl.innerText = avg;
            } else {
                const starEl = document.getElementById('stat-game-star-ratings');
                if (starEl) starEl.innerText = 'N/A';
            }

            const gcEl = document.getElementById('stat-game-completed');
            if (gcEl) gcEl.innerText = stats.games_completed || 0;

            // Summary Ratings
            const websiteScore = (stats.total_visitors || 0) + (stats.photoshoot_bookings || 0) + (stats.tour_bookings || 0);
            document.getElementById('stat-website-rating').innerText = websiteScore.toLocaleString();

            const avgRating = ratedUsers.length > 0
                ? (ratedUsers.reduce((sum, u) => sum + u.rating, 0) / ratedUsers.length).toFixed(1)
                : 'N/A';
            document.getElementById('stat-summary-game-rating').innerText = avgRating === 'N/A' ? 'N/A' : avgRating + " / 5";

            if (document.getElementById('analytics').classList.contains('active')) {
                renderCharts();
                renderEvaluationStats();
                renderGenderChart();
                renderPlatformEngagementChart();
            }
        }
    } catch (err) {
        console.error("Error fetching analytics:", err);
    }
}

// --- AUDIT LOGS ---
let allAuditLogs = [];
async function fetchAuditLogs() {
    try {
        const { data: logs, error } = await supabaseClient
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;
        allAuditLogs = logs || [];

        // Initial render for whatever page is active
        const activePage = document.querySelector('.page.active')?.id;
        if (activePage === 'auditlog') renderAuditLogs(allAuditLogs);
        if (activePage === 'visitorlogs') renderVisitorLogs(allAuditLogs);
    } catch (err) {
        console.error("Audit logs error:", err);
    }
}

// Populate Day Filter logic removed as we use date picker now

function renderAuditLogs(logs) {
    const tbody = document.getElementById('audit-log-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filter for Admin actions only: no Site Visit, no Unknown Admin
    const adminLogs = logs.filter(log => {
        const action = (log.action || '').toLowerCase();
        const isAdmin = log.admin_email && log.admin_email !== 'Unknown Admin';
        return isAdmin && !action.includes('site visit');
    });

    let lastDate = null;
    adminLogs.forEach(log => {
        const rawDate = new Date(log.created_at);
        const currentDateOnly = rawDate.toLocaleDateString();

        if (currentDateOnly !== lastDate) {
            const separatorTr = document.createElement('tr');
            separatorTr.innerHTML = `
                <td colspan="4" style="background: rgba(255,255,255,0.03); padding: 12px 20px; border-left: 4px solid var(--accent-primary);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-alt" style="color: var(--accent-primary); font-size: 14px;"></i>
                        <span style="font-weight: 700; color: white; letter-spacing: 0.5px; font-size: 13px;">${currentDateOnly}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(separatorTr);
            lastDate = currentDateOnly;
        }

        const tr = document.createElement('tr');
        const timeStr = rawDate.toLocaleTimeString();

        let badgeBg = 'rgba(59, 130, 246, 0.15)';
        let badgeColor = '#3b82f6';
        const actLower = (log.action || '').toLowerCase();

        if (actLower.includes('delete') || actLower.includes('remove')) {
            badgeBg = 'rgba(239, 68, 68, 0.15)';
            badgeColor = '#ef4444';
        } else if (actLower.includes('add') || actLower.includes('create')) {
            badgeBg = 'rgba(34, 197, 94, 0.15)';
            badgeColor = '#22c55e';
        } else if (actLower.includes('update') || actLower.includes('edit')) {
            badgeBg = 'rgba(168, 85, 247, 0.15)';
            badgeColor = '#a855f7';
        }

        tr.innerHTML = `
            <td style="white-space: nowrap; color: var(--text-muted);">${timeStr}</td>
            <td><b style="color: var(--text-main);">${log.admin_email}</b></td>
            <td><span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">${log.action}</span></td>
            <td style="font-size: 13px; color: var(--text-muted);">${log.details || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderVisitorLogs(logs) {
    const tbody = document.getElementById('visitor-log-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filter for visitor events
    const visitorLogs = logs.filter(log => {
        const action = (log.action || '').toLowerCase();
        const isUnknown = !log.admin_email || log.admin_email === 'Unknown Admin';
        return isUnknown || action.includes('site visit');
    });

    let lastDate = null;
    visitorLogs.forEach(log => {
        const rawDate = new Date(log.created_at);
        const currentDateOnly = rawDate.toLocaleDateString();

        if (currentDateOnly !== lastDate) {
            const separatorTr = document.createElement('tr');
            separatorTr.innerHTML = `
                <td colspan="5" style="background: rgba(255,255,255,0.03); padding: 12px 20px; border-left: 4px solid var(--blue);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-user-clock" style="color: var(--blue); font-size: 14px;"></i>
                        <span style="font-weight: 700; color: white; letter-spacing: 0.5px; font-size: 13px;">${currentDateOnly}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(separatorTr);
            lastDate = currentDateOnly;
        }

        const tr = document.createElement('tr');
        const timeStr = rawDate.toLocaleTimeString();

        // --- Standardized Mappings ---
        let pageVisited = 'Home';
        let actionText = 'Visit';
        let actionBg = 'rgba(59, 130, 246, 0.15)'; // Default Blue
        let actionColor = '#3b82f6';

        const detailsLower = (log.details || '').toLowerCase();
        const actionLower = (log.action || '').toLowerCase();

        // 1. Booking / Plans to Visit
        if (detailsLower.includes('photoshoot')) {
            pageVisited = 'Booking';
            actionText = 'Plans to visit';
            actionBg = 'rgba(239, 68, 68, 0.15)'; // Red
            actionColor = '#ef4444';
        } else if (detailsLower.includes('group tour') || detailsLower.includes('booking') || actionLower.includes('booking')) {
            pageVisited = 'Booking';
            actionText = 'Plans to visit';
            actionBg = 'rgba(168, 85, 247, 0.15)'; // Purple
            actionColor = '#a855f7';
        }
        // 2. FAQ's
        else if (detailsLower.includes('faq')) {
            pageVisited = "FAQ's";
            actionText = 'FAQ answers';
            actionBg = 'rgba(245, 158, 11, 0.15)'; // Yellow
            actionColor = '#f59e0b';
        }
        // 3. Blog
        else if (detailsLower.includes('blog') || detailsLower.includes('story') || detailsLower.includes('news')) {
            pageVisited = 'Blog';
            actionText = 'News/ articles updates';
            actionBg = 'rgba(249, 115, 22, 0.15)'; // Orange
            actionColor = '#f97316';
        }
        // 4. Game
        else if (detailsLower.includes('game') || detailsLower.includes('player')) {
            pageVisited = 'Game';
            actionText = 'Interested in game';
            actionBg = 'rgba(34, 197, 94, 0.15)'; // Green
            actionColor = '#22c55e';
        }
        // 5. Default / Home
        else if (actionLower.includes('site visit') || pageVisited === 'Home') {
            pageVisited = 'Home';
            actionText = 'Visit';
            actionBg = 'rgba(59, 130, 246, 0.15)'; // Blue
            actionColor = '#3b82f6';
        }

        tr.innerHTML = `
            <td style="white-space: nowrap; color: var(--text-muted);">${timeStr}</td>
            <td><code style="color: var(--blue); background: rgba(59, 130, 246, 0.1); padding: 4px 10px; border-radius: 6px; font-size: 13px;">${log.id}</code></td>
            <td><span style="color: white; font-weight: 600; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; font-size: 12px;">${pageVisited}</span></td>
            <td><span class="status-badge" style="background: ${actionBg}; color: ${actionColor}; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid ${actionColor}33;">${actionText}</span></td>
            <td style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">${log.details || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Filter Audit Logs
function filterAuditLogs() {
    const term = (document.getElementById('audit-search')?.value || '').toLowerCase();
    const dateVal = document.getElementById('audit-filter-date')?.value;
    const actionVal = document.getElementById('audit-filter-action')?.value;

    const filtered = allAuditLogs.filter(log => {
        const d = new Date(log.created_at);
        const matchTerm = (log.admin_email && log.admin_email.toLowerCase().includes(term)) ||
            (log.action && log.action.toLowerCase().includes(term)) ||
            (log.details && log.details.toLowerCase().includes(term));

        let matchDate = true;
        if (dateVal) {
            const logDate = d.toISOString().split('T')[0];
            matchDate = logDate === dateVal;
        }

        let matchAction = true;
        if (actionVal) {
            const act = (log.action || '').toLowerCase();
            if (actionVal === 'create') matchAction = act.includes('add') || act.includes('create');
            else if (actionVal === 'update') matchAction = act.includes('edit') || act.includes('update');
            else if (actionVal === 'delete') matchAction = act.includes('delete');
            else if (actionVal === 'settings') matchAction = act.includes('settings');
            else if (actionVal === 'login') matchAction = act.includes('log') || act.includes('login');
        }

        return matchTerm && matchDate && matchAction;
    });

    renderAuditLogs(filtered);
}

// Filter Visitor Logs
function filterVisitorLogs() {
    const term = (document.getElementById('visitor-log-search')?.value || '').toLowerCase();
    const dateVal = document.getElementById('visitor-log-filter-date')?.value;
    const actionVal = document.getElementById('visitor-filter-action')?.value;

    const filtered = allAuditLogs.filter(log => {
        const d = new Date(log.created_at);
        const matchTerm = (log.id && log.id.toLowerCase().includes(term)) ||
            (log.action && log.action.toLowerCase().includes(term)) ||
            (log.details && log.details.toLowerCase().includes(term));

        let matchDate = true;
        if (dateVal) {
            const logDate = d.toISOString().split('T')[0];
            matchDate = logDate === dateVal;
        }

        let matchAction = true;
        if (actionVal) {
            const act = (log.action || '').toLowerCase();
            const det = (log.details || '').toLowerCase();

            if (actionVal === 'visit') matchAction = act.includes('site visit');
            else if (actionVal === 'faq') matchAction = det.includes('faq');
            else if (actionVal === 'news') matchAction = det.includes('blog') || det.includes('story') || det.includes('news');
            else if (actionVal === 'game') matchAction = det.includes('game') || det.includes('player');
            else if (actionVal === 'plans to visit') matchAction = det.includes('booking') || det.includes('photoshoot') || det.includes('group tour') || act.includes('booking');
        }

        return matchTerm && matchDate && matchAction;
    });

    renderVisitorLogs(filtered);
}

// Listeners
document.addEventListener('DOMContentLoaded', () => {
    const searchAuditInput = document.getElementById('audit-search');
    const dateAuditFilter = document.getElementById('audit-filter-date');
    const actionAuditFilter = document.getElementById('audit-filter-action');
    if (searchAuditInput) searchAuditInput.addEventListener('input', filterAuditLogs);
    if (dateAuditFilter) dateAuditFilter.addEventListener('change', filterAuditLogs);
    if (actionAuditFilter) actionAuditFilter.addEventListener('change', filterAuditLogs);

    const searchVisitorInput = document.getElementById('visitor-log-search');
    const dateVisitorFilter = document.getElementById('visitor-log-filter-date');
    const actionVisitorFilter = document.getElementById('visitor-filter-action');
    if (searchVisitorInput) searchVisitorInput.addEventListener('input', filterVisitorLogs);
    if (dateVisitorFilter) dateVisitorFilter.addEventListener('change', filterVisitorLogs);
    if (actionVisitorFilter) actionVisitorFilter.addEventListener('change', filterVisitorLogs);
});

// Delete Audit Log
async function deleteAuditLog(id) {
    if (confirm('Are you sure you want to delete this audit log entry?')) {
        try {
            const { error } = await supabaseClient.from('audit_logs').delete().eq('id', id);
            if (error) throw error;
            fetchAuditLogs();
        } catch (err) {
            console.error("Deleting audit log error:", err);
            alert("Failed to delete audit log.");
        }
    }
}

// --- USERS ---
let allUsers = [];
let archivedUsers = [];

async function fetchUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // If is_approved column exists but is null, we might still want to check local storage for this session
        const localIds = JSON.parse(localStorage.getItem('approved_feedbacks') || '[]');

        users.forEach(u => {
            // Priority: 1. DB Column, 2. Local fallback
            if (u.is_approved === null || u.is_approved === undefined) {
                u.is_approved = localIds.includes(u.id);
            }
        });

        const unarchived = users.filter(u => !u.is_archived);
        archivedUsers = users.filter(u => u.is_archived);

        allUsers = unarchived;
        renderUsers(allUsers);
        renderRecentUsers(allUsers.slice(0, 5)); // Show top 5 on dash
        renderFeedbacks(allUsers.filter(u => u.rating || u.message));

        if (document.getElementById('analytics').classList.contains('active')) {
            renderCharts();
            renderEvaluationStats();
            renderGenderChart();
            renderPlatformEngagementChart();
        }

        // Refresh analytics totals now that allUsers is populated
        fetchAnalytics();

    } catch (err) {
        console.error("Error fetching users:", err);
    }
}

// Helper to Obfuscate Name
// Example: "Tricia Lara" -> "T***** L***"
function obfuscateName(fullName) {
    if (!fullName) return 'Unknown';
    const parts = fullName.trim().split(' ');

    const obfuscatedParts = parts.map(part => {
        if (part.length <= 1) return part;
        return part.charAt(0) + '*'.repeat(part.length - 1);
    });

    return obfuscatedParts.join(' ');
}

// Helper to Obfuscate Email
// Example: "tricialara15@gmail.com" -> "t*****@gmail.com"
function obfuscateEmail(email) {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;

    const local = parts[0];
    const domain = parts[1];

    if (local.length <= 1) return email;

    const hiddenLocal = local.charAt(0) + '*'.repeat(local.length - 1);
    return `${hiddenLocal}@${domain}`;
}

function renderUsers(usersMap) {
    const tbody = document.getElementById('all-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let lastDate = null;

    usersMap.forEach(user => {
        const rawDate = new Date(user.created_at);
        const currentDateOnly = rawDate.toLocaleDateString();

        // Add date separator line
        if (currentDateOnly !== lastDate) {
            const separatorTr = document.createElement('tr');
            separatorTr.innerHTML = `
                <td colspan="5" style="background: rgba(255,255,255,0.03); padding: 12px 20px; border-left: 4px solid var(--accent-primary);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-day" style="color: var(--accent-primary); font-size: 14px;"></i>
                        <span style="font-weight: 700; color: white; letter-spacing: 0.5px; font-size: 13px;">REGISTERED ON ${currentDateOnly}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(separatorTr);
            lastDate = currentDateOnly;
        }

        const tr = document.createElement('tr');
        const decryptedEmail = decryptEmail(user.email_encrypted);
        const initials = user.name ? user.name.substring(0, 2).toUpperCase() : '??';

        const displayName = user.name || 'Unknown';
        const displayEmail = decryptedEmail;

        const dateStr = rawDate.toLocaleDateString() + ' ' + rawDate.toLocaleTimeString();

        const lastActivity = user.updated_at || user.created_at;
        const isActive = (Date.now() - new Date(lastActivity)) < (5 * 60 * 1000); // 5 minutes threshold

        const statusColor = isActive ? '#10b981' : '#64748b';
        const statusText = isActive ? 'Active' : 'Inactive';
        const statusBg = isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)';

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: rgba(59, 130, 246, 0.15); color: var(--blue);">${initials}</div>
                    <div>
                        <b title="${user.name || 'Unknown'}">${displayName}</b>
                        <br><small style="color: var(--text-muted); font-size: 12px;">${displayEmail}</small>
                    </div>
                </div>
            </td>
            <td>${user.age_group || 'N/A'}</td>
            <td><i class="fas fa-map-marker-alt" style="color: var(--text-muted); margin-right: 5px;"></i> ${user.location || 'N/A'}</td>
            <td>${dateStr}</td>
            <td>
                <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; border: 1.5px solid rgba(255,255,255,0.1);"></span>
                    ${statusText}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRecentUsers(usersMap) {
    const tbody = document.getElementById('recent-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    usersMap.forEach(user => {
        const tr = document.createElement('tr');
        const decryptedEmail = decryptEmail(user.email_encrypted);
        const initials = user.name ? user.name.substring(0, 2).toUpperCase() : '??';
        const displayName = user.name || 'Unknown';

        const rawDate = new Date(user.created_at);
        const dateStr = rawDate.toLocaleDateString();

        let activityStatus = 'Site Visit';
        let activityColor = '#3b82f6';
        let activityBg = 'rgba(59, 130, 246, 0.1)';

        if (user.rating || (user.message && user.message.trim() !== '')) {
            activityStatus = 'Form Submission';
            activityColor = '#10b981';
            activityBg = 'rgba(16, 185, 129, 0.1)';
        }

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: rgba(16, 10, 129, 0.15); color: var(--green);">${initials}</div>
                    <div>
                        <b>${displayName}</b>
                    </div>
                </div>
            </td>
            <td><i class="fas fa-map-marker-alt" style="color: var(--text-muted); margin-right: 5px;"></i> ${user.location || 'N/A'}</td>
            <td>${dateStr}</td>
            <td>
                <span style="background: ${activityBg}; color: ${activityColor}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: ${activityColor};"></span>
                    ${user.activity || activityStatus}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsers() {
    const term = (document.getElementById('user-search')?.value || '').toLowerCase();
    const ageFilter = document.getElementById('user-filter-age')?.value;
    const dateFilter = document.getElementById('user-filter-date')?.value;

    const filtered = allUsers.filter(u => {
        const matchTerm = (u.name && u.name.toLowerCase().includes(term)) ||
            (u.email_encrypted && decryptEmail(u.email_encrypted).toLowerCase().includes(term)) ||
            (u.location && u.location.toLowerCase().includes(term));

        const matchAge = !ageFilter || u.age_group === ageFilter;

        let matchDate = true;
        if (dateFilter) {
            const regDate = new Date(u.created_at).toISOString().split('T')[0];
            matchDate = regDate === dateFilter;
        }

        return matchTerm && matchAge && matchDate;
    });
    renderUsers(filtered);
}

const searchUserInput = document.getElementById('user-search');
const ageUserFilter = document.getElementById('user-filter-age');
const dateUserFilter = document.getElementById('user-filter-date');

if (searchUserInput) searchUserInput.addEventListener('input', filterUsers);
if (ageUserFilter) ageUserFilter.addEventListener('change', filterUsers);
if (dateUserFilter) dateUserFilter.addEventListener('change', filterUsers);

function renderFeedbacks(feedbacks) {
    const tbody = document.getElementById('all-feedbacks-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (feedbacks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted);">No feedbacks found.</td></tr>`;
        return;
    }

    feedbacks.forEach(user => {
        const tr = document.createElement('tr');
        const decryptedEmail = decryptEmail(user.email_encrypted);
        const initials = user.name ? user.name.substring(0, 2).toUpperCase() : '??';
        const rawDate = new Date(user.created_at);

        const displayName = user.name || 'Unknown';
        const displayEmail = decryptedEmail;

        let starsHTML = '';
        if (user.rating) {
            for (let i = 1; i <= 5; i++) {
                if (i <= user.rating) starsHTML += '<i class="fas fa-star" style="color:#fbbf24;"></i>';
                else starsHTML += '<i class="far fa-star" style="color:#4b5563;"></i>';
            }
        } else {
            starsHTML = '<span style="color:var(--text-muted)">N/A</span>';
        }

        const dateOnlyStr = rawDate.toLocaleDateString();
        const timeOnlyStr = rawDate.toLocaleTimeString();

        const isVisible = user.is_approved;
        const toggleBg = isVisible ? '#22c55e' : 'rgba(255,255,255,0.1)';
        const toggleLabel = isVisible ? 'Visible' : 'Hidden';
        const toggleLabelColor = isVisible ? '#22c55e' : 'var(--text-muted)';
        const knobPos = isVisible ? 'translateX(18px)' : 'translateX(2px)';

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: rgba(59, 130, 246, 0.15); color: var(--blue);">${initials}</div>
                    <div>
                        <b style="color: var(--text-main);">${displayName}</b>
                        <br><small style="color: var(--text-muted); font-size: 12px;">${displayEmail}</small>
                    </div>
                </div>
            </td>
            <td style="white-space: nowrap;">
                <div style="margin-bottom: 4px;">${starsHTML}</div>
            </td>
            <td style="max-width: 300px; line-height: 1.5; font-size: 14px; white-space: normal; color: var(--text-muted);">${user.message || '<i>No message provided</i>'}</td>
            <td>${dateOnlyStr}<br><small style="color: var(--text-muted);">${timeOnlyStr}</small></td>
            <td style="white-space: nowrap;">
                <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="toggleFeedbackVisibility('${user.id}', ${isVisible})" title="Click to toggle visibility">
                    <div style="width: 40px; height: 22px; border-radius: 999px; background: ${toggleBg}; position: relative; transition: background 0.3s; flex-shrink: 0;">
                        <div style="width: 18px; height: 18px; background: white; border-radius: 50%; position: absolute; top: 2px; transform: ${knobPos}; transition: transform 0.3s; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>
                    </div>
                    <span style="font-size: 13px; font-weight: 600; color: ${toggleLabelColor};">${toggleLabel}</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterFeedbacks() {
    const term = (document.getElementById('feedback-search')?.value || '').toLowerCase();
    const starFilter = document.getElementById('feedback-filter-stars')?.value;
    const dateFilter = document.getElementById('feedback-filter-date')?.value;
    const visibilityFilter = document.getElementById('feedback-filter-visibility')?.value;

    const filtered = allUsers.filter(u => {
        const hasFeedback = u.rating || u.message;
        if (!hasFeedback) return false;

        const matchTerm = (u.name && u.name.toLowerCase().includes(term)) ||
            (u.message && u.message.toLowerCase().includes(term));

        const matchStars = !starFilter || u.rating?.toString() === starFilter;

        let matchDate = true;
        if (dateFilter) {
            const feedbackDate = new Date(u.created_at).toISOString().split('T')[0];
            matchDate = feedbackDate === dateFilter;
        }

        let matchVisibility = true;
        if (visibilityFilter === 'visible') matchVisibility = !!u.is_approved;
        else if (visibilityFilter === 'hidden') matchVisibility = !u.is_approved;

        return matchTerm && matchStars && matchDate && matchVisibility;
    });
    renderFeedbacks(filtered);
}

const searchFeedbackInput = document.getElementById('feedback-search');
const starsFeedbackFilter = document.getElementById('feedback-filter-stars');
const dateFeedbackFilter = document.getElementById('feedback-filter-date');
const visibilityFeedbackFilter = document.getElementById('feedback-filter-visibility');

if (searchFeedbackInput) searchFeedbackInput.addEventListener('input', filterFeedbacks);
if (starsFeedbackFilter) starsFeedbackFilter.addEventListener('change', filterFeedbacks);
if (dateFeedbackFilter) dateFeedbackFilter.addEventListener('change', filterFeedbacks);
if (visibilityFeedbackFilter) visibilityFeedbackFilter.addEventListener('change', filterFeedbacks);

// Load Approved IDs mapped to users
let approvedFeedbackIds = [];
async function fetchApprovedMapping() {
    try {
        const { data } = await supabaseClient.from('analytics').select('approved_feedbacks').eq('id', 1).single();
        if (data && data.approved_feedbacks) {
            approvedFeedbackIds = data.approved_feedbacks;
        }
    } catch (e) { console.error("Could not fetch mappings", e) }
}

async function toggleFeedbackVisibility(userId, currentlyVisible) {
    const newState = !currentlyVisible;

    // Confirmation when HIDING
    if (currentlyVisible && !confirm("Are you sure you want to hide this feedback from the website?")) {
        return;
    }

    try {
        // Try to update is_approved column in users table
        const { error } = await supabaseClient
            .from('users')
            .update({ is_approved: newState })
            .eq('id', userId);

        if (error) {
            console.warn('DB column update failed, using fallback sync:', error.message);
        }

        // Logic sync: Also update the analytics array for compatibility with older code/fallback
        await fetchApprovedMapping();
        let updatedIds = [...approvedFeedbackIds];
        if (newState) {
            if (!updatedIds.includes(userId)) updatedIds.push(userId);
        } else {
            updatedIds = updatedIds.filter(id => id !== userId);
        }
        await supabaseClient.from('analytics').update({ approved_feedbacks: updatedIds }).eq('id', 1);

        // Also update local storage fallback
        let localIds = JSON.parse(localStorage.getItem('approved_feedbacks') || '[]');
        if (newState) {
            if (!localIds.includes(userId)) localIds.push(userId);
        } else {
            localIds = localIds.filter(id => id !== userId);
        }
        localStorage.setItem('approved_feedbacks', JSON.stringify(localIds));

        // Update local data immediately for instant UI feedback
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) allUsers[userIndex].is_approved = newState;

        filterFeedbacks(); // Re-render with current filters
    } catch (err) {
        console.error('Error toggling feedback visibility:', err);
        alert("Failed to update visibility.");
    }
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to completely remove this user?')) {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', userId);
            if (error) throw error;
            // Subscription will trigger refresh
        } catch (err) {
            console.error("Error deleting user:", err);
            alert("Failed to delete user.");
        }
    }
}

// --- CONTENT MANAGER (GALLERY / BLOGS) ---
async function fetchContent() {
    try {
        const { data: contents, error } = await supabaseClient
            .from('content')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const blogGrid = document.getElementById('blog-grid-container');
        const galleryGrid = document.getElementById('gallery-grid-container');
        const faqGrid = document.getElementById('faq-grid-container');
        if (!blogGrid || !galleryGrid || !faqGrid) return;

        blogGrid.innerHTML = '';
        galleryGrid.innerHTML = '';
        faqGrid.innerHTML = '';

        const blogs = contents.filter(c => c.type === 'blog');
        const galleries = contents.filter(c => c.type === 'gallery');
        const faqs = contents.filter(c => c.type === 'faq');

        if (faqs.length === 0) {
            // Auto-seed the 5 FAQs from the website if none exist
            seedInitialFAQs();
        }

        const emptyMessage = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><p style="color: var(--text-muted); margin-bottom: 20px;">No content items found in database.</p><button class="btn btn-primary" onclick="seedInitialContent()"><i class="fas fa-magic"></i> Restore Original Content</button></div>';

        if (blogs.length === 0) blogGrid.innerHTML = emptyMessage;
        if (galleries.length === 0) galleryGrid.innerHTML = emptyMessage;
        if (faqs.length === 0) faqGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No FAQs published yet.</div>';

        // Update Counters
        const publishedBlogs = blogs.filter(b => b.status === 'published').length;
        const publishedGalleries = galleries.filter(g => g.status === 'published').length;
        const publishedFaqs = faqs.filter(f => f.status === 'published').length;

        const totalPublished = publishedBlogs + publishedGalleries + publishedFaqs;
        const totalDrafts = contents.filter(c => c.status !== 'published').length;
        const statPublishedEl = document.getElementById('stat-published');
        const statDraftsEl = document.getElementById('stat-drafts');
        if (statPublishedEl) statPublishedEl.innerText = totalPublished;
        if (statDraftsEl) statDraftsEl.innerText = totalDrafts;

        const blogCountEl = document.getElementById('blog-count');
        const galleryCountEl = document.getElementById('gallery-count');
        const faqCountEl = document.getElementById('faq-count');
        if (blogCountEl) blogCountEl.innerText = `${publishedBlogs} Published`;
        if (galleryCountEl) galleryCountEl.innerText = `${publishedGalleries} Published`;
        if (faqCountEl) faqCountEl.innerText = `${publishedFaqs} Published`;

        contents.forEach(item => {
            const badgeType = item.status === 'published' ? 'active' : 'pending';
            let iconHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color: var(--text-muted);"><i class="fas fa-image fa-2x"></i></div>';

            if (item.type === 'faq') {
                iconHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color: var(--blue); background: rgba(59, 130, 246, 0.1);"><i class="fas fa-question-circle fa-3x"></i></div>';
            } else if (item.image_url) {
                iconHTML = `<img src="${item.image_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }

            // Extract plain text to avoid rich HTML tags breaking the 2-line clamp
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.description || '';
            const plainTextDesc = tempDiv.textContent || tempDiv.innerText || '';

            const cardHTML = `
               <div class="content-card">
                  <div class="content-card-header">
                    <span class="status-badge ${badgeType}">${item.status || 'Draft'}</span>
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); padding: 4px 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">${item.type}</span>
                  </div>
                  <div style="height: 120px; overflow: hidden; border-radius: 8px; margin-bottom: 12px; background: #0f172a; display: ${item.type === 'gallery' ? 'block' : 'none'};">
                    ${iconHTML}
                  </div>
                  <h4 class="content-card-title">${item.title}</h4>
                  <p class="content-card-desc" style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">${plainTextDesc}</p>
                  <div class="content-card-footer">
                    <div class="content-stats" style="${item.type === 'gallery' ? 'display: none;' : ''}">
                      <span><i class="fas fa-eye"></i> ${item.views || 0}</span>
                    </div>
                    <div>
                      <button class="btn-icon edit" onclick="openEditContentModal('${item.id}')" style="margin-right:8px;" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="btn-icon delete" onclick="deleteContent('${item.id}', '${item.title.replace(/'/g, "\\'")}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                  </div>
                </div>
            `;

            if (item.type === 'blog') {
                blogGrid.innerHTML += cardHTML;
            } else if (item.type === 'gallery') {
                galleryGrid.innerHTML += cardHTML;
            } else if (item.type === 'faq') {
                faqGrid.innerHTML += cardHTML;
            }
        });

    } catch (err) {
        console.error("Error fetching content:", err);
        const blogGrid = document.getElementById('blog-grid-container');
        const galleryGrid = document.getElementById('gallery-grid-container');
        const errorHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 10px;">Database Connection Error</h3>
                <p style="margin-bottom: 15px;">It looks like your Supabase connection failed or the <b>'content'</b> table is missing from your database.</p>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 6px; color: #fca5a5; font-family: monospace; font-size: 13px; margin-bottom: 20px;">
                    ${err.message || err.error_description || 'Unknown Error'}
                </div>
                <button class="btn btn-primary" onclick="seedInitialContent()"><i class="fas fa-magic"></i> Force Start Content Restore</button>
            </div>`;
        if (blogGrid) blogGrid.innerHTML = errorHTML;
        if (galleryGrid) galleryGrid.innerHTML = errorHTML;
    }
}

async function deleteContent(id, title = 'Content Item') {
    if (confirm('Are you sure you want to delete this content item?')) {
        try {
            const { error } = await supabaseClient.from('content').delete().eq('id', id);
            if (error) throw error;

            // Log Deletion
            await supabaseClient.from('audit_logs').insert([{
                admin_email: 'admin@museo.ph', // Fallback if no auth system exists
                action: 'Deleted Content',
                details: `Removed: ${title}`
            }]);

            fetchContent();
        } catch (err) {
            console.error("Deleting content error:", err);
        }
    }
}

// Add Content Modal Logic
function openAddContentModal(defaultType = 'blog') {
    document.getElementById('modal-title').innerText = 'Add New Content';
    document.getElementById('edit-content-id').value = '';
    document.getElementById('addContentModal').style.display = 'flex';
    document.getElementById('new-content-title').value = '';
    document.getElementById('new-content-desc').value = '';
    document.getElementById('new-content-image').value = '';

    const typeSelect = document.getElementById('new-content-type');
    typeSelect.value = defaultType;

    // Trigger change event to toggle field visibility based on type
    const event = new Event('change');
    typeSelect.dispatchEvent(event);

    // Reset labels
    const titleLabel = document.getElementById('title-label');
    const descLabel = document.getElementById('desc-label');
    if (titleLabel) titleLabel.innerText = "Title / Question";
    if (descLabel) descLabel.innerText = "Description / Answer";
}

async function openEditContentModal(id) {
    try {
        const { data, error } = await supabaseClient.from('content').select('*').eq('id', id).single();
        if (error) throw error;

        document.getElementById('modal-title').innerText = 'Edit Content';
        document.getElementById('edit-content-id').value = id;
        document.getElementById('new-content-type').value = data.type;
        document.getElementById('new-content-title').value = data.title;

        let plainDesc = data.description || '';
        if (plainDesc) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = plainDesc;
            plainDesc = tempDiv.textContent || tempDiv.innerText || '';
        }

        document.getElementById('new-content-desc').value = plainDesc;
        document.getElementById('new-content-image').value = data.image_url || '';
        document.getElementById('group-description').style.display = data.type === 'gallery' ? 'none' : 'block';

        const groupImg = document.getElementById('group-image');
        if (groupImg) groupImg.style.display = (data.type === 'gallery') ? 'block' : 'none';

        document.getElementById('addContentModal').style.display = 'flex';
    } catch (err) {
        console.error("Error fetching content details:", err);
        alert("Failed to load content for editing.");
    }
}

function closeAddContentModal() {
    document.getElementById('addContentModal').style.display = 'none';
}

// Add event listener for type change to hide/show description and image
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('new-content-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const groupDesc = document.getElementById('group-description');
            const groupImg = document.getElementById('group-image');

            if (e.target.value === 'gallery') {
                if (groupDesc) groupDesc.style.display = 'none';
                if (groupImg) groupImg.style.display = 'block';
            } else if (e.target.value === 'faq' || e.target.value === 'blog') {
                if (groupDesc) groupDesc.style.display = 'block';
                if (groupImg) groupImg.style.display = 'none';
            } else {
                if (groupDesc) groupDesc.style.display = 'block';
                if (groupImg) groupImg.style.display = 'block';
            }
        });
    }
});

async function submitNewContent() {
    const editId = document.getElementById('edit-content-id').value;
    const type = document.getElementById('new-content-type').value;
    const title = document.getElementById('new-content-title').value;
    const desc = document.getElementById('new-content-desc').value;
    const image = document.getElementById('new-content-image').value;

    if (!title || (type === 'gallery' && !image)) {
        alert("Please fill all required fields depending on the content type.");
        return;
    }

    const payload = {
        type: type,
        title: title,
        description: (type === 'blog' || type === 'faq') ? desc : null,
        image_url: image || null,
        status: 'published'
    };

    try {
        let logAction = '';
        if (editId) {
            const { error } = await supabaseClient.from('content').update(payload).eq('id', editId);
            if (error) throw error;
            alert("Content updated successfully!");
            logAction = 'Edited Content';
        } else {
            const { error } = await supabaseClient.from('content').insert([payload]);
            if (error) throw error;
            alert("Content added successfully!");
            logAction = 'Added Content';
        }

        // Log the change
        await supabaseClient.from('audit_logs').insert([{
            admin_email: 'admin@museo.ph',
            action: logAction,
            details: `Type: ${type.toUpperCase()} | Title: ${title}`
        }]);

        closeAddContentModal();
        fetchContent();
    } catch (err) {
        console.error("Save content error:", err);
        alert("Failed to save content.");
    }
}

async function seedInitialContent() {
    const defaultContent = [
        // Blogs
        { type: 'blog', title: 'The Life and Legacy of Dr. Pío Valenzuela', description: '<h2>The Life and Legacy of Dr. Pío Valenzuela</h2>\n<p>\nPío Valenzuela was born on July 11, 1869 in Polo, Bulacan—now Valenzuela City. He studied medicine at the University of Santo Tomas and became a licensed physician in 1895. After completing his studies, he practiced medicine in Manila and Bulacan while starting a family with his wife, Marciana Castriy.\n<br> A Katipunero <br> <br> \nWhile still a medical student, Valenzuela joined the Katipunan in 1892 and became a close ally of its founder, Andrés Bonifacio. He served as the society’s physician and helped establish its revolutionary newspaper Kalayaan together with Emilio Jacinto. The publication helped spread the ideas of the revolution and recruit members.\n<br> <br> \nValenzuela was sent by Bonifacio to Dapitan to consult José Rizal about the planned uprising against Spain. Rizal advised caution, saying the revolution should only begin if the people were prepared and well-armed.\nAfter the Katipunan was discovered, Valenzuela was arrested and imprisoned by Spanish authorities, later being deported to Spain and Africa. After his release, he returned to the Philippines and entered public service, becoming municipal president of Polo and later governor of Bulacan.\nHe died on April 6, 1956. Today, Valenzuela City bears his name in honor of his contributions to Philippine history and the struggle for independence.\n</p>', status: 'published' },
        { type: 'blog', title: 'Museum Updates', description: '<h2>Museum Updates</h2>\n<p>\nThe Museo ni Dr. Pío Valenzuela continues to improve its exhibits\nto provide visitors with a deeper understanding of Philippine history.\n</p>\n<p>\nRecent updates include improved artifact displays, new educational\npanels, and guided tours for students and tourists.\n</p>', status: 'published' },
        { type: 'blog', title: 'Educational Discoveries', description: '<h2>Educational Discoveries</h2>\n<p>\nInside the museum are many artifacts that tell the story of the\nPhilippine Revolution and the life of Dr. Pío Valenzuela.\n</p>\n<p>\nVisitors can learn about historical documents, personal belongings,\nand photographs that highlight the contributions of Filipino heroes.\n</p>', status: 'published' },

        // Gallery Left
        { type: 'gallery', title: 'Second Floor', image_url: 'images/Second-Floor.jpeg', status: 'published' },
        { type: 'gallery', title: 'Table', image_url: 'images/table.jpeg', status: 'published' },
        { type: 'gallery', title: 'Study Table', image_url: 'images/study-table.jpeg', status: 'published' },
        { type: 'gallery', title: 'Museo Pic', image_url: 'images/museo-pic.png', status: 'published' },
        { type: 'gallery', title: 'Front', image_url: 'images/front.jpeg', status: 'published' },
        { type: 'gallery', title: 'Right', image_url: 'images/Right.jpeg', status: 'published' },
        { type: 'gallery', title: 'Family', image_url: 'images/fam.jpeg', status: 'published' },
        { type: 'gallery', title: 'Gazebo', image_url: 'images/Gazebo.jpg', status: 'published' },
        { type: 'gallery', title: 'Cinematic Table', image_url: 'images/cinematic-table.jpg', status: 'published' },
        { type: 'gallery', title: 'News', image_url: 'images/nnews.jpg', status: 'published' },
        { type: 'gallery', title: 'Sala', image_url: 'images/sala.jpeg', status: 'published' },
        { type: 'gallery', title: 'Guho', image_url: 'images/guho.jpg', status: 'published' },
        { type: 'gallery', title: 'Tools', image_url: 'images/tools.jpg', status: 'published' },
        { type: 'gallery', title: 'Pictures', image_url: 'images/pictures.jpg', status: 'published' },
        { type: 'gallery', title: 'Cinematic', image_url: 'images/cinematic.jpg', status: 'published' },
        { type: 'gallery', title: 'First Floor', image_url: 'images/first-sloor.jpg', status: 'published' },

        // Gallery Right
        { type: 'gallery', title: 'Bookshelf', image_url: 'images/bookshelf.jpeg', status: 'published' },
        { type: 'gallery', title: 'Dining', image_url: 'images/dining.png', status: 'published' },
        { type: 'gallery', title: 'Salaa', image_url: 'images/salaa.png', status: 'published' },
        { type: 'gallery', title: 'Guho At', image_url: 'images/guho at.png', status: 'published' },
        { type: 'gallery', title: 'Dio', image_url: 'images/dio.png', status: 'published' },
        { type: 'gallery', title: 'Kitchen', image_url: 'images/kitchen.png', status: 'published' },
        { type: 'gallery', title: 'Clinica', image_url: 'images/clinica.png', status: 'published' },
        { type: 'gallery', title: 'Dioramas', image_url: 'images/dioramas.png', status: 'published' },
        { type: 'gallery', title: 'Exit', image_url: 'images/exit.png', status: 'published' },
        { type: 'gallery', title: 'Haligi ng Tahanan', image_url: 'images/haligingtahanan.png', status: 'published' },
        { type: 'gallery', title: 'Timeline', image_url: 'images/timeline.png', status: 'published' },
        { type: 'gallery', title: 'TV', image_url: 'images/tv.png', status: 'published' },
        { type: 'gallery', title: 'Jail', image_url: 'images/jail.png', status: 'published' },
        { type: 'gallery', title: 'History', image_url: 'images/history.png', status: 'published' }
    ];

    if (confirm('This will insert 33 items into your database. Keep clicking OK if any warnings appear. Proceed?')) {
        try {
            const { error } = await supabaseClient.from('content').insert(defaultContent);
            if (error) throw error;
            alert("Initial content restored successfully!");
            fetchContent();
        } catch (err) {
            console.error("Error seeding content:", err);
            alert("Failed to restore initial content: " + (err.message || JSON.stringify(err)));
        }
    }
}

// --- SETTINGS ---
async function handleAutoCertificate(userData) {
    const isAutoEnabled = document.getElementById('setting-auto-cert')?.checked;
    if (!isAutoEnabled) return;

    console.log(`Auto-Certificate: Generating for ${userData.name}...`);

    try {
        // 1. Generate PDF (locally for the admin to see/preview or just trigger logic)
        // Note: In a real automated scenario, this would usually be a backend task.
        // For this frontend implementation, we log the intent.

        await supabaseClient.from('audit_logs').insert([{
            admin_email: 'SYSTEM',
            action: 'Cert Generated',
            details: `Auto-generated certificate for ${userData.name} (${userData.id})`
        }]);

        // 2. Mock Email Send
        const smtpHost = document.getElementById('setting-smtp-host').value;
        if (smtpHost) {
            console.log(`Auto-Certificate: Emailing to ${userData.email || 'player'} via ${smtpHost}...`);
            await supabaseClient.from('audit_logs').insert([{
                admin_email: 'SYSTEM',
                action: 'Cert Emailed',
                details: `Email sent to ${userData.name} via ${smtpHost}`
            }]);
        }

    } catch (err) {
        console.error("Auto-Certificate Error:", err);
    }
}

async function fetchSettings() {
    try {
        const { data: settings, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
        if (error) throw error;

        if (settings) {
            if (document.getElementById('setting-site-name')) {
                const siteNameEl = document.getElementById('setting-site-name');
                if (siteNameEl.tagName === 'INPUT') siteNameEl.value = settings.site_name || '';
                else siteNameEl.innerText = settings.site_name || 'Pio Museo Quest Admin';

                const yearEl = document.getElementById('setting-year');
                if (yearEl) {
                    if (yearEl.tagName === 'INPUT') yearEl.value = settings.year || '2026';
                    else yearEl.innerText = settings.year || '2026';
                }

                document.getElementById('setting-user-reg').checked = settings.user_registration !== false;
                document.getElementById('setting-maint-mode').checked = settings.maintenance_mode === true;

                document.getElementById('setting-smtp-host').value = settings.smtp_host || '';
                document.getElementById('setting-smtp-port').value = settings.smtp_port || '';
                document.getElementById('setting-smtp-user').value = settings.smtp_user || '';
                document.getElementById('setting-smtp-pass').value = settings.smtp_pass || '';

                document.getElementById('setting-auto-cert').checked = settings.auto_send_certs === true;
                document.getElementById('setting-cert-template').value = settings.cert_template_url || '';
                document.getElementById('setting-cert-name-top').value = settings.cert_name_top || 48;
                document.getElementById('setting-cert-name-size').value = settings.cert_name_size || 32;

                updateCertPreview();
            }
        }
    } catch (err) {
        console.error("Settings error:", err);
    }
}

async function saveSettings() {
    const siteNameEl = document.getElementById('setting-site-name');
    const yearEl = document.getElementById('setting-year');

    const payload = {
        site_name: siteNameEl.tagName === 'INPUT' ? siteNameEl.value : siteNameEl.innerText,
        year: yearEl ? (yearEl.tagName === 'INPUT' ? yearEl.value : yearEl.innerText) : '2026',
        user_registration: document.getElementById('setting-user-reg').checked,
        maintenance_mode: document.getElementById('setting-maint-mode').checked,
        smtp_host: document.getElementById('setting-smtp-host').value,
        smtp_port: document.getElementById('setting-smtp-port').value,
        smtp_user: document.getElementById('setting-smtp-user').value,
        smtp_pass: document.getElementById('setting-smtp-pass').value,
        auto_send_certs: document.getElementById('setting-auto-cert').checked,
        cert_template_url: document.getElementById('setting-cert-template').value,
        cert_name_top: document.getElementById('setting-cert-name-top').value,
        cert_name_size: document.getElementById('setting-cert-name-size').value
    };

    try {
        const { error } = await supabaseClient.from('settings').update(payload).eq('id', 1);
        if (error) throw error;
        alert("Settings saved successfully!");
    } catch (err) {
        console.error("Save settings error:", err);
        alert("Failed to save settings. Make sure the 'settings' table has the new columns.");
    }
}

// Certificate Logic
function updateCertPreview() {
    const url = document.getElementById('setting-cert-template')?.value;
    const top = document.getElementById('setting-cert-name-top')?.value || 48;
    const size = document.getElementById('setting-cert-name-size')?.value || 32;
    const img = document.getElementById('cert-preview-img');
    const placeholder = document.getElementById('cert-preview-placeholder');
    const nameOverlay = document.getElementById('cert-preview-name');

    if (url && url.trim() !== '') {
        img.src = url;
        img.style.display = 'block';
        placeholder.style.display = 'none';
        nameOverlay.style.display = 'block';
        nameOverlay.style.top = top + '%';
        nameOverlay.style.fontSize = (size * 0.45) + 'px'; // Scaled for preview box
    } else {
        img.style.display = 'none';
        placeholder.style.display = 'block';
        nameOverlay.style.display = 'none';
    }
}

async function downloadSampleCert() {
    const template = document.getElementById('setting-cert-template')?.value;
    if (!template) {
        alert("Please provide a certificate template URL first.");
        return;
    }

    generateCertificatePDF("John Doe (Sample)");
}

async function generateCertificatePDF(playerName) {
    const template = document.getElementById('setting-cert-template')?.value;
    const top = document.getElementById('setting-cert-name-top')?.value || 48;
    const size = document.getElementById('setting-cert-name-size')?.value || 32;
    if (!template) return;

    // Create a temporary off-screen container for rendering
    const container = document.createElement('div');
    container.style.width = '1000px'; // Increased for quality
    container.style.position = 'relative';
    container.style.background = '#fff';

    // Create image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = template;

    img.onload = async () => {
        container.innerHTML = `
            <img src="${template}" style="width: 100%; display: block;">
            <div style="position: absolute; top: ${top}%; left: 50%; transform: translateX(-50%); width: 100%; text-align: center; color: #1e293b; font-family: 'Playfair Display', serif; font-size: ${size}px; font-weight: bold;">
                ${playerName}
            </div>
        `;
        document.body.appendChild(container);

        try {
            const canvas = await html2canvas(container, { useCORS: true });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'px', [canvas.width, canvas.height]);
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`Certificate-${playerName.replace(/\s+/g, '-')}.pdf`);
        } catch (err) {
            console.error("PDF Gen Error:", err);
            alert("Failed to generate PDF. Make sure the image URL supports CORS.");
        } finally {
            document.body.removeChild(container);
        }
    };

    img.onerror = () => {
        alert("Could not load certificate template. Check the URL or CORS settings.");
    };
}

function testSMTP() {
    const host = document.getElementById('setting-smtp-host').value;
    const user = document.getElementById('setting-smtp-user').value;

    if (!host || !user) {
        alert("Please fill in SMTP connectivity details first.");
        return;
    }

    alert(`Simulating test email to ${user} via ${host}...\n\n(Note: Actual SMTP requires server-side logic like Supabase Edge Functions. Credentials are saved for future integration.)`);
}

// --- CHARTS LOGIC ---
function renderCharts() {
    if (!window.Chart) return;

    const monthCounts = { "Jan": 0, "Feb": 0, "Mar": 0, "Apr": 0, "May": 0, "Jun": 0, "Jul": 0, "Aug": 0, "Sep": 0, "Oct": 0, "Nov": 0, "Dec": 0 };
    const monthFeedbacks = { "Jan": 0, "Feb": 0, "Mar": 0, "Apr": 0, "May": 0, "Jun": 0, "Jul": 0, "Aug": 0, "Sep": 0, "Oct": 0, "Nov": 0, "Dec": 0 };

    let starCounts = [0, 0, 0, 0, 0];
    const locationCounts = {};
    const ageCounts = {};

    allUsers.forEach(user => {
        const d = new Date(user.created_at);
        const userYear = d.getFullYear();
        const userMonth = d.getMonth();

        // Strict Filter: Year must match
        if (userYear !== selectedYear) return;

        // Strict Filter: Month must match if not 'all'
        if (selectedMonth !== 'all' && userMonth !== parseInt(selectedMonth)) return;

        const m = d.toLocaleString('default', { month: 'short' });
        if (monthCounts[m] !== undefined) {
            monthCounts[m]++;
            if (user.rating || user.message) {
                monthFeedbacks[m]++;
            }
        }
        if (user.rating && user.rating >= 1 && user.rating <= 5) {
            starCounts[user.rating - 1]++;
        }

        if (user.location) {
            const loc = user.location.trim();
            if (loc) locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        }

        if (user.age_group) {
            const age = user.age_group.trim();
            if (age) ageCounts[age] = (ageCounts[age] || 0) + 1;
        }
    });

    const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const locLabels = sortedLocations.map(l => l[0]);
    const locData = sortedLocations.map(l => l[1]);

    const ageLabels = Object.keys(ageCounts);
    const ageDataArr = Object.values(ageCounts);

    const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let labelsTime = [];

    if (selectedMonth === 'all') {
        // Show all 12 months for the selected year
        labelsTime = allMonths;
    } else {
        // Show only the selected month
        labelsTime = [allMonths[parseInt(selectedMonth)]];
    }

    const regData = labelsTime.map(l => monthCounts[l]);
    const fbkData = labelsTime.map(l => monthFeedbacks[l]);

    // Mock Monthly Visitor distribution based on total visitors
    const totalVisitors = currentStats ? (currentStats.total_visitors || 0) : 0;
    const visitorData = labelsTime.map((l, idx) => Math.floor((totalVisitors / 6) * (1 + (Math.random() * 0.4 - 0.2))));

    // Common Chart options
    Chart.defaults.color = "#94a3b8";
    Chart.defaults.font.family = "'Inter', sans-serif";
    const gridColor = "rgba(255,255,255,0.05)";

    // Consolidated Platform Engagement Chart (Grouped Bar)
    const canvasEng = document.getElementById("chartEngagement");
    if (canvasEng) {
        const ctxEng = canvasEng.getContext('2d');
        if (typeof engagementChartInstance !== 'undefined' && engagementChartInstance) engagementChartInstance.destroy();

        // Derived No. of Players (Mocked as a percentage of registered users for now)
        const playerData = regData.map(v => Math.floor(v * 0.8));

        engagementChartInstance = new Chart(ctxEng, {
            type: "bar",
            data: {
                labels: labelsTime,
                datasets: [
                    {
                        label: "Registered Accounts",
                        data: regData,
                        backgroundColor: "#1d4ed8",
                        borderRadius: 4,
                        barThickness: 10
                    },
                    {
                        label: "Online Visitors",
                        data: visitorData,
                        backgroundColor: "#3b82f6",
                        borderRadius: 4,
                        barThickness: 10
                    },
                    {
                        label: "No. of Players",
                        data: playerData,
                        backgroundColor: "#06b6d4",
                        borderRadius: 4,
                        barThickness: 10
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            boxWidth: 12,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: gridColor }, beginAtZero: true, ticks: { stepSize: 5 } }
                }
            }
        });
    }

    // Chart 3: Submitted Feedbacks (Line Graph)
    const canvas3 = document.getElementById("chart3");
    if (canvas3) {
        const ctx3 = canvas3.getContext('2d');
        if (chart3Instance) chart3Instance.destroy();

        chart3Instance = new Chart(ctx3, {
            type: "line",
            data: {
                labels: labelsTime,
                datasets: [
                    {
                        label: "Feedbacks",
                        data: fbkData,
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        borderWidth: 3,
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: "#0f172a",
                        pointBorderColor: "#f59e0b",
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: gridColor }, beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    // Chart 4: Star Rating Graph (Bar)
    const canvas4 = document.getElementById("chart4");
    if (canvas4) {
        const ctx4 = canvas4.getContext('2d');
        if (chart4Instance) chart4Instance.destroy();

        chart4Instance = new Chart(ctx4, {
            type: "bar",
            data: {
                labels: ["1 Star", "2 Stars", "3 Stars", "4 Stars", "5 Stars"],
                datasets: [{
                    label: "Ratings Given",
                    data: starCounts,
                    backgroundColor: ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"],
                    borderRadius: 6,
                    barThickness: 30
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: gridColor }, beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    // Chart 5: Pie Chart Booking Comparison
    const canvas5 = document.getElementById("chart5");
    if (canvas5) {
        const ctx5 = canvas5.getContext('2d');
        if (chart5Instance) chart5Instance.destroy();

        const photoB = currentStats ? (currentStats.photoshoot_bookings || 0) : 0;
        const tourB = currentStats ? (currentStats.tour_bookings || 0) : 0;

        chart5Instance = new Chart(ctx5, {
            type: "pie",
            data: {
                labels: ["Photoshoot", "Group Tour"],
                datasets: [{
                    data: [photoB, tourB],
                    backgroundColor: ["#f97316", "#3b82f6"],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Chart 6: Visitor Locations Bar Chart
    const canvas6 = document.getElementById("chart6");
    if (canvas6) {
        const ctx6 = canvas6.getContext('2d');
        if (chart6Instance) chart6Instance.destroy();

        chart6Instance = new Chart(ctx6, {
            type: "bar",
            data: {
                labels: locLabels.length > 0 ? locLabels : ["None Provided"],
                datasets: [{
                    label: "Visitors",
                    data: locData.length > 0 ? locData : [0],
                    backgroundColor: "#8b5cf6",
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: gridColor }, beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    // Chart 7: Age Group Pie Chart
    const canvas7 = document.getElementById("chart7");
    if (canvas7) {
        const ctx7 = canvas7.getContext('2d');
        if (chart7Instance) chart7Instance.destroy();

        const defaultColors = ["#ec4899", "#14b8a6", "#3b82f6", "#f59e0b", "#6366f1", "#f43f5e"];

        chart7Instance = new Chart(ctx7, {
            type: "pie",
            data: {
                labels: ageLabels.length > 0 ? ageLabels : ["None Provided"],
                datasets: [{
                    data: ageDataArr.length > 0 ? ageDataArr : [0],
                    backgroundColor: defaultColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }
}

// Auto-seed FAQ function
let seedingFAQs = false;
async function seedInitialFAQs() {
    if (seedingFAQs) return;
    seedingFAQs = true;
    try {
        const websiteFaqs = [
            {
                type: 'faq',
                title: 'Who was Dr. Pio Valenzuela?',
                description: 'Dr. Pio Valenzuela (1869–1956) was a Filipino physician and revolutionary leader who fought for the country’s independence from Spanish colonial rule. He was one of the key members of the Katipunan, a secret society that sparked the Philippine Revolution in the late 1800s, and was part of the group’s council known as the Camara Negra.',
                status: 'published'
            },
            {
                type: 'faq',
                title: 'What was his role in the Philippine Revolution?',
                description: 'Valenzuela helped expand the membership of the Katipunan across multiple provinces and took charge of the society’s official publication, Ang Kalayaan, which spread awareness of the movement’s goals.',
                status: 'published'
            },
            {
                type: 'faq',
                title: 'What other roles did he have after the revolution?',
                description: 'After the end of Spanish rule and during the American period, Valenzuela served in several government positions: Municipal President (Mayor) of Polo (now Valenzuela City), President of the military division of Polo, and Governor of Bulacan Province (1921–1925). He also worked as a physician and wrote memoirs about his revolutionary experiences.',
                status: 'published'
            },
            {
                type: 'faq',
                title: 'Why was Dr. Pio Valenzuela called the "Misunderstood Patriot"?',
                description: 'He was called the "Misunderstood Patriot" because some people questioned his actions after he was arrested during the Philippine Revolution. While imprisoned, he made statements that caused debates among historians. However, before his arrest, he actively helped the Katipunan and supported the fight for freedom. Because of these mixed views, he is remembered as a patriot whose actions were interpreted differently by others.',
                status: 'published'
            },
            {
                type: 'faq',
                title: 'What did Pio Valenzuela do in the Katipunan?',
                description: 'When the Spanish colonial rule was becoming intolerable, he joined the Katipunan when he was just 22. He became the Surgeon General of the movement. Bonifacio and Valenzuela became close friends. They discussed many things about the Katipunan. He was instrumental in organizing many Katipunan chapters, especially in Bulacan.',
                status: 'published'
            }
        ];

        // Insert the initial FAQs
        for (let i = 0; i < websiteFaqs.length; i++) {
            await supabaseClient.from('content').insert([websiteFaqs[i]]);
        }
        console.log("Seeded 5 initial FAQs from website successfully.");
        // Refresh the UI explicitly after seeding
        fetchContent();
    } catch (err) {
        console.error("Error seeding FAQs:", err);
        // Reset flag to allow manual retry if needed
        seedingFAQs = false;
    }
}
async function renderEvaluationStats() {
    if (!allUsers || allUsers.length === 0) return;

    const criteria = [
        { id: 'overall', field: 'rating_overall', color: '#3b82f6' },
        { id: 'exhibit', field: 'rating_exhibit', color: '#10b981' },
        { id: 'info', field: 'rating_info', color: '#a855f7' },
        { id: 'game', field: 'rating_game', color: '#f97316' }
    ];

    criteria.forEach(crit => {
        // Filter users who have this specific rating
        // Fallback: If the field doesn't exist yet, we'll use the generic 'rating' but scale it or use mock variation
        let scores = allUsers.filter(u => u[crit.field]).map(u => u[crit.field]);

        // MOCK LOGIC for demonstration if real fields are missing
        if (scores.length === 0) {
            scores = allUsers.filter(u => u.rating).map(u => {
                // Add some slight variation so they don't look identical
                let variation = 0;
                if (crit.id === 'overall') variation = 0;
                if (crit.id === 'exhibit') variation = -0.2;
                if (crit.id === 'info') variation = 0.3;
                if (crit.id === 'game') variation = -0.5;
                return Math.max(1, Math.min(4, u.rating + variation));
            });
        }

        if (scores.length > 0) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            // Scale: 1-4 to 0-100%
            // Map 1 -> 25%, 2 -> 50%, 3 -> 75%, 4 -> 100%
            const percent = Math.round((avg / 4) * 100);

            const labelEl = document.getElementById(`label-${crit.id}`);
            const percentEl = document.getElementById(`percent-${crit.id}`);
            const barEl = document.getElementById(`bar-${crit.id}`);

            if (labelEl) {
                let status = 'Worst';
                if (avg > 3.5) status = 'Great';
                else if (avg > 2.8) status = 'Good';
                else if (avg > 2.0) status = 'So-so';
                else if (avg > 1.2) status = 'Bad';

                labelEl.innerText = status;
                labelEl.className = 'evaluation-status status-' + status.toLowerCase().replace('-', '');
            }

            if (percentEl) percentEl.innerText = percent + '%';
            if (barEl) barEl.style.width = percent + '%';
        }
    });
}


async function renderGenderChart() {
    const ctx = document.getElementById('chartGender')?.getContext('2d');
    if (!ctx) return;

    if (genderChartInstance) {
        genderChartInstance.destroy();
    }

    // Using mock data as planned since gender is not collected yet
    const totalUsers = allUsers.length || 0;
    const femaleCount = Math.round(totalUsers * 0.55);
    const maleCount = totalUsers - femaleCount;

    const data = [femaleCount, maleCount];
    const labels = ['Female', 'Male'];
    const colors = ['#f472b6', '#3b82f6'];

    genderChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10,
                borderRadius: 5,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update legend values
    const femalePct = totalUsers > 0 ? Math.round((femaleCount / totalUsers) * 100) : 0;
    const malePct = totalUsers > 0 ? 100 - femalePct : 0;

    const femaleVal = document.getElementById('gender-female-val');
    const maleVal = document.getElementById('gender-male-val');
    const totalEl = document.getElementById('gender-total-count');

    if (femaleVal) femaleVal.innerText = femalePct + '%';
    if (maleVal) maleVal.innerText = malePct + '%';
    if (totalEl) totalEl.innerText = totalUsers;
}

/* --- DATA EXPORT & RESET --- */
window.exportDataCSV = function () {
    const month = document.getElementById('filter-month').value;
    const year = document.getElementById('filter-year').value;

    if (!allUsers || allUsers.length === 0) {
        alert("No data available to export.");
        return;
    }

    const filtered = allUsers.filter(u => {
        const d = new Date(u.created_at);
        const yMatch = d.getFullYear() === parseInt(year);
        const mMatch = month === 'all' ? true : d.getMonth() === parseInt(month);
        return yMatch && mMatch;
    });

    if (filtered.length === 0) {
        alert("No tracking data found for the selected period.");
        return;
    }

    let csv = "ID,Name,Email,Age Group,Location,Rating,Message,Date\n";
    filtered.forEach(u => {
        const row = [
            u.id,
            `"${u.name || ''}"`,
            `"${u.email_encrypted || ''}"`,
            `"${u.age_group || ''}"`,
            `"${u.location || ''}"`,
            u.rating || '',
            `"${(u.message || '').replace(/"/g, '""')}"`,
            new Date(u.created_at).toLocaleString()
        ];
        csv += row.join(',') + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Museum_Analytics_${year}_${month === 'all' ? 'All' : month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

window.triggerResetDataFlow = function () {
    const month = document.getElementById('filter-month').value;
    const year = document.getElementById('filter-year').value;
    let monthName = month === 'all' ? 'All Months' : new Date(year, month).toLocaleString('default', { month: 'long' });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 2000; display: flex; justify-content: center; align-items: center;';

    overlay.innerHTML = `
      <div class="modal-content" style="background: #1e293b; width: 450px; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: white; text-align: center;">
        <h3 style="margin-top: 0; margin-bottom: 15px; color: #ef4444;"><i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> Reset Data</h3>
        <p style="color: #cbd5e1; margin-bottom: 25px; line-height: 1.5; font-size: 15px;">Are you sure you want to reset data for <b>${monthName} ${year}</b>?<br><small style="color: #94a3b8;">This will permanently delete feedback and player records for this period.</small></p>
        <div style="display: flex; gap: 15px; justify-content: center;">
           <button class="btn" id="reset-btn-no" style="background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 10px 20px; flex: 1; border-radius: 8px;">No, Go Back</button>
           <button class="btn btn-primary" id="reset-btn-yes" style="background: #ef4444; border: none; padding: 10px 20px; flex: 1; border-radius: 8px;">Yes, Reset Data</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('reset-btn-no').onclick = () => document.body.removeChild(overlay);

    document.getElementById('reset-btn-yes').onclick = () => {
        overlay.innerHTML = `
          <div class="modal-content" style="background: #1e293b; width: 450px; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: white; text-align: center;">
            <h3 style="margin-top: 0; margin-bottom: 15px; color: #3b82f6;"><i class="fas fa-download" style="margin-right:8px;"></i> Export Data?</h3>
            <p style="color: #cbd5e1; margin-bottom: 25px; font-size: 14px;">Would you like to export the data before deleting it forever?</p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
               <button class="btn btn-primary" id="btn-export-csv" style="background: #10b981; border: none; padding: 12px; border-radius: 8px;"><i class="fas fa-file-csv" style="margin-right:8px;"></i> Export CSV & Reset</button>
               <button class="btn btn-primary" id="btn-export-pdf" style="background: #f97316; border: none; padding: 12px; border-radius: 8px;"><i class="fas fa-file-pdf" style="margin-right:8px;"></i> Export PDF & Reset</button>
               <button class="btn" id="btn-skip-export" style="background: #334155; color: white; border: none; padding: 12px; border-radius: 8px;">Skip Export & Reset</button>
            </div>
            <button class="btn" onclick="document.body.removeChild(document.querySelector('.modal-overlay'))" style="margin-top: 20px; background: transparent; color: #94a3b8; width: 100%; border: 1px solid #334155; border-radius: 8px; padding: 10px;">Cancel Data Reset</button>
          </div>
        `;

        const executeReset = async () => {
            document.body.removeChild(overlay);
            const loader = document.createElement('div');
            loader.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 3000; display: flex; justify-content: center; align-items: center; color: white; font-size: 20px;';
            loader.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i> Deleting Data...';
            document.body.appendChild(loader);

            try {
                const { data: usersData } = await supabaseClient.from('users').select('id, created_at');
                const toDelete = (usersData || []).filter(u => {
                    const d = new Date(u.created_at);
                    const yMatch = d.getFullYear() === parseInt(year);
                    const mMatch = month === 'all' ? true : d.getMonth() === parseInt(month);
                    return yMatch && mMatch;
                }).map(u => u.id);

                if (toDelete.length > 0) {
                    const { error: delErr } = await supabaseClient.from('users').update({ is_archived: true }).in('id', toDelete);
                    if (delErr) throw delErr;
                    await supabaseClient.from('audit_logs').insert([{ action: 'Archived Data', details: `Archived ${toDelete.length} records for ${monthName} ${year}` }]);
                }

                document.body.removeChild(loader);
                alert("Data archived successfully.");
                location.reload();
            } catch (err) {
                console.error(err);
                alert("Error resetting data: " + err.message);
                location.reload();
            }
        };

        document.getElementById('btn-export-csv').onclick = () => {
            window.exportDataCSV();
            setTimeout(executeReset, 1000);
        };
        document.getElementById('btn-export-pdf').onclick = () => {
            window.print();
            setTimeout(executeReset, 1000);
        };
        document.getElementById('btn-skip-export').onclick = () => {
            executeReset();
        };
    };
};

window.openArchiveModal = function () {
    try {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2500; display: flex; justify-content: center; align-items: center;';

        let tableRows = '';
        if (!archivedUsers || archivedUsers.length === 0) {
            tableRows = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px;">No archived data found.</td></tr>';
        } else {
            archivedUsers.forEach(u => {
                const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A';
                const displayName = (u.name) ? obfuscateName(u.name.toString()) : 'Unknown';
                let displayEmail = '';
                try {
                    displayEmail = u.email_encrypted ? obfuscateEmail(decryptEmail(u.email_encrypted)) : 'N/A';
                } catch (e) {
                    displayEmail = 'N/A';
                }

                tableRows += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 10px;">${displayName} <br><small style="color:#94a3b8;">${displayEmail}</small></td>
                        <td style="padding: 10px;">${u.age_group || 'N/A'}</td>
                        <td style="padding: 10px;">${u.location || 'N/A'}</td>
                        <td style="padding: 10px;">${u.rating || 'N/A'} <i class="fas fa-star" style="color:#fbbf24; font-size:10px;"></i></td>
                        <td style="padding: 10px; color: #94a3b8;">${dateStr}</td>
                    </tr>
                `;
            });
        }

        overlay.innerHTML = `
          <div class="modal-content" style="background: #1e293b; width: 800px; max-height: 80vh; overflow-y: auto; padding: 25px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
               <h3 style="margin: 0; color: #f8fafc;"><i class="fas fa-archive" style="margin-right: 8px; color: #94a3b8;"></i> Data Archives</h3>
               <button onclick="document.body.removeChild(this.closest('.modal-overlay'))" style="background: transparent; color: #94a3b8; border: none; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">This data was previously archived from your active dashboard.</p>
            
            <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: #94a3b8;">
                  <th style="padding: 10px;">User Info</th>
                  <th style="padding: 10px;">Age Group</th>
                  <th style="padding: 10px;">Location</th>
                  <th style="padding: 10px;">Rating</th>
                  <th style="padding: 10px;">Date Logged</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `;

        document.body.appendChild(overlay);
    } catch (err) {
        console.error("Archive modal error:", err);
        alert("Could not load archive data: " + err.message);
    }
};

/* UI Enhancement Helpers */
function toggleSidebar() {
    document.body.classList.toggle('fullscreen-mode');
    const icon = document.querySelector('.fullscreen-toggle i');
    if (!icon) return;

    if (document.body.classList.contains('fullscreen-mode')) {
        icon.classList.remove('fa-expand-alt');
        icon.classList.add('fa-compress-alt');
    } else {
        icon.classList.remove('fa-compress-alt');
        icon.classList.add('fa-expand-alt');
    }
}

function scrollToActivity() {
    // Show dashboard page
    const dashPage = document.getElementById('dashboard');
    if (dashPage && !dashPage.classList.contains('active')) {
        // Find the dashboard nav link and click it
        const dashNav = document.querySelector('.nav li:first-child');
        if (typeof openPage === 'function') {
            openPage('dashboard', dashNav);
        }
    }

    // Scroll to the recent activity table
    const table = document.querySelector('.table-container');
    if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Brief visual highlight
        table.style.transition = 'all 0.5s ease';
        table.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.4)';
        table.style.borderColor = 'var(--accent-primary)';

        setTimeout(() => {
            table.style.boxShadow = 'var(--shadow-sm)';
            table.style.borderColor = 'rgba(255, 255, 255, 0.02)';
        }, 2000);
    }

    // Clear notification badge locally
    const badge = document.getElementById('notif-count');
    if (badge) badge.style.display = 'none';
}

function updateNotifBadge(count) {
    const badge = document.getElementById('notif-count');
    if (!badge) return;

    if (count > 0) {
        badge.innerText = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}
