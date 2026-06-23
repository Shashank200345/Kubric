'use client';
import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
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
					'flex h-16 w-full items-center justify-between px-6 md:h-14 md:transition-all md:ease-out',
					{
						'md:px-8': scrolled,
					},
				)}
			>
				<div className="flex flex-1 items-center justify-start">
					<a className="brand" href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
						<span className="brand-mark"></span>
						<span className="brand-name">kubric</span>
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
					<Button variant="ghost" className="font-semibold text-muted-foreground hover:text-foreground hover:bg-transparent">Sign In</Button>
					<Button className="font-semibold rounded-full bg-primary text-primary-foreground">Get Started →</Button>
				</div>
				<Button size="icon" variant="outline" onClick={() => setOpen(!open)} className="md:hidden">
					<MenuToggleIcon open={open} className="size-5" duration={300} />
				</Button>
			</nav>
		</header>
	);
}
