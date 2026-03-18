/* SUPABASE INITIALIZATION MOVED TO supabaseClient.js TO AVOID CONFLICTS */

// Navbar toggle
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

// Carousel
const track = document.querySelector('.carousel .track');
const cards = Array.from(track.children);
const cardWidth = cards[0].offsetWidth + 25;
let currentIndex = 0;
const interval = 5000;

// Clone first and last cards for infinite effect
const firstClone = cards[0].cloneNode(true);
const lastClone = cards[cards.length - 1].cloneNode(true);
track.appendChild(firstClone);
track.insertBefore(lastClone, track.firstChild);

const allCards = Array.from(track.children);
let offset = -(cardWidth * (currentIndex + 1) - track.offsetWidth / 2 + cardWidth / 2);
track.style.transform = `translateX(${offset}px)`;

// Set active classes initially
function setClasses(index) {
    allCards.forEach((card, i) => {
        card.classList.remove('active', 'prev', 'next');
        if (i === index) card.classList.add('active');
        else if (i === index - 1) card.classList.add('prev');
        else if (i === index + 1) card.classList.add('next');
    });
}
setClasses(currentIndex + 1);

// Slide function
function slide() {
    currentIndex++;
    track.style.transition = 'transform 0.8s ease-in-out';
    const translate = -(cardWidth * (currentIndex + 1) - track.offsetWidth / 2 + cardWidth / 2);
    track.style.transform = `translateX(${translate}px)`;

    setClasses(currentIndex + 1);

    // Reset to first card if we reached the cloned last card
    if (currentIndex >= cards.length) {
        setTimeout(() => {
            track.style.transition = 'none';
            currentIndex = 0;
            const resetTranslate = -(cardWidth * (currentIndex + 1) - track.offsetWidth / 2 + cardWidth / 2);
            track.style.transform = `translateX(${resetTranslate}px)`;
            setClasses(currentIndex + 1);
        }, 820); // slightly longer than transition
    }
}

// Start automatic sliding
setInterval(slide, interval);

function openModal(id) {
    document.getElementById(id).style.display = 'block';
}
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

/* Game carousel */
const gameTrack = document.querySelector("#game .track");
const gameLeftBtn = document.querySelector("#game .carousel-btn.left");
const gameRightBtn = document.querySelector("#game .carousel-btn.right");

let gamePosition = 0;

// Get card width dynamically (includes margin)
const firstCard = gameTrack.querySelector(".card");
const cardStyle = getComputedStyle(firstCard);
const gameCardWidth = firstCard.offsetWidth + parseInt(cardStyle.marginRight);

if (gameRightBtn && gameTrack && gameLeftBtn) {
    gameRightBtn.addEventListener("click", () => {
        const gameMaxPosition = (gameTrack.children.length - 1) * gameCardWidth;
        gamePosition += gameCardWidth;
        if (gamePosition > gameMaxPosition) {
            gamePosition = 0; // loop to first
        }
        gameTrack.style.transform = `translateX(-${gamePosition}px)`;
    });

    gameLeftBtn.addEventListener("click", () => {
        const gameMaxPosition = (gameTrack.children.length - 1) * gameCardWidth;
        gamePosition -= gameCardWidth;
        if (gamePosition < 0) {
            gamePosition = gameMaxPosition; // loop to last
        }
        gameTrack.style.transform = `translateX(-${gamePosition}px)`;
    });
}

const articles = {

    article1: `
<h2>The Life and Legacy of Dr. Pío Valenzuela</h2>
<p>
Pío Valenzuela was born on July 11, 1869 in Polo, Bulacan—now Valenzuela City. He studied medicine at the University of Santo Tomas and became a licensed physician in 1895. After completing his studies, he practiced medicine in Manila and Bulacan while starting a family with his wife, Marciana Castriy.
<br> A Katipunero <br> <br> 
While still a medical student, Valenzuela joined the Katipunan in 1892 and became a close ally of its founder, Andrés Bonifacio. He served as the society’s physician and helped establish its revolutionary newspaper Kalayaan together with Emilio Jacinto. The publication helped spread the ideas of the revolution and recruit members.
<br> <br> 
Valenzuela was sent by Bonifacio to Dapitan to consult José Rizal about the planned uprising against Spain. Rizal advised caution, saying the revolution should only begin if the people were prepared and well-armed.
After the Katipunan was discovered, Valenzuela was arrested and imprisoned by Spanish authorities, later being deported to Spain and Africa. After his release, he returned to the Philippines and entered public service, becoming municipal president of Polo and later governor of Bulacan.
He died on April 6, 1956. Today, Valenzuela City bears his name in honor of his contributions to Philippine history and the struggle for independence.
</p>
`,

    article2: `
<h2>Museum Updates</h2>
<p>
The Museo ni Dr. Pío Valenzuela continues to improve its exhibits
to provide visitors with a deeper understanding of Philippine history.
</p>

<p>
Recent updates include improved artifact displays, new educational
panels, and guided tours for students and tourists.
</p>
`,

    article3: `
<h2>Educational Discoveries</h2>
<p>
Inside the museum are many artifacts that tell the story of the
Philippine Revolution and the life of Dr. Pío Valenzuela.
</p>

<p>
Visitors can learn about historical documents, personal belongings,
and photographs that highlight the contributions of Filipino heroes.
</p>
`

};


const buttons = document.querySelectorAll(".link-button");
const modal = document.getElementById("blogModal");
const articleContainer = document.getElementById("blogContent");
const closeBtn = document.getElementById("closeBlog");

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const articleId = btn.getAttribute("data-article");
        articleContainer.innerHTML = articles[articleId];
        modal.style.display = "block";
    });
});

closeBtn.onclick = () => {
    modal.style.display = "none";
};

window.onclick = (e) => {
    if (e.target == modal) {
        modal.style.display = "none";
    }
};

// Fetch and render FAQs from Supabase
async function loadFAQs() {
    const faqContainer = document.getElementById('faq-section-container');
    if (!faqContainer || typeof supabaseClient === 'undefined') return;

    try {
        const { data: faqs, error } = await supabaseClient
            .from('content')
            .select('*')
            .eq('type', 'faq')
            .eq('status', 'published')
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (faqs && faqs.length > 0) {
            faqContainer.innerHTML = '<h3>FAQ\'s</h3>';
            faqs.forEach(faq => {
                const details = document.createElement('details');
                details.innerHTML = `
                    <summary>${escapeHTML(faq.title)}</summary>
                    <p>${escapeHTML(faq.description)}</p>
                `;
                faqContainer.appendChild(details);
            });
        } else {
            faqContainer.innerHTML = '<h3>FAQ\'s</h3><p style="color:var(--text-muted); font-size:14px; text-align:center;">No FAQs available at the moment.</p>';
        }
    } catch (err) {
        console.error('Error fetching FAQs:', err);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

document.addEventListener('DOMContentLoaded', () => {
    loadFAQs();
});