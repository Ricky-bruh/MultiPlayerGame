document.addEventListener('DOMContentLoaded', function() {
    
    // Current user and timestamp
    const currentUser = "Ricky-bruh";
    const currentTimestamp = "2025-04-06 21:11:27";
    
    // Update footer with current user info
    const footerSignature = document.querySelector('.footer-signature');
    if (footerSignature) {
        footerSignature.textContent = `Created for ${currentUser}`;
    }
    
    // Update footer date
    const footerDate = document.querySelector('.footer-bottom p');
    if (footerDate) {
        footerDate.textContent = `© 2025 Pat Pay. All rights reserved. Last updated: ${currentTimestamp}`;
    }
    
    // Pat Pay title animation
    const patPayTitle = document.getElementById('patPayTitle');
    let titleScrolled = false;
    
    // Initial animation after page load
    setTimeout(() => {
        document.body.classList.add('loaded');
        mainHeader.classList.add('visible');
        navLogo.classList.add('visible');
        navLinks.classList.add('visible');
        
        // Animate hero content
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.classList.add('visible');
        }
        
        // Show phone animation
        const phoneOutline = document.querySelector('.phone-outline');
        if (phoneOutline) {
            phoneOutline.classList.add('visible');
        }
        
        // Show coming soon badge
        const comingSoonBadge = document.querySelector('.coming-soon-badge');
        if (comingSoonBadge) {
            comingSoonBadge.classList.add('visible');
        }
        
        // Activate all initially visible animations
        document.querySelectorAll('.animate-text, .animate-up').forEach(item => {
            item.classList.add('visible');
        });
    }, 500);
    
    // Navigation toggle for mobile
    const navToggle = document.getElementById('navToggle');
    const mainHeader = document.getElementById('mainHeader');
    const navLogo = document.getElementById('navLogo');
    const navLinks = document.getElementById('navLinks');
    
    navToggle.addEventListener('click', function() {
        navLinks.classList.toggle('active');
        document.body.classList.toggle('nav-open');
    });
    
    // Close navigation when link is clicked on mobile
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navLinks.classList.remove('active');
            document.body.classList.remove('nav-open');
        });
    });
    
    // Scroll animations
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Animate the Pat Pay title shrinking and transitioning to nav
        if (scrollTop > 150 && !titleScrolled) {
            patPayTitle.style.transform = 'scale(0.6)';
            titleScrolled = true;
            
            // After the shrink animation, show the nav header
            setTimeout(() => {
                mainHeader.classList.add('visible');
                navLogo.classList.add('visible');
                navLinks.classList.add('visible');
            }, 300);
        } else if (scrollTop <= 150 && titleScrolled) {
            patPayTitle.style.transform = 'scale(1)';
            titleScrolled = false;
        }
        
        // Header transparency effect on scroll
        if (scrollTop > 100) {
            mainHeader.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
            mainHeader.style.boxShadow = '0 1px 10px rgba(0, 0, 0, 0.5)';
        } else {
            mainHeader.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            mainHeader.style.boxShadow = '0 1px 0 rgba(255, 255, 255, 0.06)';
        }
        
        // Check for elements in viewport to animate
        handleScrollAnimations();
    });
    
    // Add subtle parallax effect on mouse move (Apple-style)
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth - 0.5;
        const mouseY = e.clientY / window.innerHeight - 0.5;
        
        // Apply to hero section
        const heroVisual = document.querySelector('.hero-visual');
        if (heroVisual) {
            heroVisual.style.transform = `translate(${mouseX * 20}px, ${mouseY * 20}px)`;
        }
        
        // Apply to feature icons
        const featureIcons = document.querySelectorAll('.feature-icon-container');
        featureIcons.forEach(icon => {
            icon.style.transform = `translate(${mouseX * 15}px, ${mouseY * 15}px)`;
        });
    });
    
    // Smooth scrolling for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Handle scroll animations with IntersectionObserver
    const animatedElements = document.querySelectorAll('.animate-on-scroll, .animate-text:not(.visible), .animate-up:not(.visible), .spec-item, .stat-item, .animated-row, .faq-item, .footer-logo, .footer-column, .how-free-item, .coming-soon-large, .promise-badge');
    
    let observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };
    
    const handleScrollAnimations = () => {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                        
                        // Special case for table rows
                        if (entry.target.classList.contains('comparison') && entry.target.querySelectorAll) {
                            setTimeout(() => {
                                entry.target.querySelectorAll('.animated-row').forEach((row, index) => {
                                    setTimeout(() => {
                                        row.classList.add('visible');
                                    }, index * 150);
                                });
                            }, 300);
                        }
                        
                        // Special case for counter elements
                        if (entry.target.querySelector('.counter')) {
                            const counters = entry.target.querySelectorAll('.counter');
                            counters.forEach(counter => {
                                animateCounter(counter);
                            });
                        }
                        
                        // Trigger stat counter animation when visible
                        if (entry.target.classList.contains('stat-item')) {
                            animateStatCounter(entry.target);
                        }
                        
                        // For device animation
                        if (entry.target.classList.contains('download-options')) {
                            setTimeout(() => {
                                const device = document.querySelector('.device');
                                if (device) device.classList.add('visible');
                            }, 500);
                        }
                    }
                });
            }, observerOptions);
            
            animatedElements.forEach(el => {
                observer.observe(el);
            });
        } else {
            // Fallback for browsers that don't support IntersectionObserver
            animatedElements.forEach(el => {
                el.classList.add('visible');
            });
        }
    };
    
    // Run initial animation check
    setTimeout(handleScrollAnimations, 1000);
    
    // Enhanced counter animations
    function animateCounter(counterEl) {
        const target = parseFloat(counterEl.getAttribute('data-target'));
        const duration = 2000; // milliseconds
        const precision = target.toString().includes('.') ? 1 : 0;
        let startTime = null;
        let currentValue = 0;
        
        function updateCounter(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Use easeOutQuad for smoother animation
            const easeProgress = 1 - Math.pow(1 - progress, 2);
            currentValue = easeProgress * target;
            
            // Update the text without the span
            const span = counterEl.querySelector('span');
            const spanHTML = span ? span.outerHTML : '';
            counterEl.innerHTML = currentValue.toFixed(precision) + spanHTML;
            
            if (progress < 1) {
                window.requestAnimationFrame(updateCounter);
            } else {
                counterEl.innerHTML = target.toFixed(precision) + spanHTML;
            }
        }
        
        window.requestAnimationFrame(updateCounter);
    }

    // Enhanced stat counter animations
    function animateStatCounter(statItem) {
        const target = parseInt(statItem.getAttribute('data-value'));
        const counterEl = statItem.querySelector('.stat-value');
        const format = statItem.getAttribute('data-format') || 'default';
        const denominator = statItem.getAttribute('data-denominator') || null;
        const spanContent = counterEl.querySelector('span').outerHTML;
        
        let current = 0;
        const duration = 2000;
        let startTime = null;
        
        function updateStatCounter(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Use easeOutQuad for smoother animation
            const easeProgress = 1 - Math.pow(1 - progress, 2);
            current = easeProgress * target;
            
            if (format === 'fraction') {
                counterEl.innerHTML = Math.floor(current) + spanContent.replace('/7', `/${denominator}`);
            } else {
                counterEl.innerHTML = Math.floor(current) + spanContent;
            }
            
            if (progress < 1) {
                window.requestAnimationFrame(updateStatCounter);
            } else {
                // Ensure the final value is exact
                if (format === 'fraction') {
                    counterEl.innerHTML = target + spanContent.replace('/7', `/${denominator}`);
                } else {
                    counterEl.innerHTML = target + spanContent;
                }
            }
        }
        
        window.requestAnimationFrame(updateStatCounter);
    }
    
    
    // FAQ accordion functionality
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all items first
            faqItems.forEach(faq => {
                faq.classList.remove('active');
            });
            
            // Toggle the clicked item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
    
    // Create animated particles for feature icons
    function createParticles() {
        const particleFields = document.querySelectorAll('.particle-field');
        
        particleFields.forEach(field => {
            for (let i = 0; i < 15; i++) {
                const particle = document.createElement('span');
                particle.classList.add('particle');
                
                // Random position
                const posX = Math.random() * 100;
                const posY = Math.random() * 100;
                
                // Random size
                const size = Math.random() * 4 + 1;
                
                // Random animation duration
                const duration = Math.random() * 3 + 2;
                
                // Random animation delay
                const delay = Math.random() * 2;
                
                // Purple glow effect
                particle.style.boxShadow = '0 0 5px rgba(157, 78, 221, 0.8)';
                particle.style.backgroundColor = 'rgba(157, 78, 221, 0.8)';
                
                // Style the particle
                particle.style.left = `${posX}%`;
                particle.style.top = `${posY}%`;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.animationDuration = `${duration}s`;
                particle.style.animationDelay = `${delay}s`;
                particle.style.position = 'absolute';
                particle.style.borderRadius = '50%';
                particle.style.opacity = '0';
                particle.style.animation = `particleAnimation ${duration}s ease-in-out ${delay}s infinite`;
                
                field.appendChild(particle);
            }
        });
        
        // Add the animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes particleAnimation {
                0% { transform: translate(0, 0); opacity: 0; }
                50% { opacity: 0.8; }
                100% { transform: translate(${Math.random() > 0.5 ? '+' : '-'}${Math.random() * 50}px, ${Math.random() > 0.5 ? '+' : '-'}${Math.random() * 50}px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    createParticles();
    
    // Add Apple-like hover effect to the navigation
    const navLinkItems = document.querySelectorAll('.nav-link');
    
    navLinkItems.forEach(link => {
        link.addEventListener('mouseenter', () => {
            navLinkItems.forEach(item => {
                if (item !== link) {
                    item.style.opacity = '0.5';
                }
            });
        });
        
        link.addEventListener('mouseleave', () => {
            navLinkItems.forEach(item => {
                item.style.opacity = '1';
            });
        });
    });
    
    // Social links hover effect
    const socialLinks = document.querySelectorAll('.social-link');
    
    socialLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.style.transform = 'translateY(-3px)';
            link.style.textShadow = '0 0 10px rgba(157, 78, 221, 0.5)';
        });
        
        link.addEventListener('mouseleave', () => {
            link.style.transform = 'translateY(0)';
            link.style.textShadow = 'none';
        });
    });
    
    // Dot animation for the title
    const titleDot = document.querySelector('.animated-title .dot');
    if (titleDot) {
        setInterval(() => {
            titleDot.style.transform = 'scale(1.3)';
            titleDot.style.textShadow = '0 0 15px rgba(157, 78, 221, 0.8)';
            setTimeout(() => {
                titleDot.style.transform = 'scale(1)';
                titleDot.style.textShadow = '0 0 5px rgba(157, 78, 221, 0.4)';
            }, 300);
        }, 3000);
    }
    
    // "How is this free" item hover effects
    const howFreeItems = document.querySelectorAll('.how-free-item');
    
    howFreeItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const icon = item.querySelector('.how-free-icon i');
            if (icon) {
                icon.style.transform = 'scale(1.2) rotate(10deg)';
            }
            item.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(157, 78, 221, 0.5)';
            item.style.borderColor = 'rgba(157, 78, 221, 0.5)';
        });
        
        item.addEventListener('mouseleave', () => {
            const icon = item.querySelector('.how-free-icon i');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0)';
            }
            item.style.boxShadow = 'var(--shadow)';
            item.style.borderColor = 'var(--border)';
        });
    });
    
    // "Coming Soon" badge animations
    const comingSoonLarge = document.querySelector('.coming-soon-large');
    if (comingSoonLarge) {
        comingSoonLarge.addEventListener('mouseenter', () => {
            comingSoonLarge.style.transform = 'scale(1.05)';
            comingSoonLarge.style.color = '#c77dff';
            comingSoonLarge.style.textShadow = '0 0 20px rgba(157, 78, 221, 0.8)';
        });
        
        comingSoonLarge.addEventListener('mouseleave', () => {
            comingSoonLarge.style.transform = 'scale(1)';
            comingSoonLarge.style.color = '#9d4edd';
            comingSoonLarge.style.textShadow = '0 0 15px rgba(157, 78, 221, 0.4)';
        });
    }
    
    // Add glow effect to stat counters on hover
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const value = item.querySelector('.stat-value');
            if (value) {
                value.style.textShadow = '0 0 20px rgba(157, 78, 221, 0.8)';
                value.style.transform = 'scale(1.05)';
            }
        });
        
        item.addEventListener('mouseleave', () => {
            const value = item.querySelector('.stat-value');
            if (value) {
                value.style.textShadow = '0 0 5px rgba(157, 78, 221, 0.4)';
                value.style.transform = 'scale(1)';
            }
        });
    });
    
    // Custom cursor effect for interactive elements (Apple-like)
    const interactiveElements = document.querySelectorAll('a, button, .faq-question, .how-free-item, .stat-item');
    
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            document.body.style.cursor = 'pointer';
        });
        
        element.addEventListener('mouseleave', () => {
            document.body.style.cursor = 'default';
        });
    });
    
    // 3D tilt effect for cards on mouse move (subtle Apple-like effect)
    const tiltElements = document.querySelectorAll('.feature-icon-container, .download-button, .how-free-item, .stat-item');
    
    tiltElements.forEach(element => {
        // Add a CSS transition for smoother reset
        element.style.transition = 'transform 0.2s ease';
        element.addEventListener('mousemove', (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const xPercent = x / rect.width;
            const yPercent = y / rect.height;
            
            const tiltX = (0.5 - yPercent) * 8;
            const tiltY = (xPercent - 0.5) * 8;
            
            element.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
        });
    });
    
    // Add subtle ambient background animation
    const createAmbientBackground = () => {
        const sections = document.querySelectorAll('section');
        
        sections.forEach(section => {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            canvas.classList.add('ambient-canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            canvas.style.opacity = '0.1';
            canvas.style.zIndex = '0';
            
            // Prepend the canvas to the section
            section.style.position = 'relative';
            section.prepend(canvas);
            
            // Set the canvas dimensions
            canvas.width = section.offsetWidth;
            canvas.height = section.offsetHeight;
            
            // Only apply to certain sections
            if (section.classList.contains('hero') || section.classList.contains('features') || section.classList.contains('how-free')) {
                const ctx = canvas.getContext('2d');
                
                // Create gradient with a faster interpolation for smoother movement
                const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
                gradient.addColorStop(0, 'rgba(157, 78, 221, 0.05)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
                let x = canvas.width / 2;
                let y = canvas.height / 2;
                let targetX = x;
                let targetY = y;
                
                function animate() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Increase the interpolation factor to 0.05 for a smoother, more responsive animation
                    x += (targetX - x) * 0.05;
                    y += (targetY - y) * 0.05;
                    
                    const newGradient = ctx.createRadialGradient(x, y, 0, x, y, canvas.width / 3);
                    newGradient.addColorStop(0, 'rgba(157, 78, 221, 0.05)');
                    newGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    
                    ctx.fillStyle = newGradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    requestAnimationFrame(animate);
                }
                
                // Update target position every 3 seconds
                setInterval(() => {
                    targetX = Math.random() * canvas.width;
                    targetY = Math.random() * canvas.height;
                }, 3000);
                
                animate();
            }
        });
    };
    
    // Initialize ambient background after a short delay
    setTimeout(createAmbientBackground, 1500);
});
