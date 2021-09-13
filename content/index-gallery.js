let imgPointer = 0;
let onDeckImgPointer = 0;
let cacheDirection = "next";
const keyCodeN = 78;
const keyCodeB = 66;
const keyCodeF = 70;
const images = Array.from(document.querySelectorAll("a[href$='.jpg' i]"));

window.addEventListener('keydown', advanceImage);
function advanceImage(e) {
   // Get the index of the next image
   // If some other key was pressed, return.
   let cacheHit = false;
   switch(e.keyCode) {
      case keyCodeN:
         imgPointer = (imgPointer + 1) % images.length;
         onDeckImgPointer = (imgPointer + 1) % images.length;
         cacheHit = (cacheDirection == "next");
         cacheDirection = "next";
         break;
      case keyCodeB:
         if (imgPointer == 0) imgPointer = images.length;
         imgPointer = (imgPointer - 1) % images.length;
         onDeckImgPointer = (imgPointer - 1) % images.length;
         if (onDeckImgPointer == -1) onDeckImgPointer = images.length - 1;
         cacheHit = (cacheDirection == "back");
         cacheDirection = "back";
         break;
			case keyCodeF:
				// F For Fullscreen
				document.querySelector("#gallery").classList.toggle("fullscreen");
				return;
      default:
         return;
   }

   const currentImage = document.querySelector(".visible");
   const onDeckImage = document.querySelector(".hidden");

   if (cacheHit) {
      // If the on deck image is for the expected direction,
      // Swap current and on-deck images.
      onDeckImage.classList.remove("hidden");
      onDeckImage.classList.add("visible");
      currentImage.classList.remove("visible");
      currentImage.classList.add("hidden");

      // The "Current" Image is now hidden and the on deck is displayed.
      // Set the next on deck
      currentImage.removeAttribute('src');
      currentImage.setAttribute('src', images[onDeckImgPointer].href);
   } else {
      // User changed directions, load-in-place the current image and set the new on deck
      currentImage.removeAttribute('src');
      currentImage.setAttribute('src', images[imgPointer].href);
      onDeckImage.removeAttribute('src');
      onDeckImage.setAttribute('src', images[onDeckImgPointer].href);
   }

   const gallery = document.querySelector("#gallery");
   gallery.classList.add("spinner");

   // Find and highlight the currently displayed image.
   document.querySelectorAll(".gallery-selected").forEach(node => node.classList.remove("gallery-selected"));
   const node = document.querySelectorAll("a[href='" +	+ "']")[0]
   images[imgPointer].classList.add("gallery-selected");
};

function handleClick(e) {
	if (e.button === 0) {
		advanceImage({keyCode: keyCodeN});
	}
}

function handleLoadEnd(e) {
   document.querySelector("#gallery").classList.remove("spinner");
}

// https://stackoverflow.com/questions/45648886/swipe-left-right-for-a-webpage
// ================================================
var start = null;
window.addEventListener("touchstart",function(event){
   if(event.touches.length === 1){
      //just one finger touched
      start = event.touches.item(0).clientX;
   } else {
      //a second finger hit the screen, abort the touch
      start = null;
   }
});

window.addEventListener("touchend",function(event){
   var offset = 50; // at least 50px to count as a swipe
   if(start){
      //the only finger that hit the screen left it
      var end = event.changedTouches.item(0).clientX;

      if(end > start + offset){
         //a left -> right swipe
         // Key code "B" for "Back"
         advanceImage({keyCode: keyCodeB});
      }
      if(end < start - offset ){
         //a right -> left swipe
         // Key code "N" for "Next"
         advanceImage({keyCode: keyCodeN});
      }
   }
});
// ================================================
