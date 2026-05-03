import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)' }}>
        <p style={{ color: '#7f8c8d', fontSize: '1rem' }}>About page — coming soon.</p>
      </main>
      <Footer />
    </>
  );
}
