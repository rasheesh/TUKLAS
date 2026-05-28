'use client';

import Link from 'next/link';
import '../css/hero.css';

export function Hero() {
  return (
    <section
      className="hero"
      style={{
        backgroundImage: 'url(/assets/icons/HomePageBG.png)',
      }}
    >
      <div className="hero-content">
        <div className="hero-text">
          <h1 className="hero-title">TUKLAS</h1>
          <h3 className="hero-subtitle">Missing and Unidentified Persons Information System</h3>
          <p className="hero-description">
            TUKLAS is a centralized platform designed to improve the visibility, reporting, and identification of
            missing and unidentified persons. By integrating searchable records, geo-mapping, and case matching, the
            system supports faster information sharing between communities and authorities.
          </p>
          <div className="hero-buttons">
            <Link href="/report" className="hero-button primary">
              Report a Case
            </Link>
            <Link href="/cases" className="hero-button secondary">
              Search Cases
            </Link>
          </div>
        </div>
        <div className="hero-logo">
          <img src="/assets/icons/UBlogo.png" alt="University of Baguio Logo" />
        </div>
      </div>
    </section>
  );
}
