import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import '../css/globals.css';
import { AuthProvider } from '../context/AuthContext';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TUKLAS | Baguio City Missing Persons Information System',
  description:
    'TUKLAS is a centralized platform for the reporting, searching, and identification of missing and unidentified persons in Baguio City, Philippines.',
  icons: {
    icon: '/assets/icons/UBlogo.png',
    apple: '/assets/icons/UBlogo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
