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
