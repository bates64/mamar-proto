const Icon = props => <div style={{
	display: 'inline-flex',
	'align-self': 'center',
}}>{props.children}</div>

export const Page = (props: { color?: string }) => <Icon>
	<svg width='1.1em' height='1.1em' viewBox='0 0 16 16'>
		<g transform='translate(0 -292.77)'>
			<path d='m3 293.77v14h10v-10l-4-4z' fill='none' stroke={props.color ?? 'currentColor'} stroke-linejoin='round' stroke-width='1.5'/>
		</g>
	</svg>
</Icon>

export const Play = (props: { color?: string }) => <Icon>
	<svg width='1.1em' height='1.1em' viewBox='0 0 16 16'>
		<g transform='translate(0 -292.77)'>
			<path d='m4.4688 294.77 10 6-10 6z' fill='none' stroke={props.color ?? 'currentColor'} stroke-linejoin='round' stroke-width='1.5'/>
		</g>
	</svg>
</Icon>
