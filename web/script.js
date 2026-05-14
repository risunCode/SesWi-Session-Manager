/**
 * SesWi Landing Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Header scroll effect
  const header = document.querySelector('header');
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  });

  // Animate elements on scroll
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  document.querySelectorAll('.feature-card, .step-number').forEach(el => {
    observer.observe(el);
  });

  // Traffic light hover effects
  document.querySelectorAll('.traffic-lights').forEach(container => {
    const lights = container.querySelectorAll('.tl');
    
    container.addEventListener('mouseenter', () => {
      lights.forEach(light => {
        if (light.classList.contains('tl-close')) {
          light.innerHTML = '<svg width="6" height="6" viewBox="0 0 6 6" fill="none" style="display:block;margin:auto;margin-top:3px;"><path d="M1 1L5 5M5 1L1 5" stroke="rgba(0,0,0,0.4)" stroke-width="1.2" stroke-linecap="round"/></svg>';
        } else if (light.classList.contains('tl-minimize')) {
          light.innerHTML = '<svg width="8" height="2" viewBox="0 0 8 2" fill="none" style="display:block;margin:auto;margin-top:5px;"><path d="M1 1H7" stroke="rgba(0,0,0,0.4)" stroke-width="1.5" stroke-linecap="round"/></svg>';
        } else if (light.classList.contains('tl-maximize')) {
          light.innerHTML = '<svg width="6" height="6" viewBox="0 0 6 6" fill="none" style="display:block;margin:auto;margin-top:3px;"><path d="M1 2.5V1.5C1 1.22386 1.22386 1 1.5 1H2.5M5 3.5V4.5C5 4.77614 4.77614 5 4.5 5H3.5M3.5 1H4.5C4.77614 1 5 1.22386 5 1.5V2.5M2.5 5H1.5C1.22386 5 1 4.77614 1 4.5V3.5" stroke="rgba(0,0,0,0.4)" stroke-width="1" stroke-linecap="round"/></svg>';
        }
      });
    });

    container.addEventListener('mouseleave', () => {
      lights.forEach(light => {
        light.innerHTML = '';
      });
    });
  });
});
