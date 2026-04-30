import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import CustomQueryProvider from '@/shared/api/custom-query-provider';
import { DialogProvider } from '@/shared/ui/dialog/dialog-provider';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
});

export const metadata: Metadata = {
  title: 'Quant Platform',
  description: 'Precision trading terminal for quant strategies',
  icons: {
    icon: [{ url: '/assets/logo.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* App Router 에선 layout.tsx 가 _document 역할. no-page-custom-font 룰의 false positive. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <CustomQueryProvider>
          <NuqsAdapter>
            <DialogProvider>{children}</DialogProvider>
          </NuqsAdapter>
        </CustomQueryProvider>
      </body>
    </html>
  );
}
