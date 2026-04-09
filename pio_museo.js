/* PIO MUSEO CORE JAVASCRIPT */
/* SUPABASE INITIALIZATION MOVED TO supabaseClient.js TO AVOID CONFLICTS */

// Navbar toggle logic (Global Event Delegation)
document.addEventListener('click', (e) => {
    const navToggle = e.target.closest('.nav-toggle');
    if (navToggle) {
        e.preventDefault();
        const navLinks = document.querySelector(".nav-links");
        if (navLinks) {
            const isOpen = navLinks.classList.toggle("open");
            navToggle.setAttribute("aria-expanded", String(isOpen));
            console.log("Navbar toggle clicked, state:", isOpen);
        } else {
            console.error("Navbar toggle clicked, but .nav-links not found!");
        }
    }

    // Close menu when a navigation link is clicked
    const isOpen = document.querySelector(".nav-links")?.classList.contains('open');
    if (isOpen && e.target.closest('.nav-links a')) {
        const navLinks = document.querySelector(".nav-links");
        navLinks.classList.remove('open');
        const toggle = document.querySelector('.nav-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        console.log("Nav link clicked, menu closed auto");
    }
});

// Hero Carousel Initialization
function initHeroCarousel() {
    const container = document.querySelector('.hero-visual .carousel');
    const track = document.querySelector('.hero-visual .track');

    if (!container || !track) return;

    // Capture original cards before cloning for infinite loop
    const originalCards = Array.from(track.children);
    if (originalCards.length === 0) return;

    // Clean up any existing clones to prevent double-cloning on re-init
    const existingClones = track.querySelectorAll('.is-clone');
    existingClones.forEach(el => el.remove());

    // Clone cards for seamless infinite scrolling
    originalCards.forEach(card => {
        const clone = card.cloneNode(true);
        clone.classList.add('is-clone');
        track.appendChild(clone);
    });

    let currentIndex = 0;
    let cardWidth = 0;
    let containerWidth = 0;

    // Calculate dimensions based on current layout
    function calculateDimensions() {
        if (originalCards[0]) {
            cardWidth = originalCards[0].offsetWidth + 25; // 320px + 25px gap
            containerWidth = container.offsetWidth;
            updatePosition(false);
        }
    }

    // Update the translateX position and apply zoom classes
    function updatePosition(smooth = true) {
        if (cardWidth <= 25) return; // Haven't loaded yet

        const offset = (containerWidth / 2) - (cardWidth * currentIndex + cardWidth / 2);
        track.style.transition = smooth ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
        track.style.transform = `translateX(${offset}px)`;

        // Update classes for the focal zoom effect
        const allCards = Array.from(track.children);
        allCards.forEach((card, i) => {
            card.classList.remove('active', 'prev', 'next');
            if (i === currentIndex) card.classList.add('active');
            else if (i === currentIndex - 1) card.classList.add('prev');
            else if (i === currentIndex + 1) card.classList.add('next');
        });
    }

    // Move to next slide
    function next() {
        currentIndex++;
        updatePosition(true);

        // Infinite loop logic: when we hit the clones, snap back to the start
        if (currentIndex >= originalCards.length) {
            setTimeout(() => {
                currentIndex = 0;
                updatePosition(false);
            }, 800); // Wait for transition to finish
        }
    }

    // Initial setup
    calculateDimensions();
    // Re-run after a short delay to account for dynamic layout shifts
    setTimeout(calculateDimensions, 500);

    // Start auto-play (4 seconds interval)
    const intervalId = setInterval(next, 4000);

    // Adjust on window resize for responsiveness
    window.addEventListener('resize', calculateDimensions);
}

// Initialize on Load
if (document.readyState === 'complete') initHeroCarousel();
else window.addEventListener('load', initHeroCarousel);


/* Modal Logic */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'block';
}
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

/* Game Carousel Logic */
function initGameCarousel() {
    const gameTrack = document.querySelector("#game .track");
    const gameLeftBtn = document.querySelector("#game .carousel-btn.left");
    const gameRightBtn = document.querySelector("#game .carousel-btn.right");

    if (!gameTrack) return;

    let gamePosition = 0;
    const firstCard = gameTrack.querySelector(".card");
    if (!firstCard) return;

    const cardStyle = getComputedStyle(firstCard);
    const gameCardWidth = firstCard.offsetWidth + parseInt(cardStyle.marginRight) || 205;

    if (gameRightBtn) {
        gameRightBtn.addEventListener("click", () => {
            const gameMaxPosition = (gameTrack.children.length - 1) * gameCardWidth;
            gamePosition += gameCardWidth;
            if (gamePosition > gameMaxPosition) gamePosition = 0;
            gameTrack.style.transform = `translateX(-${gamePosition}px)`;
        });
    }

    if (gameLeftBtn) {
        gameLeftBtn.addEventListener("click", () => {
            gamePosition -= gameCardWidth;
            if (gamePosition < 0) {
                gamePosition = (gameTrack.children.length - 1) * gameCardWidth;
            }
            gameTrack.style.transform = `translateX(-${gamePosition}px)`;
        });
    }
}

if (document.readyState === 'complete') initGameCarousel();
else window.addEventListener('load', initGameCarousel);

/* FAQ Toggle Logic (Best Practice) */
document.addEventListener('click', (e) => {
    const questionBtn = e.target.closest('.faq-question');
    if (questionBtn) {
        console.log("FAQ Question Clicked:", questionBtn.textContent.trim());
        const item = questionBtn.closest('.faq-item');
        if (item) {
            item.classList.toggle('active');
            console.log("FAQ Item Active State:", item.classList.contains('active'));
        }
    }
});
