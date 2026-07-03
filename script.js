const nav = document.querySelector('.nav-links');
const toggle = document.querySelector('.menu-toggle');

toggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = nav?.classList.toggle('is-open') ?? false;
    toggle.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', (event) => {
    if (!nav || !toggle || window.innerWidth > 720) {
        return;
    }

    const target = event.target;
    if (target instanceof Node && !nav.contains(target) && !toggle.contains(target)) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 720) {
        nav?.classList.remove('is-open');
        toggle?.setAttribute('aria-expanded', 'false');
    }
});
