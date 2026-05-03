'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import '../css/navbar.css';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: 'HOME', href: '/' },
    { label: 'BROWSE CASES', href: '/cases' },
    { label: 'REPORT A CASE', href: '/report' },
    { label: 'MAP', href: '/map' },
    { label: 'ABOUT', href: '/about' },
  ];

  /* Exact match for home, prefix match for everything else */
  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="navbar-logo">
            <Image
              src="/assets/icons/UBlogo.png"
              alt="University of Baguio Logo"
              width={40}
              height={40}
              priority
            />
          </div>
          <span>TUKLAS</span>
        </div>
        <ul className="navbar-links">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`navbar-link${isActive(link.href) ? ' active' : ''}`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <button 
          className={`navbar-hamburger ${isOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <ul className={`navbar-menu ${isOpen ? 'open' : ''}`}>
        {navLinks.map((link) => (
          <li key={link.href}>
            <Link 
              href={link.href}
              className={`navbar-link${isActive(link.href) ? ' active' : ''}`}
              aria-current={isActive(link.href) ? 'page' : undefined}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
