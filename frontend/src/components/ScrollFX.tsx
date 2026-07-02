'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Nexaro-style scroll experience:
 *  - Lenis inertial smooth scrolling, synced to GSAP's ticker + ScrollTrigger.
 *  - Elements fade + slide up as they enter the viewport.
 *  - Card groups stagger in together for that "blend with scroll" feel.
 *
 * Renders nothing — it just wires up the effects on the landing page.
 */
export default function ScrollFX() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    gsap.registerPlugin(ScrollTrigger);

    // --- Lenis smooth scroll ---
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // --- Scroll reveals ---
    const ctx = gsap.context(() => {
      // Individual fade-ups for headings / copy blocks.
      const singles = gsap.utils.toArray<HTMLElement>(
        [
          '.landing .kicker',
          '.landing .section-title',
          '.landing .pods-title',
          '.landing .pods-head',
          '.landing .stripe-title',
          '.landing .split-copy',
          '.landing .cta-copy',
          '.landing .ecosystem-wrap',
          '.landing #how-it-works .container > *',
          '.landing #ecosystem .muted',
          '.landing #showcase .container > *:not(.pods-head):not(.pods-title)',
        ].join(', ')
      );

      singles.forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 42 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Staggered card groups — reveal siblings together as the group enters.
      const groups = ['.pods-list .pod-row', '.steps-grid .step-card', '.split-grid .mini', '.bento .bento-card'];

      groups.forEach((sel) => {
        const cards = gsap.utils.toArray<HTMLElement>(`.landing ${sel}`);
        if (!cards.length) return;
        gsap.set(cards, { autoAlpha: 0, y: 48 });
        ScrollTrigger.batch(cards, {
          start: 'top 90%',
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              duration: 0.85,
              ease: 'power3.out',
              stagger: 0.12,
              overwrite: true,
            }),
        });
      });

      // Recalculate once everything (fonts/images) has settled.
      ScrollTrigger.refresh();
    });

    // Refresh on full load so image-height changes don't desync triggers.
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    return () => {
      window.removeEventListener('load', onLoad);
      gsap.ticker.remove(raf);
      ctx.revert();
      lenis.destroy();
    };
  }, []);

  return null;
}
