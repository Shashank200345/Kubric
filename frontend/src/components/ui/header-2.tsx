'use client';
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';

export function Header() {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);

	const links = [
		{
			label: 'Product',
			href: '#product',
		},
		{
			label: 'How it works',
			href: '#how-it-works',
		},
		{
			label: 'Pricing',
			href: '#pricing',
		},
		{
			label: 'Integrations',
			href: '#ecosystem',
		},
	];

	return (
		<header
			className={cn(
				'sticky top-0 z-50 mx-auto w-full max-w-[1200px] border-0 md:transition-all md:ease-out',
				{
					'bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg md:top-4 md:max-w-5xl md:shadow md:rounded-md':
						scrolled && !open,
					'bg-background/90': open,
				},
			)}
		>
			<nav
				className={cn(
					'flex h-20 w-full items-center justify-between px-7 md:h-20 md:transition-all md:ease-out mt-2',
					{
						'md:px-8': scrolled,
					},
				)}
			>
				<div className="flex flex-1 items-center justify-start">
					<Link className="brand" href="/" aria-label="Kubric" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}>
						<img src="/kubric-logo.png" alt="" style={{ height: '64px', width: 'auto', display: 'block', flexShrink: 0, transform: 'translateY(4px)' }} />
						<span
							style={{
								fontFamily: "'Fredoka', system-ui, sans-serif",
								fontWeight: 600,
								fontSize: '28px',
								lineHeight: 1,
								letterSpacing: '0.12em',
								display: 'inline-flex',
								alignItems: 'center',
								transform: 'translateY(-1px)',
							}}
						>
							<span style={{ color: '#7cffb2' }}>K</span>
							<span style={{ color: '#f4f7f9' }}>UBRIC</span>
						</span>
					</Link>
				</div>
				
				<div className="hidden flex-1 items-center justify-center gap-8 md:flex">
					{links.map((link, i) => (
						<a
							key={i}
							href={link.href}
							style={{
								fontSize: '13.5px',
								fontWeight: 500,
								color: 'rgba(255,255,255,0.65)',
								textDecoration: 'none',
								transition: 'color .2s ease',
								letterSpacing: '-0.01em',
							}}
							onMouseEnter={(e) => (e.currentTarget.style.color = '#7cffb2')}
							onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
						>
							{link.label}
						</a>
					))}
				</div>

				<div className="hidden flex-1 items-center justify-end gap-5 md:flex">
					<a
						href="/login"
						style={{
							fontSize: '13.5px',
							fontWeight: 500,
							color: 'rgba(255,255,255,0.65)',
							textDecoration: 'none',
							transition: 'color .2s ease',
						}}
						onMouseEnter={(e) => (e.currentTarget.style.color = '#eef2f5')}
						onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
					>
						Sign In
					</a>
					<a href="/login" className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 18px' }}>Get Started <span className="arrow">→</span></a>
				</div>
				<button
					onClick={() => setOpen(!open)}
					className="flex md:hidden"
					aria-label={open ? 'Close menu' : 'Open menu'}
					aria-expanded={open}
					style={{
						width: '40px',
						height: '40px',
						alignItems: 'center',
						justifyContent: 'center',
						flexShrink: 0,
						background: open ? 'rgba(124,255,178,0.1)' : 'rgba(255,255,255,0.03)',
						border: `1px solid ${open ? 'rgba(124,255,178,0.45)' : 'rgba(255,255,255,0.12)'}`,
						color: open ? '#7cffb2' : 'rgba(255,255,255,0.75)',
						cursor: 'pointer',
						transition: 'color 0.25s ease, border-color 0.25s ease, background 0.25s ease',
					}}
					onMouseEnter={(e) => {
						if (!open) e.currentTarget.style.color = '#eef2f5';
						e.currentTarget.style.borderColor = 'rgba(124,255,178,0.45)';
					}}
					onMouseLeave={(e) => {
						if (!open) {
							e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
							e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
						}
					}}
				>
					<MenuToggleIcon open={open} className="size-5" duration={420} />
				</button>
			</nav>

			{/* Mobile menu */}
			<div
				className="md:hidden overflow-hidden border-t border-white/10 bg-background/95 backdrop-blur-lg"
				style={{
					display: 'grid',
					gridTemplateRows: open ? '1fr' : '0fr',
					transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
				}}
			>
				<div style={{ overflow: 'hidden', minHeight: 0 }}>
					<div className="px-6 pb-6 pt-4">
						<div className="flex flex-col gap-4">
							{links.map((link, i) => (
								<a
									key={i}
									href={link.href}
									onClick={() => setOpen(false)}
									style={{
										fontSize: '15px',
										fontWeight: 500,
										color: 'rgba(255,255,255,0.75)',
										textDecoration: 'none',
										padding: '8px 0',
										borderBottom: '1px solid rgba(255,255,255,0.06)',
									}}
								>
									{link.label}
								</a>
							))}
						</div>
						<div className="flex flex-col gap-3 mt-5">
							<a
								href="/login"
								onClick={() => setOpen(false)}
								style={{
									fontSize: '14px',
									fontWeight: 500,
									color: 'rgba(255,255,255,0.65)',
									textDecoration: 'none',
									textAlign: 'center',
									padding: '10px',
									border: '1px solid rgba(255,255,255,0.12)',
								}}
							>
								Sign In
							</a>
							<a
								href="/login"
								onClick={() => setOpen(false)}
								style={{
									fontSize: '14px',
									fontWeight: 600,
									color: '#051008',
									background: '#7cffb2',
									textDecoration: 'none',
									textAlign: 'center',
									padding: '10px',
								}}
							>
								Get Started →
							</a>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}

