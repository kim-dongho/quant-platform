import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import CustomQueryProvider from '@/shared/api/custom-query-provider';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
});

export const metadata: Metadata = {
  title: 'Pro Terminal · Quant Platform',
  description: 'Precision trading terminal for quant strategies',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <CustomQueryProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </CustomQueryProvider>
      </body>
    </html>
  );
}
