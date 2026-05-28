import { Navbar } from '@/src/components/Navbar';
import { Hero } from '@/src/components/Hero';
import { Stats } from '@/src/components/Stats';
import { RecentCases } from '@/src/components/RecentCases';

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Stats />
      <RecentCases />
    </>
  );
}
