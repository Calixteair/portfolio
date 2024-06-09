const swiper = new Swiper('.main-swiper', {
   // Optional parameters
   direction: 'horizontal',
   loop: false,
   allowTouchMove: false,



   // If we need pagination
   pagination: {
       el: '.pagi-main',
   },

   // Navigation arrows
   navigation: {
       nextEl: '.next-main',
       prevEl: '.prev-main',
   },

   /*
   // And if we need scrollbar
   scrollbar: {
       el: '.swiper-scrollbar',
   },
   */
});

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
    const text = document.getElementById("typingContent").innerText;
    let i = 0;
    const speed = 20; // Adjust the speed of typing here

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
});
