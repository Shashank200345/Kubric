'use client';
import React from 'react';
import { cn } from '@/lib/utils';

type MenuToggleProps = React.ComponentProps<'svg'> & {
	open: boolean;
	duration?: number;
};

/**
 * Animated hamburger ⇄ close icon.
 * Three crisp bars: the middle bar fades + collapses while the top and
 * bottom bars glide to the centre and cross into an X. A gentle overshoot
 * on the rotation gives it a tactile, springy feel.
 */
export const MenuToggleIcon = ({
	open,
	duration = 420,
	className,
	...props
}: MenuToggleProps) => {
	const ease = 'cubic-bezier(0.65, -0.35, 0.35, 1.35)';
	const move = `${duration}ms ${ease}`;
	const fade = `${Math.round(duration * 0.55)}ms ease`;

	const barBase: React.CSSProperties = {
		// resolve transform-origin against each line's own box (not the whole
		// SVG viewport) so the bars rotate around their centre and cross
		// exactly in the middle instead of drifting off to one side.
		transformBox: 'fill-box',
		transformOrigin: 'center',
	};

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn('h-5 w-5', className)}
			{...props}
		>
			{/* top bar */}
			<line
				x1="3.5"
				y1="7"
				x2="20.5"
				y2="7"
				style={{
					...barBase,
					transition: `transform ${move}`,
					transform: open
						? 'translateY(5px) rotate(45deg)'
						: 'translateY(0) rotate(0deg)',
				}}
			/>
			{/* middle bar */}
			<line
				x1="3.5"
				y1="12"
				x2="20.5"
				y2="12"
				style={{
					...barBase,
					transition: `transform ${fade}, opacity ${fade}`,
					transform: open ? 'scaleX(0)' : 'scaleX(1)',
					opacity: open ? 0 : 1,
				}}
			/>
			{/* bottom bar */}
			<line
				x1="3.5"
				y1="17"
				x2="20.5"
				y2="17"
				style={{
					...barBase,
					transition: `transform ${move}`,
					transform: open
						? 'translateY(-5px) rotate(-45deg)'
						: 'translateY(0) rotate(0deg)',
				}}
			/>
		</svg>
	);
};
