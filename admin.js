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
            document.getElementById('stat-users').innerText = totalUsers;
            document.getElementById('stat-visitors').innerText = stats.total_visitors || 0;
            document.getElementById('stat-photoshoots').innerText = stats.photoshoot_bookings || 0;
            document.getElementById('stat-tours').innerText = stats.tour_bookings || 0;

            // Game Dashboard
            document.getElementById('stat-game-players').innerText = totalUsers;
            
            // Calculate Average Game Rating
            const ratedUsers = allUsers.filter(u => u.rating);
            if (ratedUsers.length > 0) {
                const avg = (ratedUsers.reduce((sum, u) => sum + u.rating, 0) / ratedUsers.length).toFixed(1);
                document.getElementById('stat-game-rating').innerText = avg;
            } else {
                document.getElementById('stat-game-rating').innerText = 'N/A';
            }
            
            document.getElementById('stat-feedbacks').innerText = stats.total_feedbacks || 0;
            // E-certificate is currently static as it's not in the DB schema yet
            document.getElementById('stat-game-certs').innerText = stats.certificates_sent || 0;

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

// [admin.js] Sidebar Toggle Logic
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

// --- AUDIT LOGS ---
let allAuditLogs = [];
async function fetchAuditLogs() {
    try {
        // Fallback gracefully if table doesn't exist yet
        const { data: logs, error } = await supabaseClient
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        allAuditLogs = logs || [];
        renderAuditLogs(allAuditLogs);
    } catch (err) {
        console.error("Audit logs error (Table might not exist yet):", err);
    }
}

// Populate Day Filter logic removed as we use date picker now

