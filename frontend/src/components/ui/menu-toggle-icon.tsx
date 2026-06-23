'use client';
import React from 'react';
import { cn } from '@/lib/utils';

type MenuToggleProps = React.ComponentProps<'svg'> & {
	open: boolean;
	duration?: number;
};

export const MenuToggleIcon = ({
	open,
	duration = 500,
	className,
	...props
}: MenuToggleProps) => {
	const timing = `${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
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
			<g>
				<line
					x1="4"
					y1="8"
					x2="20"
					y2="8"
					style={{
						transformOrigin: '50% 50%',
						transition: `transform ${timing}, opacity ${timing}`,
						transform: open
							? 'translate(0, 4px) rotate(45deg)'
							: 'translate(0, 0) rotate(0deg)',
					}}
				/>
				<line
					x1="4"
					y1="16"
					x2="20"
					y2="16"
					style={{
						transformOrigin: '50% 50%',
						transition: `transform ${timing}, opacity ${timing}`,
						transform: open
							? 'translate(0, -4px) rotate(-45deg)'
							: 'translate(0, 0) rotate(0deg)',
					}}
				/>
			</g>
		</svg>
	);
};
