# ScrollArea

`ScrollArea` mantiene lo scroll nativo per wheel, touch, tastiera e inerzia, ma
nasconde la scrollbar del browser e visualizza il thumb neoclassico condiviso.

```tsx
import { ScrollArea } from "../scroll-area/scroll-area";

<ScrollArea
  className="scrollbar-green-gold"
  viewportClassName="my-scroll-content"
>
  {children}
</ScrollArea>
```

Varianti disponibili:

- `scrollbar-green-gold`: thumb verde scuro con bordo e dettagli oro.
- `scrollbar-burgundy-gold`: thumb borgogna con bordo e dettagli oro.

La geometria si controlla dal consumer tramite:

```css
.my-scroll-area {
  --scrollbar-track-top: 24px;
  --scrollbar-track-bottom: 24px;
  --scrollbar-track-inline-end: 10px;
  --scrollbar-width: 9px;
}
```
