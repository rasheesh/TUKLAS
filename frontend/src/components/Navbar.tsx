'use client';

import Link from 'next/link';
import { useState } from 'react';
import '../css/navbar.css';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { label: 'HOME', href: '/' },
    { label: 'BROWSE CASES', href: '/cases' },
    { label: 'REPORT A CASE', href: '/report' },
    { label: 'MAP', href: '/map' },
    { label: 'ABOUT', href: '/about' },
    { label: 'ADMIN', href: '/admin' },
  ];

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="navbar-logo">
            <img src="/assets/icons/UBlogo.png" alt="University of Baguio Logo" />
          </div>
          <span>TUKLAS</span>
        </div>
        <ul className="navbar-links">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="navbar-link">
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
              className="navbar-link"
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
