import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title: 'Curtain Planet Plus', description: 'Connected shop and production management'};
export default function Layout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>;}
