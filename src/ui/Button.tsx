import { ComponentChildren, Ref } from 'preact'
import { forwardRef } from 'preact/compat'

import Box from './Box'

import './Button.css'

const Button = (props: {
	color?: string,
	large?: boolean,
	onClick?: any,

	children: ComponentChildren
}, ref: Ref<HTMLDivElement>) => {
	return <div ref={ref} onClick={props.onClick} class='Button' style={{ background: props.color }}>
		<div class='Button_HoverShade'>
			<Box padX={props.large ? 3 : 2} padY={props.large ? 2 : 1} gap={1}>
				{props.children}
			</Box>
		</div>
	</div>
}

export default Button
