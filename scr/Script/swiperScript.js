
var inwrittenEffect = false;

const swiperComparator = new Swiper('.comparator-swiper', {
    // Optional parameters
    direction: 'horizontal',
    loop: true,
    centeredSlides: true, // Active le centrage des slides
    slidesPerView: 'auto', // Affiche un nombre variable de slides en fonction de la largeur de chaque slide
 
 
    // If we need pagination
    pagination: {
        el: '.pagi-comparator',
        clickable: true, // Rend les points de pagination cliquables
    },
 
    // Navigation arrows
    navigation: {
        nextEl: '.next-comparator',
        prevEl: '.prev-comparator',
    },
 
    
 });



document.addEventListener("DOMContentLoaded", function() {
    wirttenEffect();
});

function wirttenEffect() {
    if (inwrittenEffect) return;
    inwrittenEffect = true;
    const text = document.getElementById("typingContent").innerText;
    let i = 0;
    const speed = 20; // Adjust the speed of typing here

    //faire grossir la div de facon fluid en fonction de la taille du texte



    function typeWriter() {
        if (i < text.length) {
            document.getElementById("typingContent").innerText = text.substring(0, i + 1);
            i++;
            setTimeout(typeWriter, speed);
        }
    }

    // Clear the content and start the typing effect
    document.getElementById("typingContent").innerText = "";
    typeWriter();
    inwrittenEffect = false;

}

document.addEventListener("DOMContentLoaded", function() {
    // Initialize Swiper
    const swiper = new Swiper('.main-swiper', {
        direction: 'horizontal',
        loop: false,
        allowTouchMove: false,
        // Your swiper settings
        navigation: {
            nextEl: '.next-main',
            prevEl: '.prev-main'
        },
        on: {
            slideChange: function() {
                const competenceSection = document.getElementById('competence-section');
                const aboutSection = document.getElementById('about-section');

                if (swiper.activeIndex === 1) { // assuming 0 is the index for Compétences and 1 for À propos
                    //wait for the animation to finish
                    setTimeout(() => {
                        competenceSection.classList.add('hidden');
                    }, 500);
                    //scroll to top
                    window.scrollTo(0, 0);
                } else {
                    competenceSection.classList.remove('hidden');
                }
            }
        }
    });
});


