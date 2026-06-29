'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';

export function Header() {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);

	const links = [
		{
			label: 'Features',
			href: '#',
		},
		{
			label: 'Pricing',
			href: '#',
		},
		{
			label: 'About',
			href: '#',
		},
	];

	return (
		<header
			className={cn(
				'sticky top-0 z-50 mx-auto w-full max-w-7xl border-b border-transparent md:rounded-md md:border md:transition-all md:ease-out',
				{
					'bg-background/95 supports-[backdrop-filter]:bg-background/50 border-white/10 backdrop-blur-lg md:top-4 md:max-w-5xl md:shadow':
						scrolled && !open,
					'bg-background/90': open,
				},
			)}
		>
			<nav
				className={cn(
					'flex h-20 w-full items-center justify-between px-6 md:h-20 md:transition-all md:ease-out mt-2',
					{
						'md:px-8': scrolled,
					},
				)}
			>
				<div className="flex flex-1 items-center justify-start">
					<a className="brand" href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
						<img src="/kubric-logo.png" alt="Kubric" style={{ height: '70px', width: 'auto' }} />
					</a>
				</div>
				
				<div className="hidden flex-1 items-center justify-center gap-6 md:flex">
					{links.map((link, i) => (
						<a key={i} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" href={link.href}>
							{link.label}
						</a>
					))}
				</div>

				<div className="hidden flex-1 items-center justify-end gap-5 md:flex">
					<a href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign In</a>
					<a href="/login" className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 18px' }}>Get Started <span className="arrow">→</span></a>
				</div>
				<button onClick={() => setOpen(!open)} className="md:hidden p-2 border border-white/10">
					<MenuToggleIcon open={open} className="size-5" duration={300} />
				</button>
			</nav>
		</header>
	);
}
