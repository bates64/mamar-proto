import { ComponentChildren, Ref, toChildArray } from 'preact'
import { forwardRef } from 'preact/compat'
import cx from 'classnames'
import { em } from '../theme'

import './Box.css'

const Box = forwardRef((props: {
	dir?: 'h' | 'v', // Defaults to 'h' (horizontal)
	gap?: number,

	pad?: number,
	padX?: number,
	padY?: number,

	children: ComponentChildren,
}, ref: Ref<HTMLDivElement>) => {
	// Add a spacer between each child.
	const children = toChildArray(props.children)
	let childrenWithGaps = children
	if (props.gap > 0) {
		childrenWithGaps = [children[0]]
		for (let i = 1; i < children.length; i++) {
			const previous = children[i - 1]
			const child = children[i]
			if (typeof previous === 'string' && typeof child === 'string') {
				// Don't add gap between text siblings.
			} else {
				childrenWithGaps.push(<div style={{
					[props.dir === 'v' ? 'height' : 'width']: em(props.gap),
				}}></div>)
			}
			childrenWithGaps.push(child)
		}
	}

	console.log({
		padding: em(props.pad),
		'padding-left': em(props.padX),
		'padding-right': em(props.padX),
		'padding-top': em(props.padY),
		'padding-bottom': em(props.padY),
	})

	return <div ref={ref} class={cx({
		Box: true,
		Box_vertical: props.dir === 'v',
	})} style={{
		'padding-left': em(props.padX ?? props.pad),
		'padding-right': em(props.padX ?? props.pad),
		'padding-top': em(props.padY ?? props.pad),
		'padding-bottom': em(props.padY ?? props.pad),
	}}>
		{childrenWithGaps}
	</div>
})

export default Box
