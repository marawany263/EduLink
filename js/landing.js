// --- EduLink Landing Page Interactions ---

document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");
    const mainNavbar = document.getElementById("mainNavbar");

    // 1. تفعيل القائمة المرنة للهواتف الذكية (Mobile Menu)
    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            navLinks.classList.toggle("active");
            
            // حركة جمالية لزر القائمة نفسه
            menuToggle.classList.toggle("open");
        });
    }

    // 2. تغيير تصميم شريط التنقل عند النزول لأسفل (Scroll Navbar Effect)
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            mainNavbar.classList.add("scrolled");
        } else {
            mainNavbar.classList.remove("scrolled");
        }
    });

    // 3. إغلاق القائمة تلقائياً عند الضغط على أي رابط داخلي (لتجربة مستخدم أفضل)
    const links = navLinks.querySelectorAll("a");
    links.forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
        });
    });
});