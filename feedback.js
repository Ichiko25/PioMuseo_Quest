// feedback.js

document.addEventListener('DOMContentLoaded', () => {

    // 0. Fetch Public Content
    fetchPublicContent();
    fetchApprovedFeedbacks();

    // 1. ANALTICS: Log Visitor
    logVisitor();

    // 2. ANALYTICS: Track Booking Clicks
    const proceedButtons = document.querySelectorAll('a[href*="forms.gle"]');
    proceedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const href = btn.getAttribute('href');
            if (href.includes('3XDygMrpk5aspWxn6')) {
                logBookingClick('photoshoot');
                logAudit('User clicked to book a Photoshoot', 'Started Photoshoot Booking');
            } else if (href.includes('s4FW1wRm64HCPsyC6')) {
                logBookingClick('tour');
                logAudit('User clicked to book a Group Tour', 'Started Tour Booking');
            }
        });
    });

    // 3. FEEDBACK FORM
    const feedbackForm = document.querySelector('.feedback-form');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Change button state
            const submitBtn = feedbackForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = 'Sending...';
            submitBtn.disabled = true;

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const ageGroup = document.getElementById('age-group').value;
            const location = document.getElementById('address').value;
            const message = document.getElementById('message').value;

            // Get selected Rating
            let rating = null;
            const ratingInputs = document.querySelectorAll('input[name="rating"]');
            for (const input of ratingInputs) {
                if (input.checked) {
                    rating = parseInt(input.value);
                    break;
                }
            }

            try {
                // 1. Create User
                const { data: userData, error: userError } = await supabaseClient
                    .from('users')
                    .insert([{
                        name: name,
                        email_encrypted: encryptEmail(email),
                        age_group: ageGroup,
                        location: location,
                        message: message,
                        rating: rating
                    }])
                    .select();

                if (userError) throw userError;

                // Increment total feedbacks in Analytics
                await incrementFeedbacks();

                // Audit Log
                await logAudit(`Feedback submitted with rating: ${rating || 'None'}`, 'Feedback Submission', name, email);

                alert('Thank you! Your feedback has been submitted successfully.');
                feedbackForm.reset();

            } catch (error) {
                console.error("Error submitting feedback:", error);
                alert("Sorry, there was an error submitting your feedback.");
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

/* Helper Functions for Analytics */
async function logVisitor() {
    let visited = sessionStorage.getItem('hasVisited');
    if (!visited) {
        sessionStorage.setItem('hasVisited', 'true');
        try {
            const { data, error } = await supabaseClient.rpc('increment_visitor');
            // If RPC doesn't exist, we fallback to pulling and updating
            if (error) {
                const { data: analytics } = await supabaseClient.from('analytics').select('*').eq('id', 1).single();
                if (analytics) {
                    await supabaseClient.from('analytics').update({ total_visitors: analytics.total_visitors + 1 }).eq('id', 1);
                }
            }
            await logAudit('New anonymous visitor session started', 'Site Visit');
        } catch (err) {
            console.error(err);
        }
    }
}

async function logBookingClick(type) {
    try {
        const { data: analytics } = await supabaseClient.from('analytics').select('*').eq('id', 1).single();
        if (analytics) {
            if (type === 'photoshoot') {
                await supabaseClient.from('analytics').update({
                    booking_clicks: (analytics.booking_clicks || 0) + 1,
                    photoshoot_bookings: (analytics.photoshoot_bookings || 0) + 1
                }).eq('id', 1);
            } else if (type === 'tour') {
                await supabaseClient.from('analytics').update({
                    booking_clicks: (analytics.booking_clicks || 0) + 1,
                    tour_bookings: (analytics.tour_bookings || 0) + 1
                }).eq('id', 1);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

async function logAudit(details, action, visitorName = null, email = null) {
    try {
        const payload = {
            action: action,
            details: details
        };
        if (visitorName) payload.visitor_name = visitorName;
        if (email) payload.email_encrypted = encryptEmail(email);

        await supabaseClient.from('audit_logs').insert([payload]);
    } catch (err) {
        // Silent fail for audits if table doesn't exist
        console.error("Audit log error:", err);
    }
}

async function incrementFeedbacks() {
    try {
        const { data: analytics } = await supabaseClient.from('analytics').select('*').eq('id', 1).single();
        if (analytics) {
            await supabaseClient.from('analytics').update({ total_feedbacks: analytics.total_feedbacks + 1 }).eq('id', 1);
        }
    } catch (err) {
        console.error(err);
    }
}

// Helper to Obfuscate Name
function obfuscateName(fullName) {
    if (!fullName) return 'Unknown';
    const parts = fullName.trim().split(' ');
    const obfuscatedParts = parts.map(part => {
        if (part.length <= 1) return part;
        return part.charAt(0) + '*'.repeat(part.length - 1);
    });
    return obfuscatedParts.join(' ');
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function fetchApprovedFeedbacks() {
    try {
        const { data: analyticsData } = await supabaseClient.from('analytics').select('approved_feedbacks').eq('id', 1).single();
        let approvedIds = [];
        if (analyticsData && analyticsData.approved_feedbacks) {
            approvedIds = analyticsData.approved_feedbacks;
        }
        const localIds = JSON.parse(localStorage.getItem('approved_feedbacks') || '[]');
        approvedIds = [...new Set([...approvedIds, ...localIds])];

        let feedbacks = [];
        if (approvedIds.length > 0) {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .in('id', approvedIds)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            feedbacks = data;
        }

        const container = document.getElementById('approved-feedbacks-list');
        const totalContainer = document.getElementById('total-star-rating');

        if (!container) return;

        if (!feedbacks || feedbacks.length === 0) {
            container.innerHTML = '<p style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">No feedbacks available yet.</p>';
            if (totalContainer) totalContainer.innerHTML = '';
            return;
        }

        if (totalContainer) {
            let sum = 0;
            let count = 0;
            feedbacks.forEach(fb => {
                if (fb.rating) {
                    sum += fb.rating;
                    count++;
                }
            });

            if (count > 0) {
                const avg = (sum / count).toFixed(1);
                let avgStarsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    if (i <= Math.round(avg)) avgStarsHTML += '<i class="fas fa-star" style="color:#fbbf24; font-size: 20px;"></i>';
                    else avgStarsHTML += '<i class="far fa-star" style="color:#d1d5db; font-size: 20px;"></i>';
                }

                totalContainer.innerHTML = `
                    <div style="font-size: 38px; font-weight: 700; color: #1e293b; line-height: 1; letter-spacing: -1px;">${avg}</div>
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <div style="display: flex; gap: 4px; margin-bottom: 4px;">${avgStarsHTML}</div>
                        <div style="font-size: 13px; color: #64748b; font-weight: 500;">Based on ${count} reviews</div>
                    </div>
                `;
            } else {
                totalContainer.innerHTML = '';
            }
        }

        container.innerHTML = '';

        if (feedbacks.length > 6) {
            // Carousel Mode (2 Rows)
            const mid = Math.ceil(feedbacks.length / 2);
            const row1 = feedbacks.slice(0, mid);
            const row2 = feedbacks.slice(mid);

            function createPillHTML(fb) {
                const dateStr = new Date(fb.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
                let starsHTML = '';
                const rating = fb.rating || 0;
                for (let i = 1; i <= 5; i++) {
                    if (i <= rating) starsHTML += '<i class="fas fa-star" style="color:#fbbf24; font-size: 14px;"></i>';
                    else starsHTML += '<i class="far fa-star" style="color:#d1d5db; font-size: 14px;"></i>';
                }

                return `
                    <div class="feedback-pill feedback-pill-marquee">
                        <div class="feedback-pill-header">
                            <div class="feedback-pill-header-left">
                                <div class="feedback-pill-avatar">${fb.name ? fb.name.substring(0, 1).toUpperCase() : '?'}</div>
                                <div class="feedback-pill-info">
                                    <span class="feedback-pill-name">${obfuscateName(fb.name)}</span>
                                    <span class="feedback-pill-subtitle">${dateStr}</span>
                                    <div class="feedback-pill-stars">
                                        ${starsHTML} <span class="feedback-pill-rating-num">${rating.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="feedback-pill-quote"><i class="fas fa-quote-right"></i></div>
                        </div>
                        <div class="feedback-pill-message">${fb.message || ''}</div>
                    </div>
                `;
            }

            const row1Content = row1.map(fb => createPillHTML(fb)).join('');
            const row2Content = row2.map(fb => createPillHTML(fb)).join('');

            container.innerHTML = `
                <div class="marquee-container">
                    <div class="marquee-row">
                        <div class="marquee-track left">
                            ${row1Content} ${row1Content}
                        </div>
                    </div>
                    <div class="marquee-row">
                        <div class="marquee-track right">
                            ${row2Content} ${row2Content}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Grid Mode (Static 3-column)
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
            container.style.gap = '25px';

            feedbacks.forEach(fb => {
                const dateStr = new Date(fb.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
                let starsHTML = '';
                const rating = fb.rating || 0;
                for (let i = 1; i <= 5; i++) {
                    if (i <= rating) starsHTML += '<i class="fas fa-star" style="color:#fbbf24; font-size: 14px;"></i>';
                    else starsHTML += '<i class="far fa-star" style="color:#d1d5db; font-size: 14px;"></i>';
                }

                container.innerHTML += `
                    <div class="feedback-pill" style="opacity: 1; transform: translateY(0); animation: none;">
                        <div class="feedback-pill-header">
                            <div class="feedback-pill-header-left">
                                <div class="feedback-pill-avatar">${fb.name ? fb.name.substring(0, 1).toUpperCase() : '?'}</div>
                                <div class="feedback-pill-info">
                                    <span class="feedback-pill-name">${obfuscateName(fb.name)}</span>
                                    <span class="feedback-pill-subtitle">${dateStr}</span>
                                    <div class="feedback-pill-stars">
                                        ${starsHTML} <span class="feedback-pill-rating-num">${rating.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="feedback-pill-quote"><i class="fas fa-quote-right"></i></div>
                        </div>
                        <div class="feedback-pill-message">${fb.message || ''}</div>
                    </div>
                `;
            });
        }
    } catch (err) {
        console.error("Error loading approved feedbacks:", err);
        const container = document.getElementById('approved-feedbacks-list');
        if (container) {
            container.innerHTML = '<p style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">Failed to load feedbacks.</p>';
        }
    }
}

// --- PUBLIC CONTENT FETCHING (Gallery & Blogs) ---
async function fetchPublicContent() {
    try {
        let { data: contents, error } = await supabaseClient
            .from('content')
            .select('*')
            .eq('status', 'published') // only show published
            .order('created_at', { ascending: false });

        if (error) throw error;

        const blogs = contents.filter(c => c.type === 'blog');
        const galleries = contents.filter(c => c.type === 'gallery');
             const faqs = contents.filter(c => c.type === 'faq');

        // Render FAQs
        const faqContainer = document.getElementById('faq-section-container');
        if (faqContainer && faqs.length > 0) {
            // Keep the H3
            faqContainer.innerHTML = '<h3>FAQ\'s</h3>';
            faqs.forEach(faq => {
                const item = document.createElement('div');
                item.style.marginBottom = '20px';
                item.style.textAlign = 'left';
                item.style.padding = '15px';
                item.style.background = 'rgba(255,255,255,0.5)';
                item.style.borderRadius = '12px';
                item.style.border = '1px solid rgba(0,0,0,0.05)';
                item.innerHTML = `
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 8px; font-size: 15px; display:flex; align-items:flex-start; gap:10px;">
                        <span style="background: var(--accent-primary); color: white; width: 18px; height: 18px; border-radius: 50%; font-size: 10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;">?</span>
                        ${faq.title}
                    </div>
                    <div style="color: #475569; font-size: 14px; line-height: 1.6; padding-left: 28px;">
                        ${faq.description}
                    </div>
                `;
                faqContainer.appendChild(item);
            });
        } else if (faqContainer) {
            faqContainer.innerHTML = '<h3>FAQ\'s</h3><p style="color: var(--text-muted); font-size: 14px; text-align: center;">No FAQs available at the moment.</p>';
        }

        // Render Blogs
        const blogContainer = document.querySelector('.blog-grid');
        if (blogContainer) {
            // Only overwrite if we have dynamic content, otherwise keep user's static HTML
            if (blogs.length > 0) {
                blogContainer.innerHTML = '';
                blogs.forEach(blog => {
                    const fullDesc = blog.description || '';
                    // Extract a short description for the card (strip HTML, max 150 chars)
                    const parsedHtml = new DOMParser().parseFromString(fullDesc, 'text/html');
                    const textOnly = parsedHtml.body.textContent || "";
                    const shortDesc = textOnly.substring(0, 120) + '...';

                    const views = blog.views || 0;
                    const encodedDesc = encodeURIComponent(fullDesc);

                    blogContainer.innerHTML += `
                    <article class="blog-card">
                        <h3 style="padding: 15px 15px 5px; color: var(--black); font-size: 1.17em; margin-top: 0;">${blog.title}</h3>
                        <p style="padding: 0 15px; color: var(--charcoal-mid); font-size: 1rem; line-height: 1.5;">${shortDesc}</p>
                        <p class="blog-meta" style="padding-left:15px; padding-bottom:5px;">
                            Published Story &middot; ${views} views
                        </p>
                        <button class="read-btn dynamic-blog-btn" type="button" data-id="${blog.id}" data-fulldesc="${encodedDesc}">Read More</button>
                    </article>`;
                });

                // Attach event listeners to the new buttons
                document.querySelectorAll('.dynamic-blog-btn').forEach(btn => {
                    btn.addEventListener('click', function () {
                        const id = this.getAttribute('data-id');
                        const fullDesc = decodeURIComponent(this.getAttribute('data-fulldesc'));
                        openDynamicBlog(id, fullDesc);
                    });
                });
            }
        }

        // Render Galleries
        const leftRow = document.querySelector('.carousel-row.row-left .track') || document.querySelector('.carousel-row.row-left');
        const rightRow = document.querySelector('.carousel-row.row-right .track') || document.querySelector('.carousel-row.row-right');

        if (leftRow && rightRow) {
            // Only overwrite if we have dynamic gallery content
            if (galleries.length > 0) {
                leftRow.innerHTML = '';
                rightRow.innerHTML = '';
                galleries.forEach((gal, index) => {
                    let img = gal.image_url || 'web-images/qqq.jpg';
                    if (img.startsWith('images/')) {
                        img = img.replace('images/', 'web-images/').replace(/\.(jpeg|png)$/i, '.jpg').toLowerCase();
                    }
                    const imgTag = `<div class="card"><img src="${img}" alt="${gal.title}" onerror="this.src='web-images/qqq.jpg'"></div>`;
                    if (index % 2 === 0) leftRow.innerHTML += imgTag;
                    else rightRow.innerHTML += imgTag;
                });
            }
        }
    } catch (err) {
        console.error("Error loading public content:", err);
    }
}

async function openDynamicBlog(id, fullHtml) {
    // Show Modal
    const modal = document.getElementById("blogModal");
    const contentBox = document.getElementById("blogContent");
    if (modal && contentBox) {
        contentBox.innerHTML = fullHtml;
        modal.style.display = "block";
    }

    try {
        const { data, error } = await supabaseClient.from('content').select('views').eq('id', id).single();
        if (data) {
            await supabaseClient.from('content').update({ views: data.views + 1 }).eq('id', id);
        }
    } catch (err) {
        console.error("Error incrementing view:", err);
    }
}

async function autoSeedContent() {
    const defaultContent = [
        // Blogs
        { type: 'blog', title: 'The Life and Legacy of Dr. Pío Valenzuela', description: '<h2>The Life and Legacy of Dr. Pío Valenzuela</h2>\n<p>\nPío Valenzuela was born on July 11, 1869 in Polo, Bulacan—now Valenzuela City. He studied medicine at the University of Santo Tomas and became a licensed physician in 1895. After completing his studies, he practiced medicine in Manila and Bulacan while starting a family with his wife, Marciana Castriy.\n<br> A Katipunero <br> <br> \nWhile still a medical student, Valenzuela joined the Katipunan in 1892 and became a close ally of its founder, Andrés Bonifacio. He served as the society’s physician and helped establish its revolutionary newspaper Kalayaan together with Emilio Jacinto. The publication helped spread the ideas of the revolution and recruit members.\n<br> <br> \nValenzuela was sent by Bonifacio to Dapitan to consult José Rizal about the planned uprising against Spain. Rizal advised caution, saying the revolution should only begin if the people were prepared and well-armed.\nAfter the Katipunan was discovered, Valenzuela was arrested and imprisoned by Spanish authorities, later being deported to Spain and Africa. After his release, he returned to the Philippines and entered public service, becoming municipal president of Polo and later governor of Bulacan.\nHe died on April 6, 1956. Today, Valenzuela City bears his name in honor of his contributions to Philippine history and the struggle for independence.\n</p>', status: 'published' },
        { type: 'blog', title: 'Museum Updates', description: '<h2>Museum Updates</h2>\n<p>\nThe Museo ni Dr. Pío Valenzuela continues to improve its exhibits\nto provide visitors with a deeper understanding of Philippine history.\n</p>\n<p>\nRecent updates include improved artifact displays, new educational\npanels, and guided tours for students and tourists.\n</p>', status: 'published' },
        { type: 'blog', title: 'Educational Discoveries', description: '<h2>Educational Discoveries</h2>\n<p>\nInside the museum are many artifacts that tell the story of the\nPhilippine Revolution and the life of Dr. Pío Valenzuela.\n</p>\n<p>\nVisitors can learn about historical documents, personal belongings,\nand photographs that highlight the contributions of Filipino heroes.\n</p>', status: 'published' },

        // Gallery Left
        { type: 'gallery', title: 'Second Floor', image_url: 'web-images/second-floor.jpg', status: 'published' },
        { type: 'gallery', title: 'Table', image_url: 'web-images/table.jpg', status: 'published' },
        { type: 'gallery', title: 'Study Table', image_url: 'web-images/study-table.jpg', status: 'published' },
        { type: 'gallery', title: 'Museo Pic', image_url: 'web-images/museo-pic.jpg', status: 'published' },
        { type: 'gallery', title: 'Front', image_url: 'web-images/front.jpg', status: 'published' },
        { type: 'gallery', title: 'Right', image_url: 'web-images/right.jpg', status: 'published' },
        { type: 'gallery', title: 'Family', image_url: 'web-images/fam.jpg', status: 'published' },
        { type: 'gallery', title: 'Gazebo', image_url: 'web-images/gazebo.jpg', status: 'published' },
        { type: 'gallery', title: 'Cinematic Table', image_url: 'web-images/cinematic-table.jpg', status: 'published' },
        { type: 'gallery', title: 'News', image_url: 'web-images/news.jpg', status: 'published' },
        { type: 'gallery', title: 'Sala', image_url: 'web-images/sala.jpg', status: 'published' },
        { type: 'gallery', title: 'Guho', image_url: 'web-images/guho.jpg', status: 'published' },
        { type: 'gallery', title: 'Tools', image_url: 'web-images/tools.jpg', status: 'published' },
        { type: 'gallery', title: 'Pictures', image_url: 'web-images/pic.jpg', status: 'published' },
        { type: 'gallery', title: 'Cinematic', image_url: 'web-images/cinematic.jpg', status: 'published' },
        { type: 'gallery', title: 'First Floor', image_url: 'web-images/first-floor.jpg', status: 'published' },

        // Gallery Right
        { type: 'gallery', title: 'Bookshelf', image_url: 'web-images/bookshelf.jpg', status: 'published' },
        { type: 'gallery', title: 'Dining', image_url: 'web-images/dining.jpg', status: 'published' },
        { type: 'gallery', title: 'Salaa', image_url: 'web-images/salaa.jpg', status: 'published' },
        { type: 'gallery', title: 'Guho At', image_url: 'web-images/guhoat.jpg', status: 'published' },
        { type: 'gallery', title: 'Dio', image_url: 'web-images/dio.jpg', status: 'published' },
        { type: 'gallery', title: 'Kitchen', image_url: 'web-images/kitchen.jpg', status: 'published' },
        { type: 'gallery', title: 'Clinica', image_url: 'web-images/clinica.jpg', status: 'published' },
        { type: 'gallery', title: 'Dioramas', image_url: 'web-images/dioramas.jpg', status: 'published' },
        { type: 'gallery', title: 'Exit', image_url: 'web-images/exit.jpg', status: 'published' },
        { type: 'gallery', title: 'Haligi ng Tahanan', image_url: 'web-images/haligingtahanan.jpg', status: 'published' },
        { type: 'gallery', title: 'Timeline', image_url: 'web-images/timeline.jpg', status: 'published' },
        { type: 'gallery', title: 'TV', image_url: 'web-images/tv.jpg', status: 'published' },
        { type: 'gallery', title: 'Jail', image_url: 'web-images/jail.jpg', status: 'published' },
        { type: 'gallery', title: 'History', image_url: 'web-images/history.jpg', status: 'published' }
    ];

    try {
        await supabaseClient.from('content').insert(defaultContent);
    } catch (e) {
        console.error("Auto seed failed", e);
    }
}

async function fetchFAQs() {
    console.log("faq: fetchFAQs started");
    try {
        const { data: faqs, error } = await supabaseClient
            .from('content').select('*').eq('type', 'faq')
            .eq('status', 'published');
        console.log("faq: received data", faqs);
        // ... update UI
    } catch (err) { console.error("faq: failed", err); }
}