function renderAuditLogs(logs) {
    const tbody = document.getElementById('audit-log-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let lastDate = null;

    logs.forEach(log => {
        const rawDate = new Date(log.created_at);
        const currentDateOnly = rawDate.toLocaleDateString();

        // Add date separator line
        if (currentDateOnly !== lastDate) {
            const separatorTr = document.createElement('tr');
            separatorTr.innerHTML = `
                <td colspan="5" style="background: rgba(255,255,255,0.03); padding: 12px 20px; border-left: 4px solid var(--accent-primary);">
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

        const displayEmail = log.admin_email || 'Unknown Admin';
        
        let badgeBg = 'rgba(59, 130, 246, 0.15)'; // Blue
        let badgeColor = 'var(--blue, #3b82f6)';
        const actLower = (log.action || '').toLowerCase();
        
      if (actLower.includes('delete') || actLower.includes('remove')) {
            badgeBg = 'rgba(239, 68, 68, 0.15)'; // Red
            badgeColor = '#ef4444';
        } else if (actLower.includes('site visit')) {
            badgeBg = 'rgba(245, 158, 11, 0.15)'; // Yellow
            badgeColor = '#f59e0b';
        } else if (actLower.includes('login') || actLower.includes('log in')) {
            badgeBg = 'rgba(59, 130, 246, 0.15)'; // Blue
            badgeColor = 'var(--blue, #3b82f6)';
        } else if (actLower.includes('add') || actLower.includes('create') || actLower.includes('approve')) {
            badgeBg = 'rgba(34, 197, 94, 0.15)'; // Green
            badgeColor = '#22c55e';
        } else if (actLower.includes('update') || actLower.includes('edit')) {
            badgeBg = 'rgba(168, 85, 247, 0.15)'; // Purple
            badgeColor = '#a855f7';
        }

        tr.innerHTML = `
            <td style="white-space: nowrap; color: var(--text-muted);">${timeStr}</td>
            <td>
                <b style="color: var(--text-main);">${displayEmail}</b>
            </td>
            <td><span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">${log.action}</span></td>
            <td style="font-size: 13px; color: var(--text-muted);">${log.details || ''}</td>
            <td style="text-align: right;">
                <button class="btn-icon delete" onclick="deleteAuditLog('${log.id}')" title="Delete Log" style="color: #64748b; background: rgba(255,255,255,0.05);"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Filter Audit Logs
function filterAuditLogs() {
    const term = (document.getElementById('audit-search')?.value || '').toLowerCase();
    const dateVal = document.getElementById('audit-filter-date')?.value;

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

        return matchTerm && matchDate;
    });

    renderAuditLogs(filtered);
}

const searchAuditInput = document.getElementById('audit-search');
const dateAuditFilter = document.getElementById('audit-filter-date');

if (searchAuditInput) searchAuditInput.addEventListener('input', filterAuditLogs);
if (dateAuditFilter) dateAuditFilter.addEventListener('change', filterAuditLogs);

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

async function fetchUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        await fetchApprovedMapping();
        const localIds = JSON.parse(localStorage.getItem('approved_feedbacks') || '[]');
        
        users.forEach(u => {
            u.is_approved = approvedFeedbackIds.includes(u.id) || localIds.includes(u.id);
        });

        allUsers = users;
        renderUsers(allUsers);
        renderRecentUsers(allUsers.slice(0, 5)); // Show top 5 on dash
        renderFeedbacks(allUsers.filter(u => u.rating || u.message));

        if (document.getElementById('analytics').classList.contains('active')) {
            renderCharts();
            renderEvaluationStats();
            renderGenderChart();
            renderPlatformEngagementChart();
        }

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

        const displayName = obfuscateName(user.name);
        const displayEmail = obfuscateEmail(decryptedEmail);

        const dateStr = rawDate.toLocaleDateString() + ' ' + rawDate.toLocaleTimeString();

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: rgba(59, 130, 246, 0.15); color: var(--blue);">${initials}</div>
                    <div>
                        <b title="${user.name || 'Unknown'}">${displayName}</b>
                        <br><small style="color: var(--text-muted); font-size: 12px;" title="${decryptedEmail}">${displayEmail}</small>
                    </div>
                </div>
            </td>
            <td>${user.age_group || 'N/A'}</td>
            <td><i class="fas fa-map-marker-alt" style="color: var(--text-muted); margin-right: 5px;"></i> ${user.location || 'N/A'}</td>
            <td>${dateStr}</td>
            <td>
                <button class="btn-icon delete" onclick="deleteUser('${user.id}')" title="Delete User">
                    <i class="fas fa-trash"></i>
                </button>
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
        const displayName = obfuscateName(user.name);

        const rawDate = new Date(user.created_at);
        const dateStr = rawDate.toLocaleDateString();

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: rgba(16, 185, 129, 0.15); color: var(--green);">${initials}</div>
                    <div>
                        <b title="${user.name || 'Unknown'}">${displayName}</b>
                    </div>
                </div>
            </td>
            <td><i class="fas fa-map-marker-alt" style="color: var(--text-muted); margin-right: 5px;"></i> ${user.location || 'N/A'}</td>
            <td>${dateStr}</td>
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

// --- FEEDBACKS ---
function renderFeedbacks(feedbacks) {
    const tbody = document.getElementById('all-feedbacks-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort: Pending feedbacks first
    const sortedFeedbacks = [...feedbacks].sort((a, b) => {
        if (a.is_approved === b.is_approved) return 0;
        return a.is_approved ? 1 : -1;
    });

    let firstApproved = true;

    sortedFeedbacks.forEach(user => {
        // Add separator before first approved item if there are pending items
        const hasPending = sortedFeedbacks.some(f => !f.is_approved);
        if (user.is_approved && firstApproved && hasPending) {
            const sepTr = document.createElement('tr');
            sepTr.innerHTML = `
                <td colspan="5" style="background: rgba(255,255,255,0.03); padding: 12px 20px; border-left: 4px solid var(--green);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-check-circle" style="color: var(--green); font-size: 14px;"></i>
                        <span style="font-weight: 700; color: white; letter-spacing: 0.5px; font-size: 13px;">APPROVED FEEDBACKS</span>
                    </div>
                </td>
            `;
            tbody.appendChild(sepTr);
            firstApproved = false;
        }

        const tr = document.createElement('tr');
        const decryptedEmail = decryptEmail(user.email_encrypted);
        const initials = user.name ? user.name.substring(0, 2).toUpperCase() : '??';
        const rawDate = new Date(user.created_at);
        
        const displayName = obfuscateName(user.name);
        const displayEmail = obfuscateEmail(decryptedEmail);

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

        // Status badge colors
        const statusBg = user.is_approved ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)';
        const statusColor = user.is_approved ? '#22c55e' : '#f59e0b';
        const statusText = user.is_approved ? 'Approved' : 'Pending';

        const approveBtn = !user.is_approved 
                           ? `<button class="btn btn-primary" onclick="approveFeedback('${user.id}')" style="margin-right: 8px; padding: 4px 12px; font-size: 12px; background: var(--green); border-color: var(--green); border-radius: 6px;">Approve</button>`
                           : `<button class="btn btn-primary" style="margin-right: 8px; padding: 4px 12px; font-size: 12px; background: var(--green); border-color: var(--green); border-radius: 6px; cursor: default; opacity: 0.8;" disabled>Approved</button>`;

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: rgba(59, 130, 246, 0.15); color: var(--blue);">${initials}</div>
                    <div>
                        <b style="color: var(--text-main);" title="${user.name || 'Unknown'}">${displayName}</b>
                        <br><small style="color: var(--text-muted); font-size: 12px;" title="${decryptedEmail}">${displayEmail}</small>
                    </div>
                </div>
            </td>
            <td style="white-space: nowrap;">
                <div style="margin-bottom: 4px;">${starsHTML}</div>
                <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">${statusText}</span>
            </td>
            <td style="max-width: 300px; line-height: 1.5; font-size: 14px; white-space: normal; color: var(--text-muted);">${user.message || '<i>No message provided</i>'}</td>
            <td>${dateOnlyStr}<br><small style="color: var(--text-muted);">${timeOnlyStr}</small></td>
            <td style="white-space: nowrap;">
                ${approveBtn}
                <button class="btn btn-danger" onclick="deleteUser('${user.id}')" style="padding: 4px 12px; font-size: 12px; background: var(--red); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterFeedbacks() {
    const term = (document.getElementById('feedback-search')?.value || '').toLowerCase();
    const starFilter = document.getElementById('feedback-filter-stars')?.value;
    const dateFilter = document.getElementById('feedback-filter-date')?.value;

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

        return matchTerm && matchStars && matchDate;
    });
    renderFeedbacks(filtered);
}

const searchFeedbackInput = document.getElementById('feedback-search');
const starsFeedbackFilter = document.getElementById('feedback-filter-stars');
const dateFeedbackFilter = document.getElementById('feedback-filter-date');

if (searchFeedbackInput) searchFeedbackInput.addEventListener('input', filterFeedbacks);
if (starsFeedbackFilter) starsFeedbackFilter.addEventListener('change', filterFeedbacks);
if (dateFeedbackFilter) dateFeedbackFilter.addEventListener('change', filterFeedbacks);

// Load Approved IDs mapped to users
let approvedFeedbackIds = [];
async function fetchApprovedMapping() {
    try {
        const { data } = await supabaseClient.from('analytics').select('approved_feedbacks').eq('id', 1).single();
        if (data && data.approved_feedbacks) {
            approvedFeedbackIds = data.approved_feedbacks;
        }
    } catch(e) { console.error("Could not fetch mappings", e) }
}

async function approveFeedback(userId) {
    if (confirm('Approve this feedback to be displayed on the public website?')) {
        try {
            await fetchApprovedMapping();
            if (!approvedFeedbackIds.includes(userId)) {
                approvedFeedbackIds.push(userId);
                const { error } = await supabaseClient.from('analytics').update({ approved_feedbacks: approvedFeedbackIds }).eq('id', 1);
                if (error) {
                    // Fallback to storing in localStorage if analytics column doesn't exist
                    console.warn("Analytics mapping failed, falling back to localStorage");
                    let localIds = JSON.parse(localStorage.getItem('approved_feedbacks') || '[]');
                    if (!localIds.includes(userId)) localIds.push(userId);
                    localStorage.setItem('approved_feedbacks', JSON.stringify(localIds));
                }
            }
            await fetchUsers();
        } catch (err) {
            console.error("Error approving feedback:", err);
            alert("Failed to approve feedback: " + (err.message || JSON.stringify(err)));
        }
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
async function fetchSettings() {
    try {
        const { data: settings, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
        if (error) throw error;

        if (settings) {
            // Only fetch text inputs now
            const inputs = document.querySelectorAll('#settings input[type="text"]');
            if (inputs.length >= 1) {
                inputs[0].value = settings.site_name || '';
            }

            const toggles = document.querySelectorAll('#settings input[type="checkbox"]');
            if (toggles.length >= 2) {
                toggles[0].checked = settings.user_registration !== false;
                toggles[1].checked = settings.maintenance_mode === true;
            }
        }
    } catch (err) {
        console.error("Settings error:", err);
    }
}

async function saveSettings() {
    // Only fetch text inputs now
    const inputs = document.querySelectorAll('#settings input[type="text"]');
    const toggles = document.querySelectorAll('#settings input[type="checkbox"]');

    const site_name = inputs[0].value;
    const user_registration = toggles[0].checked;
    const maintenance_mode = toggles[1].checked;

    try {
        const { error } = await supabaseClient.from('settings').update({
            site_name,
            user_registration,
            maintenance_mode
        }).eq('id', 1);

        if (error) throw error;
        alert("Settings saved successfully!");
    } catch (err) {
        console.error("Save settings error:", err);
        alert("Failed to save settings.");
    }
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
                        label: function(context) {
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
