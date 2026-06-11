Surface panel — white fill, hairline border, black-border + 2px lift on hover. The branch/page grid card from the documentation system.

```jsx
<Card as="a" href="#" title="Cadrage →"
  meta={<Tag variant="spec">spécifiée</Tag>}>
  Vision, principes, modèle du moteur, architecture.
</Card>

<Card disabled title="À venir">D'autres branches viendront.</Card>
```

`title` + `meta` build the head row; body is the children. Use `as="a"` (or `interactive`) for the hover lift. `disabled` gives the dashed "coming soon" treatment. `flush` removes padding for media.
