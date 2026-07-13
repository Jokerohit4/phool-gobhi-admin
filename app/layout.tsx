import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import Sidebar from './sidebar';

export const metadata: Metadata = {
  title: 'Phool Gobhi Admin',
  description: 'Internal staff portal',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="flex">
          <Sidebar />
          <main className="mx-auto w-full max-w-5xl px-6 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
